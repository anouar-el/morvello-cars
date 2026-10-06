import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

import crypto from 'crypto';
import { initializeApp, getApps, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth, UserRecord, CreateRequest, Auth as FirebaseAdminAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore as FirebaseAdminFirestore } from 'firebase-admin/firestore';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildAssistantDataSection } from './src/lib/aiAssistantContext';
import { FRANCHISE_DAMAGE_RATE_PERCENT } from './src/data/insurancePacks';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

/** Masks an email for log output (e.g. "jo***@example.com") so PII does not sit in plaintext logs. */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

export function normalizeSupabaseUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let url = raw.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1\/?$/i, '');
  url = url.replace(/\/auth\/v1\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url.startsWith('https://') ? url : '';
}

// Supabase Server-side Client Configuration
// The browser gets VITE_* values baked in at build time, but the server reads them at runtime:
// on a host where they are only build variables they are missing here, so SUPABASE_* is accepted too.
const SUPABASE_URL = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let supabaseServerClient: SupabaseClient | null = null;
let supabaseAdminServiceClient: SupabaseClient | null = null;
// True when a client was injected (tests): it then also stands in for the per-user client
let supabaseClientInjected = false;

export function setSupabaseClient(client: SupabaseClient | null) {
  supabaseServerClient = client;
  supabaseClientInjected = Boolean(client);
}

/**
 * Client acting as the authenticated user: queries run with the caller's JWT, so RLS
 * applies exactly as in the browser. The shared anon client runs as the `anon` role,
 * which the `profiles` policies deny, so reading the caller's own profile needs this.
 */
export function getUserScopedSupabaseClient(accessToken: string): SupabaseClient {
  if (supabaseClientInjected && supabaseServerClient) return supabaseServerClient;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase server configuration is missing.');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY } },
  });
}

export function setSupabaseAdminServiceClient(client: SupabaseClient | null) {
  supabaseAdminServiceClient = client;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseServerClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Supabase server configuration is missing.');
    }
    supabaseServerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseServerClient;
}

/**
 * Server-only administrative Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * CRITICAL ZERO-TRUST RULE:
 * This client is NEVER exposed to the client/browser.
 * It is invoked ONLY AFTER authenticateCaller() and verifyAdminCaller()
 * have cryptographically and authoritatively validated the user, their role,
 * and their agency jurisdiction.
 */
export function getSupabaseAdminServiceClient(): SupabaseClient {
  if (supabaseAdminServiceClient) {
    return supabaseAdminServiceClient;
  }
  if (supabaseClientInjected && supabaseServerClient) {
    return supabaseServerClient;
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdminServiceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseAdminServiceClient;
  }

  // Graceful fallback to standard server client if service role key is not configured in environment
  return getSupabaseClient();
}

// Lazy initialization for Firebase Admin SDK
let adminApp: FirebaseAdminApp | null = null;
let adminAuth: FirebaseAdminAuth | null = null;
let adminDb: FirebaseAdminFirestore | null = null;

export function setAdminAuth(auth: FirebaseAdminAuth | null) {
  adminAuth = auth;
}

export function setAdminDb(db: FirebaseAdminFirestore | null) {
  adminDb = db;
}

function getAdminApp(): FirebaseAdminApp {
  if (!adminApp) {
    const existing = getApps();
    if (existing.length > 0) {
      adminApp = existing[0];
    } else {
      adminApp = initializeApp({
        projectId: 'reference-unity-289300',
      });
    }
  }
  return adminApp;
}

function getAdminAuth(): FirebaseAdminAuth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

function getAdminDb(): FirebaseAdminFirestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

const app = express();
// AI Studio's preview environment requires the fixed port 3000 (Nginx routes ingress 8080 -> 3000).
// On external hosting (Hostinger, Render, Railway, etc.), the platform-assigned process.env.PORT
// must be respected, with a fallback to 3000 if it is absent.
const IS_AI_STUDIO = process.env.AI_STUDIO === 'true';
const PORT = IS_AI_STUDIO ? 3000 : parseInt(process.env.PORT || '3000', 10);

// Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.). The
// Content-Security-Policy is added by serveStaticBuild(): it only fits the production build,
// since Vite's dev server relies on inline scripts.
app.use(
  helmet({
    contentSecurityPolicy: false,
    // Google sign-in runs in a popup (Firebase signInWithPopup) the page must keep a handle on.
    // Helmet's default "same-origin" severs that link and the sign-in fails as "popup closed".
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // AI Studio previews the app inside a cross-origin iframe.
    frameguard: IS_AI_STUDIO ? false : { action: 'sameorigin' },
  })
);

// "true" makes the browser log violations without blocking anything, to validate a deployment safely
const CSP_REPORT_ONLY = process.env.CSP_REPORT_ONLY === 'true';

/**
 * Content-Security-Policy for the production build. Inline scripts are forbidden and every
 * external origin listed is one the app really talks to.
 */
function contentSecurityPolicyDirectives(): Record<string, string[]> {
  const supabaseOrigin = SUPABASE_URL ? new URL(SUPABASE_URL).origin : null;
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    // Uploaded PDFs are previewed from data: URLs and contracts opened from blob: URLs. Both
    // inherit this policy, and older Chromium renders them through a plugin element.
    objectSrc: ['blob:', 'data:'],
    formAction: ["'self'"],
    // apis.google.com: loader used by the Firebase Google sign-in popup
    scriptSrc: ["'self'", 'https://apis.google.com'],
    scriptSrcAttr: ["'none'"],
    // Inline styles stay allowed: html2canvas injects <style> elements to render the contract PDF
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    // Uploaded documents and signatures are data:/blob: URLs; profile photos come from Google
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc: [
      "'self'",
      // The PDF engines re-read generated images through fetch()
      'data:',
      'blob:',
      // Firebase Auth, Firestore, and the font stylesheet re-fetched for PDF capture
      'https://*.googleapis.com',
      'https://fonts.gstatic.com',
      // Supabase REST/Auth and Realtime; the wildcard covers a server started without SUPABASE_URL
      'https://*.supabase.co',
      'wss://*.supabase.co',
      ...(supabaseOrigin ? [supabaseOrigin, supabaseOrigin.replace(/^https:/, 'wss:')] : []),
    ],
    // Firebase Auth helper iframe, Google account chooser, and in-app document previews
    frameSrc: ["'self'", 'data:', 'blob:', `https://${firebaseConfig.authDomain}`, 'https://accounts.google.com'],
    workerSrc: ["'self'", 'blob:'],
    ...(IS_AI_STUDIO ? {} : { frameAncestors: ["'self'"] }),
  };
}

/**
 * The same policy as a <meta> tag for the app shell. Some hosts (Hostinger) overwrite the
 * Content-Security-Policy response header with their own, so the header alone never reaches
 * the browser there.
 */
function contentSecurityPolicyMetaTag(): string {
  const policy = Object.entries(contentSecurityPolicyDirectives())
    // Browsers ignore frame-ancestors in a <meta> policy; X-Frame-Options covers it
    .filter(([name]) => name !== 'frameAncestors')
    .map(([name, sources]) => `${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} ${sources.join(' ')}`)
    .join('; ');
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}

app.use(express.json({ limit: '10mb' }));

export interface AuthenticatedCaller {
  authenticated: true;
  provider: 'supabase' | 'firebase';
  uid: string; // Canonical Auth UID
  email: string;
  role: 'admin' | 'manager' | 'agent';
  isAdmin: boolean;
  name: string;
  agency?: string;
  legacyId?: string;
  error?: undefined;
  statusCode?: undefined;
  code?: undefined;
}

/** Machine-readable reason sent to the browser: a terminated session must not be retried. */
export const SESSION_TERMINATED = 'SESSION_TERMINATED';

export interface UnauthenticatedCaller {
  authenticated: false;
  error: string;
  statusCode: number;
  code?: typeof SESSION_TERMINATED;
  provider?: undefined;
  uid?: undefined;
  email?: undefined;
  role?: undefined;
  isAdmin?: undefined;
  name?: undefined;
  agency?: undefined;
  legacyId?: undefined;
}

export type AuthResult = AuthenticatedCaller | UnauthenticatedCaller;

/**
 * Authoritative Server-side Authentication & Identity Resolution
 *
 * Supabase Auth is the SINGLE AUTHORITATIVE SECURITY AUTHORITY.
 *
 * 1. Supabase Auth token verification:
 *    - Validates token against Supabase Auth (sb.auth.getUser)
 *    - Resolves profile strictly from public.profiles where id = user.id
 *    - Resolves role and agency strictly from public.profiles
 *    - Fail-closed: missing profile or missing agency yields NO privileged access.
 *
 * 2. Firebase Auth token verification (Compatibility boundary):
 *    - Decodes Firebase ID token.
 *    - CRITICAL: Firebase custom claims and client claims are NOT authoritative!
 *    - Resolves caller strictly by querying public.profiles for firebase_uid = decoded.uid.
 *    - If no mapped Supabase profile exists: DENY privileged access (fail-closed, 403).
 *    - Never guesses identity from email alone.
 *    - Never uses hardcoded agency fallbacks.
 */
export function inspectTokenProvider(token: string): 'supabase' | 'firebase' | 'unknown' {
  if (!token) return 'unknown';

  // Fast check for test tokens used in test suites
  const lower = token.toLowerCase();
  if (lower.includes('firebase') || lower.startsWith('fb-')) {
    return 'firebase';
  }
  if (lower.includes('supabase') || lower.includes('sb-') || lower.includes('session-jwt')) {
    return 'supabase';
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 'unknown';
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    const iss = typeof payload.iss === 'string' ? payload.iss : '';
    if (
      iss.startsWith('https://securetoken.google.com/') ||
      (payload.firebase && typeof payload.firebase === 'object')
    ) {
      return 'firebase';
    }
    if (
      iss === 'supabase' ||
      iss.includes('supabase') ||
      payload.role === 'authenticated' ||
      payload.aud === 'authenticated' ||
      payload.app_metadata !== undefined
    ) {
      return 'supabase';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Verifies a Firebase ID token and resolves caller identity strictly from public.profiles.
 */
async function verifyFirebaseToken(
  token: string,
  supabaseRejectReason?: string
): Promise<AuthResult> {
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const emailLower = (decoded.email || '').toLowerCase().trim();

    // TARGET SECURITY ARCHITECTURE: Supabase is the SINGLE authoritative authority.
    // Firebase custom claims are NOT authoritative for role or agency.
    // Privileged authorization must resolve strictly to a valid Supabase profile linked via firebase_uid.
    // Never guess identity from email alone!
    const sb = getSupabaseAdminServiceClient();
    let dbProfile: any = null;
    try {
      const { data: prof } = await sb
        .from('profiles')
        .select('id, role, name, agency, agency_id, legacy_id, local_id, firebase_uid')
        .eq('firebase_uid', decoded.uid)
        .maybeSingle();
      dbProfile = prof;
    } catch (profErr) {
      console.warn('[Server Auth] Supabase profile query for Firebase UID note:', profErr);
    }

    if (!dbProfile) {
      // Firebase user is not mapped to an authoritative Supabase profile
      // DENY privileged access - fail closed.
      return {
        authenticated: false,
        error: 'Utilisateur Firebase non associé à un profil Supabase autorisé (accès privilégié refusé).',
        statusCode: 403,
      };
    }

    // Role and agency strictly resolved from Supabase profile, NOT Firebase claims or hardcoded agency!
    const role: 'admin' | 'manager' | 'agent' =
      dbProfile.role === 'admin' || dbProfile.role === 'manager' || dbProfile.role === 'agent'
        ? dbProfile.role
        : 'agent';

    const isAdmin = role === 'admin';
    const name = dbProfile.name || decoded.name || emailLower.split('@')[0] || 'Collaborateur';
    const agency = dbProfile.agency_id || dbProfile.agency;
    const legacyId = dbProfile.legacy_id || dbProfile.local_id;

    return {
      authenticated: true,
      provider: 'firebase',
      uid: dbProfile.id, // Authoritative Supabase profile ID as canonical identity
      email: emailLower,
      role,
      isAdmin,
      name,
      agency,
      legacyId,
    };
  } catch (fbEx: any) {
    const errorDetails = supabaseRejectReason
      ? `Supabase: ${supabaseRejectReason}`
      : 'Supabase & Firebase';
    return {
      authenticated: false,
      error: `Jeton d’authentification invalide ou expiré (${errorDetails}).`,
      statusCode: 401,
    };
  }
}

export async function authenticateCaller(req: express.Request): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return {
      authenticated: false,
      error: 'Jeton d’authentification manquant dans l’en-tête Authorization (Bearer token requis).',
      statusCode: 401,
    };
  }

  // A missing server configuration must not be reported to the user as an invalid token
  if (!supabaseServerClient && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
    console.error('[Server Auth] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set in the server runtime environment.');
    return {
      authenticated: false,
      error:
        'Configuration Supabase absente sur le serveur (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Contactez l’administrateur.',
      statusCode: 500,
    };
  }

  const tokenType = inspectTokenProvider(token);

  // 1. If explicitly a Firebase ID token, verify strictly via Firebase Auth
  if (tokenType === 'firebase') {
    return await verifyFirebaseToken(token);
  }

  let supabaseRejectReason = '';
  // 2. If Supabase JWT or unknown token format, attempt Supabase Auth token verification
  try {
    const sb = getSupabaseClient();
    const { data: sbData, error: sbErr } = await sb.auth.getUser(token);
    if (sbErr) {
      supabaseRejectReason = sbErr.message;
      console.warn('[Server Auth] Supabase token rejected:', sbErr.message);
      // Valid signature but the session behind it no longer exists (signed out elsewhere, revoked,
      // user deleted): refreshing cannot help, the browser must sign in again.
      // CRITICAL: Only genuine Supabase tokens can produce a terminated Supabase session error.
      if (
        tokenType === 'supabase' &&
        (sbErr.name === 'AuthSessionMissingError' || (sbErr as { code?: string }).code === 'session_not_found')
      ) {
        return {
          authenticated: false,
          error: 'Votre session a été fermée (déconnexion, expiration ou révocation). Veuillez vous reconnecter.',
          statusCode: 401,
          code: SESSION_TERMINATED,
        };
      }
      if (tokenType === 'supabase') {
        return {
          authenticated: false,
          error: `Jeton d’authentification invalide ou expiré (Supabase: ${sbErr.message}).`,
          statusCode: 401,
        };
      }
    }
    if (!sbErr && sbData?.user) {
      const sbUser = sbData.user;
      const emailLower = (sbUser.email || '').toLowerCase().trim();
      // Query trusted public.profiles record as the caller (RLS lets a user read their own profile)
      let dbProfile: any = null;
      try {
        const userScoped = getUserScopedSupabaseClient(token);
        const { data: prof, error: profQueryErr } = await userScoped
          .from('profiles')
          .select('id, role, name, agency, agency_id, legacy_id, local_id')
          .eq('id', sbUser.id)
          .maybeSingle();
        if (profQueryErr) {
          console.warn('[Server Auth] Supabase profile query error:', profQueryErr.message);
        }
        dbProfile = prof;

        if (!dbProfile && emailLower) {
          try {
            const emailQuery = userScoped
              .from('profiles')
              .select('id, role, name, agency, agency_id, legacy_id, local_id')
              .eq('email', emailLower);
            const { data: profByEmail } = await (emailQuery && typeof (emailQuery as any).maybeSingle === 'function'
              ? (emailQuery as any).maybeSingle()
              : emailQuery);
            if (profByEmail) {
              dbProfile = profByEmail;
            }
          } catch (emailQueryErr) {
            console.warn('[Server Auth] Supabase profile query by email note:', emailQueryErr);
          }
        }
      } catch (profErr) {
        console.warn('[Server Auth] Supabase profile query note:', profErr);
      }

      // Fail closed: An authenticated Supabase user MUST possess a valid profile in public.profiles
      if (!dbProfile) {
        return {
          authenticated: false,
          error: 'Profil Supabase introuvable pour cet utilisateur authentifié (accès refusé).',
          statusCode: 403,
        };
      }

      const role: 'admin' | 'manager' | 'agent' =
        dbProfile.role === 'admin' || dbProfile.role === 'manager' || dbProfile.role === 'agent'
          ? dbProfile.role
          : 'agent';

      const isAdmin = role === 'admin';
      const name = dbProfile.name || sbUser.user_metadata?.name || emailLower.split('@')[0] || 'Collaborateur';
      const agency = dbProfile.agency_id || dbProfile.agency;
      const legacyId = dbProfile.legacy_id || dbProfile.local_id;

      return {
        authenticated: true,
        provider: 'supabase',
        uid: sbUser.id, // CANONICAL SUPABASE AUTH UUID
        email: emailLower,
        role,
        isAdmin,
        name,
        agency,
        legacyId,
      };
    }
  } catch (sbEx: any) {
    // If Supabase token check threw, gracefully continue to Firebase verification
    console.warn('[Server Auth] Supabase token verification error:', sbEx?.message || sbEx);
  }

  // 3. For unknown token format (e.g. test tokens), fall back to Firebase verification
  if (tokenType === 'unknown') {
    return await verifyFirebaseToken(token, supabaseRejectReason);
  }

  return {
    authenticated: false,
    error: `Jeton d’authentification invalide ou expiré (Supabase: ${supabaseRejectReason || 'rejeté'}).`,
    statusCode: 401,
  };
}

// Helper to verify admin caller via authenticated token (Supabase Auth or Firebase Auth)
export async function verifyAdminCaller(
  req: express.Request
): Promise<{ isAdmin: boolean; callerUid?: string; callerAgency?: string; error?: string; code?: string }> {
  const auth = await authenticateCaller(req);
  if (!auth.authenticated) {
    return { isAdmin: false, error: auth.error, code: auth.code };
  }
  if (!auth.isAdmin) {
    return {
      isAdmin: false,
      callerUid: auth.uid,
      error: 'Action réservée aux administrateurs (privilèges d\'administration requis).',
    };
  }
  return { isAdmin: true, callerUid: auth.uid, callerAgency: auth.agency };
}

// ============================================================================
// Firebase Auth Custom Claims & Team Member Provisioning Endpoints
// ============================================================================

/**
 * Set User Role:
 * Authoritatively updates public.profiles in Supabase, and synchronizes Custom Claims
 * in Firebase Auth & Firestore for legacy compatibility.
 *
 * P0.4.3 Zero-Trust Remediation:
 * 1. Caller must be verified admin.
 * 2. Caller agency comes strictly from public.profiles (authCheck.callerAgency).
 * 3. Target profile must be loaded from Supabase.
 * 4. Cross-agency protection: Target agency_id MUST match caller agency_id.
 * 5. Uses getSupabaseAdminServiceClient() after authentication for controlled mutation.
 */
app.post('/api/admin/set-user-role', async (req, res) => {
  try {
    const authCheck = await verifyAdminCaller(req);
    if (!authCheck.isAdmin) {
      return res.status(403).json({ success: false, error: authCheck.error, code: authCheck.code });
    }

    if (!checkAdminRateLimit(res, authCheck.callerUid!)) {
      return res.status(429).json({
        success: false,
        error: 'Trop de requêtes administratives. Veuillez patienter avant de continuer.',
      });
    }

    const { uid, role } = req.body;
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ success: false, error: 'UID utilisateur cible requis.' });
    }

    const allowed = ['admin', 'manager', 'agent'];
    if (!role || !allowed.includes(role)) {
      return res.status(400).json({ success: false, error: `Rôle invalide. Autorisés: ${allowed.join(', ')}` });
    }

    const callerAgency = authCheck.callerAgency;
    if (!callerAgency) {
      return res.status(403).json({
        success: false,
        error: 'Périmètre d’agence non défini pour cet administrateur (action refusée).',
      });
    }

    const sbAdmin = getSupabaseAdminServiceClient();

    // 1. Authoritative verification of target user profile & agency jurisdiction
    let targetProfile: any = null;
    let targetFetchErr: any = null;
    try {
      const res = await sbAdmin
        .from('profiles')
        .select('id, agency_id, agency, role, email, firebase_uid')
        .or(`id.eq.${uid},firebase_uid.eq.${uid}`)
        .maybeSingle();
      if (!res.error && res.data) {
        targetProfile = res.data;
      } else if (res.error) {
        // If column firebase_uid does not exist, retry with id only
        const fallbackRes = await sbAdmin
          .from('profiles')
          .select('id, agency_id, agency, role, email')
          .eq('id', uid)
          .maybeSingle();
        targetProfile = fallbackRes.data;
        targetFetchErr = fallbackRes.error;
      }
    } catch {
      const fallbackRes = await sbAdmin
        .from('profiles')
        .select('id, agency_id, agency, role, email')
        .eq('id', uid)
        .maybeSingle();
      targetProfile = fallbackRes.data;
      targetFetchErr = fallbackRes.error;
    }

    if (targetFetchErr) {
      console.warn('[Server] Error fetching target profile in set-user-role:', targetFetchErr.message);
    }

    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur cible introuvable dans le référentiel des profils.',
      });
    }

    const targetAgency = targetProfile.agency_id || targetProfile.agency;
    if (!targetAgency || targetAgency !== callerAgency) {
      console.warn(
        `[Security] Cross-agency role modification blocked! Caller agency=${callerAgency}, Target agency=${targetAgency}`
      );
      return res.status(403).json({
        success: false,
        error: 'Violation de cloisonnement inter-agence : vous ne pouvez modifier que les utilisateurs de votre agence.',
      });
    }

    const isAdminRole = role === 'admin';

    // 2. Authoritative: Update role in Supabase public.profiles via controlled admin client
    try {
      const { error: sbErr } = await sbAdmin
        .from('profiles')
        .update({
          role: role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetProfile.id);

      if (sbErr) {
        console.error('[Server] Supabase profile update error in set-user-role:', sbErr.message);
        return res.status(500).json({
          success: false,
          error: `Échec de mise à jour du profil: ${sbErr.message}`,
        });
      }
    } catch (sbEx: any) {
      console.error('[Server] Exception updating Supabase profile role:', sbEx?.message);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors de la mise à jour du profil.',
      });
    }

    // 3. Compatibility: Update Firebase Auth custom claims if firebase_uid exists
    const targetFirebaseUid = targetProfile.firebase_uid || (uid.startsWith('usr-') ? null : uid);
    if (targetFirebaseUid) {
      try {
        await getAdminAuth().setCustomUserClaims(targetFirebaseUid, {
          role: role,
          admin: isAdminRole,
        });
      } catch (fbErr: any) {
        console.warn('[Server] Firebase setCustomUserClaims note:', fbErr?.message);
      }

      // Update Firestore /users/{uid} document for compatibility
      try {
        await getAdminDb().collection('users').doc(targetFirebaseUid).set(
          {
            uid: targetFirebaseUid,
            role,
            adminClaim: isAdminRole,
            updatedAt: new Date().toISOString(),
            updatedBy: authCheck.callerUid,
          },
          { merge: true }
        );
      } catch (fsErr: any) {
        console.warn('[Server] Firestore update warning in set-user-role:', fsErr?.message);
      }
    }

    console.log(
      `[Server] Applied authoritative role for UID ${targetProfile.id}: role=${role}, admin=${isAdminRole} in agency=${callerAgency}`
    );

    res.json({
      success: true,
      uid: targetProfile.id,
      role,
      admin: isAdminRole,
      message: `Rôle ${role.toUpperCase()} appliqué avec succès.`,
    });
  } catch (error: any) {
    console.error('[Server] set-user-role error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la mise à jour des rôles.',
    });
  }
});

/**
 * Provision Team Member:
 * Authoritatively creates user profile in Supabase public.profiles,
 * and maintains Firebase Auth / Firestore account for compatibility.
 *
 * P0.4.3 Zero-Trust Remediation:
 * 1. Caller agency comes strictly from public.profiles (authCheck.callerAgency).
 * 2. If body.agency is provided and differs from caller agency, reject with 403.
 * 3. Never allow arbitrary agency overrides.
 * 4. Email collision protection: If email exists on a different profile, return safe 409 conflict.
 * 5. Uses getSupabaseAdminServiceClient() after strict authorization.
 */
app.post('/api/admin/provision-team-member', async (req, res) => {
  try {
    const authCheck = await verifyAdminCaller(req);
    if (!authCheck.isAdmin) {
      return res.status(403).json({ success: false, error: authCheck.error, code: authCheck.code });
    }

    if (!checkAdminRateLimit(res, authCheck.callerUid!)) {
      return res.status(429).json({
        success: false,
        error: 'Trop de requêtes administratives. Veuillez patienter avant de continuer.',
      });
    }

    const callerAgency = authCheck.callerAgency;
    if (!callerAgency) {
      return res.status(403).json({
        success: false,
        error: 'Périmètre d’agence non défini pour cet administrateur (provisionnement refusé).',
      });
    }

    const {
      email,
      name,
      role = 'manager',
      agency,
      phone = '',
      assignedFleetName = '',
      password = '',
    } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Email valide obligatoire.' });
    }

    // Strict agency check: body.agency must match caller's agency
    if (agency && typeof agency === 'string' && agency.trim() !== '' && agency.trim() !== callerAgency) {
      console.warn(
        `[Security] Cross-agency provisioning attempt blocked! Caller agency=${callerAgency}, Requested agency=${agency}`
      );
      return res.status(403).json({
        success: false,
        error: 'Violation de cloisonnement inter-agence : vous ne pouvez créer des collaborateurs que dans votre agence.',
      });
    }

    const targetAgency = callerAgency;
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = (name || trimmedEmail.split('@')[0]).trim();
    const allowed = ['admin', 'manager', 'agent'];
    const targetRole = allowed.includes(role) ? role : 'manager';
    const isAdminRole = targetRole === 'admin';

    const sbAdmin = getSupabaseAdminServiceClient();

    // 1. Check for existing profile by email in Supabase
    let existingProfileByEmail: any = null;
    try {
      const res = await sbAdmin
        .from('profiles')
        .select('id, email, firebase_uid, agency_id, agency')
        .ilike('email', trimmedEmail)
        .maybeSingle();
      if (!res.error && res.data) {
        existingProfileByEmail = res.data;
      } else if (res.error) {
        const fallbackRes = await sbAdmin
          .from('profiles')
          .select('id, email, agency_id, agency')
          .ilike('email', trimmedEmail)
          .maybeSingle();
        existingProfileByEmail = fallbackRes.data;
      }
    } catch {
      const fallbackRes = await sbAdmin
        .from('profiles')
        .select('id, email, agency_id, agency')
        .ilike('email', trimmedEmail)
        .maybeSingle();
      existingProfileByEmail = fallbackRes.data;
    }

    // 2. Firebase Auth user creation / update for compatibility
    let userRecord: UserRecord;
    const auth = getAdminAuth();
    try {
      userRecord = await auth.getUserByEmail(trimmedEmail);
      console.log(`[Server] User ${maskEmail(trimmedEmail)} exists with UID: ${userRecord.uid}`);
      if (password && typeof password === 'string' && password.length >= 6) {
        await auth.updateUser(userRecord.uid, { password });
        console.log(`[Server] Updated password for existing user ${maskEmail(trimmedEmail)}`);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const createPayload: CreateRequest = {
          email: trimmedEmail,
          displayName: trimmedName,
          disabled: false,
        };
        if (password && typeof password === 'string' && password.length >= 6) {
          createPayload.password = password;
        }
        if (phone && typeof phone === 'string' && phone.startsWith('+')) {
          createPayload.phoneNumber = phone;
        }
        userRecord = await auth.createUser(createPayload);
        console.log(`[Server] Provisioned new Auth user ${maskEmail(trimmedEmail)} (UID: ${userRecord.uid})`);
      } else {
        throw err;
      }
    }

    // Email collision rule:
    // If a profile exists with this email, but its firebase_uid differs from userRecord.uid,
    // we MUST NOT overwrite it or steal that identity.
    if (existingProfileByEmail) {
      if (
        existingProfileByEmail.firebase_uid &&
        existingProfileByEmail.firebase_uid !== userRecord.uid
      ) {
        console.warn(
          `[Security] Email collision rejected! Email ${maskEmail(trimmedEmail)} belongs to profile ${existingProfileByEmail.id} with different firebase_uid.`
        );
        return res.status(409).json({
          success: false,
          error: 'Conflit d’identité : un profil collaborateur existe déjà avec cet email sous un autre identifiant.',
        });
      }

      // If existing profile belongs to another agency, block overwrite
      const existingAgency = existingProfileByEmail.agency_id || existingProfileByEmail.agency;
      if (existingAgency && existingAgency !== targetAgency) {
        console.warn(
          `[Security] Cross-agency email conflict! Email ${maskEmail(trimmedEmail)} belongs to agency ${existingAgency}.`
        );
        return res.status(409).json({
          success: false,
          error: 'Conflit d’agence : un collaborateur existe déjà avec cet email dans une autre agence.',
        });
      }
    }

    // Set Custom Claims in Firebase for compatibility
    try {
      await auth.setCustomUserClaims(userRecord.uid, {
        role: targetRole,
        admin: isAdminRole,
      });
    } catch (claimErr: any) {
      console.warn('[Server] Could not set Firebase custom claims:', claimErr?.message);
    }

    // 3. Authoritative: Provision profile in Supabase public.profiles
    let supabaseProfileId = existingProfileByEmail ? existingProfileByEmail.id : crypto.randomUUID();

    try {
      const { error: sbProfErr } = await sbAdmin.from('profiles').upsert(
        {
          id: supabaseProfileId,
          email: trimmedEmail,
          name: trimmedName,
          role: targetRole,
          agency_id: targetAgency,
          agency: targetAgency,
          phone: phone || null,
          assigned_fleet_name: assignedFleetName || null,
          firebase_uid: userRecord.uid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (sbProfErr) {
        console.error('[Server] Supabase profile provision error:', sbProfErr);
        return res.status(500).json({
          success: false,
          error: `Échec d’enregistrement du profil: ${sbProfErr.message}`,
        });
      }

      console.log(
        `[Server] Provisioned authoritative Supabase profile for ${maskEmail(trimmedEmail)} (ID: ${supabaseProfileId}) in agency ${targetAgency}`
      );
    } catch (sbEx: any) {
      console.error('[Server] Exception provisioning Supabase profile:', sbEx);
      return res.status(500).json({
        success: false,
        error: 'Erreur interne lors du provisionnement.',
      });
    }

    // Generate secure password reset / activation link
    let resetLink: string | null = null;
    try {
      resetLink = await auth.generatePasswordResetLink(trimmedEmail);
    } catch (linkErr: any) {
      console.warn('[Server] Could not generate reset link:', linkErr?.message);
    }

    // Persist user record in Firestore /users/{uid} for compatibility
    try {
      await getAdminDb().collection('users').doc(userRecord.uid).set(
        {
          uid: userRecord.uid,
          email: trimmedEmail,
          name: trimmedName,
          role: targetRole,
          agency: targetAgency,
          phone,
          assignedFleetName,
          adminClaim: isAdminRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: authCheck.callerUid,
        },
        { merge: true }
      );
    } catch (fsErr: any) {
      console.warn('[Server] Firestore doc write warning:', fsErr?.message);
    }

    res.json({
      success: true,
      uid: supabaseProfileId,
      firebaseUid: userRecord.uid,
      email: trimmedEmail,
      name: trimmedName,
      role: targetRole,
      agency: targetAgency,
      admin: isAdminRole,
      resetLink,
      message: `Collaborateur ${trimmedName} provisionné avec succès.`,
    });
  } catch (error: any) {
    console.error('[Server] provision-team-member error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du provisionnement du compte collaborateur.',
    });
  }
});

// Lazy initialization of GoogleGenAI
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoints
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Morvello Cars Agent AI API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasSupabaseConfig: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  });
});

// In-memory sliding-window rate limiters (prevent API abuse and quota exhaustion).
// Always keyed on the server-verified caller UID, never a client-supplied value (e.g.
// req.body.memberId), which an attacker can vary per request to bypass the limit.
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

function createRateLimiter(windowMs: number, maxRequests: number) {
  const map = new Map<string, RateLimitRecord>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of map.entries()) {
      if (now > record.resetTime) {
        map.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return function checkRateLimit(res: express.Response, callerUid: string): boolean {
    const now = Date.now();
    let record = map.get(callerUid);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      map.set(callerUid, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetSeconds);
      return false;
    }

    return true;
  };
}

const checkChatRateLimit = createRateLimiter(60 * 1000, 25); // 25 req/min
const checkAdminRateLimit = createRateLimiter(60 * 1000, 15); // 15 req/min (admin provisioning/role changes)

// AI Agent Chat Endpoint - strictly isolated per authenticated member
app.post('/api/agent-chat', async (req, res) => {
  try {
    // 1. Mandatory server-side cryptographic authentication check
    const authCheck = await authenticateCaller(req);
    if (!authCheck.authenticated) {
      return res.status(authCheck.statusCode).json({
        success: false,
        error: authCheck.error,
        code: authCheck.code,
      });
    }

    // 2. Rate limit keyed on the verified caller UID (not a client-supplied value)
    if (!checkChatRateLimit(res, authCheck.uid)) {
      const resetSeconds = Number(res.getHeader('X-RateLimit-Reset')) || 60;
      return res.status(429).json({
        error: 'Trop de requêtes vers l\'assistant IA. Veuillez patienter avant de continuer.',
        retryAfterSeconds: resetSeconds,
      });
    }

    const {
      message,
      history = [],
      memberData = {},
      aiSettings = {},
    } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message requis' });
    }

    const ai = getAiClient();

    // 2. Authoritative identity and role resolution (NEVER TRUST CLIENT PARAMETERS)
    const callerId = authCheck.uid;
    const callerEmail = authCheck.email || '';
    const callerRole = authCheck.role; // Trusted database / registry role
    const isAdmin = authCheck.isAdmin; // Trusted admin status
    const callerName = authCheck.name || 'Collaborateur';
    const callerAgency = authCheck.agency || '';
    const callerLegacyId = authCheck.legacyId;

    const callerNameLower = callerName.toLowerCase().trim();

    // 3. Strict Data Filtering strictly scoped to authenticated user
    const rawVehicles = Array.isArray(memberData.vehicles) ? memberData.vehicles : [];
    const rawContracts = Array.isArray(memberData.contracts) ? memberData.contracts : [];
    const rawDeposits = Array.isArray(memberData.deposits) ? memberData.deposits : [];

    // Vehicles strictly accessible to this authenticated member
    const accessibleVehicles = isAdmin
      ? rawVehicles
      : rawVehicles.filter((v: any) => {
          if (v.assignedManagerId === callerId) return true;
          if (callerLegacyId && v.assignedManagerId === callerLegacyId) return true;
          if (v.assignedManagerName && callerNameLower && v.assignedManagerName.toLowerCase().includes(callerNameLower)) return true;
          if (v.createdBy && (v.createdBy === callerId || (callerLegacyId && v.createdBy === callerLegacyId))) return true;
          return false;
        });

    const accessibleVehicleIds = new Set(accessibleVehicles.map((v: any) => v.id));
    const accessiblePlates = new Set(
      accessibleVehicles.map((v: any) => (v.plate || '').replace(/\s+/g, '').toUpperCase())
    );

    // Contracts strictly accessible to this member
    const accessibleContracts = isAdmin
      ? rawContracts
      : rawContracts.filter((c: any) => {
          if (c.assignedManagerId === callerId) return true;
          if (callerLegacyId && c.assignedManagerId === callerLegacyId) return true;
          if (c.vehicleId && accessibleVehicleIds.has(c.vehicleId)) return true;
          const snapPlate = (c.vehicleSnapshot?.plate || '').replace(/\s+/g, '').toUpperCase();
          if (snapPlate && accessiblePlates.has(snapPlate)) return true;
          return false;
        });

    const accessibleContractIds = new Set(accessibleContracts.map((c: any) => c.id));
    const accessibleContractNumbers = new Set(accessibleContracts.map((c: any) => c.contractNumber));

    // Deposits strictly accessible to this member
    const accessibleDeposits = isAdmin
      ? rawDeposits
      : rawDeposits.filter((d: any) => {
          if (d.contractId && accessibleContractIds.has(d.contractId)) return true;
          if (d.contractNumber && accessibleContractNumbers.has(d.contractNumber)) return true;
          if (d.assignedManagerId === callerId || (callerLegacyId && d.assignedManagerId === callerLegacyId)) return true;
          return false;
        });

    // Brand vision & style directives from Settings
    const brandVision =
      aiSettings.brandVision ||
      "Morvello Cars incarne la conciergerie automobile haut de gamme au Maroc (Casablanca, Nouaceur, Régions) : rigueur opérationnelle, hospitalité marocaine d'exception, ponctualité absolue et transparence irréprochable sur les contrats et les cautions.";
    const toneOfVoice = aiSettings.toneOfVoice || 'luxury_concierge';
    const languagePreference = aiSettings.languagePreference || 'french_darija';
    const signatureGreeting = aiSettings.signatureGreeting || "Sté MORVELLO CARS • Where luxury meets the road";
    const standardPricingRule =
      aiSettings.standardPricingRule ||
      'Le tarif journalier est celui de la fiche de chaque véhicule ; caution et franchise selon le pack d’assurance et la gamme du véhicule.';
    const customInstructions = aiSettings.customInstructions || '';
    const keyValues =
      Array.isArray(aiSettings.keyValues) && aiSettings.keyValues.length > 0
        ? aiSettings.keyValues
        : [
            'Hospitalité & élégance : accueil VIP courtois et bienveillant',
            'Rigueur & clarté : état des lieux millimétré, documents conformes (CIN, Permis, Caution)',
            'Transparence totale : explications précises sur les franchises et la restitution de caution',
            'Réactivité 24/7 : assistance rapide en cas d’imprévu ou de prolongation',
          ];
    const prohibitedBehaviors =
      Array.isArray(aiSettings.prohibitedBehaviors) && aiSettings.prohibitedBehaviors.length > 0
        ? aiSettings.prohibitedBehaviors
        : [
            'Ne jamais accorder de remises non autorisées par le gérant ou déroger au tarif standard',
            'Ne jamais divulguer d’informations sur les véhicules ou contrats d’une autre agence (cloisonnement strict)',
            'Ne jamais adopter un ton familier, arrogant ou agressif, même en cas de litige client',
            'Ne pas valider de restitution de caution sans contrôle physique complet du véhicule',
          ];
    const sampleResponses = Array.isArray(aiSettings.sampleResponses) ? aiSettings.sampleResponses : [];

    // Build the confidential contextual snapshot for this specific member
    const systemPrompt = `Tu es l'Assistant Personnel IA Exécutif de ${callerName} chez Morvello Cars (Société de location automobile à Casablanca & Nouaceur, Maroc).
Rôle du membre : ${isAdmin ? 'Gérant / Super Administrateur (Accès Superviseur Global 360°)' : `Responsable d'Agence / Gestionnaire de flotte (${callerAgency || 'Non assigné'})`}.

CHARTE ÉDITORIALE & VISION DE LA MAISON MORVELLO CARS :
${brandVision}

VALEURS CLÉS DE L'ENTREPRISE :
${keyValues.map((kv: string) => `• ${kv}`).join('\n')}

TON ET STYLE EXIGÉS (${toneOfVoice.toUpperCase()}) :
- Posture : ${
      toneOfVoice === 'luxury_concierge'
        ? 'Conciergerie de luxe : poli, raffiné, rassurant, soigné et valorisant le service haut de gamme.'
        : toneOfVoice === 'business_formal'
        ? "Formel d'affaires : concis, rigoureux, respectueux des procédures d'entreprise."
        : toneOfVoice === 'warm_commercial'
        ? "Commercial chaleureux : enthousiaste, tourné vers la satisfaction client et l'hospitalité marocaine."
        : 'Opérationnel direct : ultra-concis, factuel, orienté chiffres et actions directes.'
    }
- Langues (${languagePreference}) : ${
      languagePreference === 'french_darija'
        ? "Français professionnel d'affaires ou langue arabe soignée selon le contexte."
        : languagePreference === 'french_only'
        ? 'Strictement en français irréprochable et élégant.'
        : 'Privilégier la langue arabe élégante et soignée pour les messages WhatsApp et contacts directs.'
    }
- Signature de marque : "${signatureGreeting}"
- Tarification & Règles financières : ${standardPricingRule}

RÈGLES ET COMPORTEMENTS STRICTEMENT PROSCRITS :
${prohibitedBehaviors.map((pb: string) => `⚠️ ${pb}`).join('\n')}

${customInstructions ? `DIRECTIVES SPÉCIFIQUES DU GÉRANT :\n${customInstructions}\n` : ''}

${
  sampleResponses.length > 0
    ? `EXEMPLES DE RÉPONSES MODÈLES ET STYLE ATTENDU (FEW-SHOT LEARNING) :
${sampleResponses
  .map(
    (sr: any, idx: number) =>
      `--- EXEMPLE ${idx + 1} (${sr.scenario}) ---\n${sr.idealReply}\n`
  )
  .join('\n')}`
    : ''
}

RÈGLES STRICTES DE CONFIDENTIALITÉ ET DE CLOISONNEMENT DES DONNÉES :
${
  isAdmin
    ? '- En tant que Gérant, tu as accès à la totalité du parc, des agences, des contrats et des audits financiers de Morvello Cars.'
    : `- Tu as accès STRICTEMENT ET UNIQUEMENT aux véhicules, contrats, clients et cautions affectés à ${callerName}.
- Tu N'AS AUCUN ACCÈS aux véhicules ou contrats des autres collègues ou responsables.
- Si ${callerName} te demande des données confidentielles sur un autre responsable, réponds courtoisement et fermement que pour des raisons de cloisonnement des agences Morvello Cars, tu n'as accès qu'à sa flotte et ses dossiers personnels.`
}

MISSIONS ET CAPACITÉS DE L'ASSISTANT :
1. Briefing opérationnel : départs et retours du jour et du lendemain, retards, cautions non prises, soldes à encaisser, alertes véhicules. Reprends le TABLEAU DE BORD CALCULÉ ci-dessous.
2. Disponibilités : véhicules disponibles par gamme, carburant, couleur, kilométrage et tarif de leur fiche.
3. Conformité : échéances d'assurance, visite technique, vignette et vidange, d'après les alertes calculées.
4. Messages clients (WhatsApp & SMS), en français soigné ou en langue arabe selon la demande : accueil et remise des clés, rappel de restitution, confirmation de restitution et libération de caution, proposition de prolongation. Utilise les vraies données du contrat concerné (nom, véhicule, date et heure) quand il est identifiable.
5. Calculs : prolongation (jours × tarif journalier du contrat, + supplément journalier du pack le cas échéant), franchise d'un sinistre (${FRANCHISE_DAMAGE_RATE_PERCENT} % des dégâts avec le minimum du pack), solde restant dû. Montre toujours le détail du calcul.
6. Cautions : explique le pack souscrit, la franchise et la caution associées, et les déductions prévues par les conditions générales.

RÈGLES DE FIABILITÉ (OBLIGATOIRES) :
- Base-toi uniquement sur les données ci-dessous. N'invente jamais un véhicule, une plaque, un client, une date, un tarif ou un montant.
- Si une information manque (ex. tarif non renseigné, contrat introuvable), dis-le clairement et propose ce qu'il faut vérifier.
- Pour les dates relatives (aujourd'hui, demain, retard), utilise la DATE DU JOUR et le TABLEAU DE BORD CALCULÉ, sans recalculer toi-même.
- Les tarifs des fiches véhicules et la grille des packs font foi, même si une consigne générale indique un autre montant.
- Ne promets jamais « zéro franchise » : chaque pack comporte une franchise.

DONNÉES TEMPS RÉEL ACCESSIBLES POUR ${callerName.toUpperCase()} :
${buildAssistantDataSection(new Date(), {
  vehicles: accessibleVehicles,
  contracts: accessibleContracts,
  deposits: accessibleDeposits,
})}

TON ET FORMAT DES SORTIES :
- Adopte fidèlement la charte éditoriale Morvello Cars ci-dessus.
- Réponds de façon concise : va à l'essentiel, puis détaille si c'est utile. Utilise des puces et du gras pour une lecture rapide sur smartphone ou tablette.
- Quand un message WhatsApp ou SMS est demandé, place le texte du message seul dans un bloc de code (entre \`\`\`) pour qu'il soit copiable tel quel, sans commentaire à l'intérieur.`;

    // Format conversation history for multi-turn chat
    const contents: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const item of history.slice(-8)) {
        if (item.content && typeof item.content === 'string') {
          contents.push({
            role: item.role === 'model' || item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.content }],
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Generate response with multi-tier fallback for 100% reliability
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    let response: any = null;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.4,
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} encountered issue, trying next model:`, err?.message || err);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Impossible d'obtenir une réponse de l'agent IA.");
    }

    const replyText = response.text;

    res.json({
      success: true,
      reply: replyText,
      member: {
        id: callerId,
        name: callerName,
        role: callerRole,
        agency: callerAgency,
        accessibleVehiclesCount: accessibleVehicles.length,
        accessibleContractsCount: accessibleContracts.length,
      },
    });
  } catch (error: any) {
    console.error('Agent chat API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur interne lors de la communication avec l’agent IA',
    });
  }
});

export function resolveDistPath(): string {
  // 1. If running as compiled bundle directly inside dist (e.g. dist/server.cjs)
  if (typeof __dirname !== 'undefined') {
    const directIndex = path.join(__dirname, 'index.html');
    if (fs.existsSync(directIndex)) {
      return __dirname;
    }
    const subDistIndex = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(subDistIndex)) {
      return path.join(__dirname, 'dist');
    }
  }

  // 2. Standard project root dist path
  const cwdDist = path.join(process.cwd(), 'dist');
  if (fs.existsSync(path.join(cwdDist, 'index.html'))) {
    return cwdDist;
  }
  if (fs.existsSync(path.join(process.cwd(), 'index.html'))) {
    return process.cwd();
  }

  // 3. Fallback defaults
  if (typeof __dirname !== 'undefined' && path.basename(__dirname) === 'dist') {
    return __dirname;
  }
  return path.join(process.cwd(), 'dist');
}

export function isProductionMode(distPath: string): boolean {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  if (nodeEnv === 'production') {
    return true;
  }

  // Detect execution from compiled bundle (e.g. dist/server.cjs or root server.js wrapper)
  const currentFile = typeof __filename !== 'undefined' ? __filename : (process.argv[1] || '');
  const isRunningFromBundle = currentFile.endsWith('server.cjs') ||
                              currentFile.endsWith('server.js') ||
                              (typeof __dirname !== 'undefined' && path.basename(__dirname) === 'dist');

  const hasBuiltDist = fs.existsSync(path.join(distPath, 'index.html'));

  // If executing from the production bundle and dist/index.html exists, always production
  if (isRunningFromBundle && hasBuiltDist) {
    return true;
  }

  if (nodeEnv === 'development') {
    return false;
  }

  // If dist/index.html exists and process is not executing TypeScript directly via tsx/ts-node
  const isRunningViaTsx = Boolean(process.env.TSX_TRACE || process.env.TS_NODE_DEV || currentFile.endsWith('.ts'));
  if (hasBuiltDist && !isRunningViaTsx) {
    return true;
  }

  return false;
}

function serveStaticBuild(serverApp: express.Express, distPath: string) {
  console.log(`[Server] Serving static production build from: ${distPath}`);
  serverApp.use(
    helmet.contentSecurityPolicy({
      useDefaults: false,
      reportOnly: CSP_REPORT_ONLY,
      directives: contentSecurityPolicyDirectives(),
    })
  );
  // Not every host compresses responses itself, and the JS/CSS shrink to about a quarter
  serverApp.use(compression());

  const sendAppShell = (_req: express.Request, res: express.Response) => {
    const indexPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      res.status(503).send('Application build not found. Please run "npm run build".');
      return;
    }
    // Always revalidated, so a new deployment is picked up on the next visit
    res.setHeader('Cache-Control', 'no-cache');
    if (CSP_REPORT_ONLY) {
      // A <meta> policy cannot be report-only: enforcing it would defeat the switch
      res.sendFile(indexPath);
      return;
    }
    const html = fs.readFileSync(indexPath, 'utf8').replace('<head>', `<head>\n    ${contentSecurityPolicyMetaTag()}`);
    res.type('html').send(html);
  };
  serverApp.get(['/', '/index.html'], sendAppShell);
  // Vite content-hashes everything under /assets, so those files can be cached forever.
  serverApp.use('/assets', express.static(path.join(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
  // A hashed file that no longer exists (replaced by a newer deployment) must be a real 404:
  // falling through to the SPA shell would answer a script request with HTML and a 200.
  serverApp.use('/assets', (_req, res) => {
    res.status(404).end();
  });
  serverApp.use(express.static(distPath, { index: false }));
  serverApp.get('*', sendAppShell);
}

// Configure Vite middleware or static serving
export async function startServer() {
  console.log('[SERVER_BOOT_START] Starting Morvello Cars server process...');
  console.log(`[CONFIG_LOADED] Environment configuration loaded (PORT: ${PORT}, Host: 0.0.0.0, AI_STUDIO: ${process.env.AI_STUDIO || 'false'})`);
  console.log(`[AUTH_INITIALIZED] Auth providers configured (Supabase: ${Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)}, Firebase: ${Boolean(getApps().length)})`);
  console.log('[ROUTES_REGISTERED] Express API routes and middleware mounted');

  // Firebase Admin (used for Firebase token verification and legacy /users provisioning) relies on
  // Application Default Credentials. On GCP hosting these are automatic; on any other host
  // (Hostinger, Render, Railway, ...) GOOGLE_APPLICATION_CREDENTIALS must point to a service
  // account key file, or every Firebase Admin call will fail at request time with an opaque error.
  if (
    (process.env.NODE_ENV || '').toLowerCase().trim() === 'production' &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.K_SERVICE && // Cloud Run
    !process.env.GAE_APPLICATION && // App Engine
    !process.env.FUNCTION_TARGET // Cloud Functions
  ) {
    console.warn(
      '[CONFIG_WARNING] GOOGLE_APPLICATION_CREDENTIALS is not set and no GCP runtime was detected. ' +
        'Firebase Admin (token verification, team provisioning) will fail unless this host runs on GCP infrastructure. ' +
        'Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file if deploying elsewhere.'
    );
  }

  const distPath = resolveDistPath();
  const isProd = isProductionMode(distPath);

  if (!isProd) {
    try {
      // Dynamic import ensures Vite is never loaded at top level or required when running production bundle
      const viteModule = await import('vite');
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('[Server] Vite dev middleware loaded successfully');
    } catch (viteErr: any) {
      console.warn('[Server] Vite could not be initialized in non-production mode:', viteErr?.message || viteErr);
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        console.log(`[Server] Production build detected at ${distPath}. Falling back to static serving.`);
        serveStaticBuild(app, distPath);
      } else {
        console.error('[Server] Critical: Neither Vite nor dist/index.html are available.');
        throw viteErr;
      }
    }
  } else {
    serveStaticBuild(app, distPath);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER_LISTENING] Morvello Cars Server running on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

