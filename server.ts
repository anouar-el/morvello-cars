import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

import crypto from 'crypto';
import { initializeApp, getApps, App as FirebaseAdminApp } from 'firebase-admin/app';
import { getAuth, UserRecord, CreateRequest, Auth as FirebaseAdminAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore as FirebaseAdminFirestore } from 'firebase-admin/firestore';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildAssistantDataSection } from './src/lib/aiAssistantContext';
import { FRANCHISE_DAMAGE_RATE_PERCENT } from './src/data/insurancePacks';

dotenv.config();

// Supabase Server-side Client Configuration
// The browser gets VITE_* values baked in at build time, but the server reads them at runtime:
// on a host where they are only build variables they are missing here, so SUPABASE_* is accepted too.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseServerClient: SupabaseClient | null = null;
let supabaseAdminServiceClient: SupabaseClient | null = null;

export function setSupabaseClient(client: SupabaseClient | null) {
  supabaseServerClient = client;
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
const PORT = process.env.AI_STUDIO === 'true' ? 3000 : parseInt(process.env.PORT || '3000', 10);

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
}

export interface UnauthenticatedCaller {
  authenticated: false;
  error: string;
  statusCode: number;
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

  // 1. First, attempt Supabase Auth token verification (authoritative primary login system)
  try {
    const sb = getSupabaseClient();
    const { data: sbData, error: sbErr } = await sb.auth.getUser(token);
    if (sbErr) {
      console.warn('[Server Auth] Supabase token rejected:', sbErr.message);
    }
    if (!sbErr && sbData?.user) {
      const sbUser = sbData.user;
      const emailLower = (sbUser.email || '').toLowerCase().trim();
      // Query trusted public.profiles record
      let dbProfile: any = null;
      try {
        const { data: prof } = await sb
          .from('profiles')
          .select('id, role, name, agency, agency_id, legacy_id, local_id, firebase_uid')
          .eq('id', sbUser.id)
          .maybeSingle();
        dbProfile = prof;
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

  // 2. Second, attempt Firebase Auth ID token verification (Compatibility boundary)
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    const emailLower = (decoded.email || '').toLowerCase().trim();

    // TARGET SECURITY ARCHITECTURE: Supabase is the SINGLE authoritative authority.
    // Firebase custom claims are NOT authoritative for role or agency.
    // Privileged authorization must resolve strictly to a valid Supabase profile linked via firebase_uid.
    // Never guess identity from email alone!
    const sb = getSupabaseClient();
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
    return {
      authenticated: false,
      error: 'Jeton d’authentification invalide ou expiré (Supabase & Firebase).',
      statusCode: 401,
    };
  }
}

// Helper to verify admin caller via authenticated token (Supabase Auth or Firebase Auth)
export async function verifyAdminCaller(
  req: express.Request
): Promise<{ isAdmin: boolean; callerUid?: string; callerAgency?: string; error?: string }> {
  const auth = await authenticateCaller(req);
  if (!auth.authenticated) {
    return { isAdmin: false, error: auth.error };
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
      return res.status(403).json({ success: false, error: authCheck.error });
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
    const { data: targetProfile, error: targetFetchErr } = await sbAdmin
      .from('profiles')
      .select('id, agency_id, agency, role, email, firebase_uid')
      .or(`id.eq.${uid},firebase_uid.eq.${uid}`)
      .maybeSingle();

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
      return res.status(403).json({ success: false, error: authCheck.error });
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
    const { data: existingProfileByEmail } = await sbAdmin
      .from('profiles')
      .select('id, email, firebase_uid, agency_id, agency')
      .ilike('email', trimmedEmail)
      .maybeSingle();

    // 2. Firebase Auth user creation / update for compatibility
    let userRecord: UserRecord;
    const auth = getAdminAuth();
    try {
      userRecord = await auth.getUserByEmail(trimmedEmail);
      console.log(`[Server] User ${trimmedEmail} exists with UID: ${userRecord.uid}`);
      if (password && typeof password === 'string' && password.length >= 6) {
        await auth.updateUser(userRecord.uid, { password });
        console.log(`[Server] Updated password for existing user ${trimmedEmail}`);
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
        console.log(`[Server] Provisioned new Auth user ${trimmedEmail} (UID: ${userRecord.uid})`);
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
          `[Security] Email collision rejected! Email ${trimmedEmail} belongs to profile ${existingProfileByEmail.id} with different firebase_uid.`
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
          `[Security] Cross-agency email conflict! Email ${trimmedEmail} belongs to agency ${existingAgency}.`
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
        `[Server] Provisioned authoritative Supabase profile for ${trimmedEmail} (ID: ${supabaseProfileId}) in agency ${targetAgency}`
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Morvello Cars Agent AI API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasSupabaseConfig: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  });
});

// In-memory sliding-window rate limiter for /api/agent-chat (prevents API abuse and quota exhaustion)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const chatRateLimitMap = new Map<string, RateLimitRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of chatRateLimitMap.entries()) {
    if (now > record.resetTime) {
      chatRateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function chatRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown-ip';
  const memberId = req.body?.memberId || 'anonymous';
  const rateLimitKey = `${clientIp}:${memberId}`;

  const WINDOW_MS = 60 * 1000; // 1 minute window
  const MAX_REQUESTS = 25; // 25 requests per minute

  const now = Date.now();
  let record = chatRateLimitMap.get(rateLimitKey);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + WINDOW_MS };
    chatRateLimitMap.set(rateLimitKey, record);
  } else {
    record.count++;
  }

  const remaining = Math.max(0, MAX_REQUESTS - record.count);
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', resetSeconds);

  if (record.count > MAX_REQUESTS) {
    res.setHeader('Retry-After', resetSeconds);
    return res.status(429).json({
      error: 'Trop de requêtes vers l\'assistant IA. Veuillez patienter avant de continuer.',
      retryAfterSeconds: resetSeconds,
    });
  }

  next();
}

// AI Agent Chat Endpoint - strictly isolated per authenticated member
app.post('/api/agent-chat', chatRateLimiter, async (req, res) => {
  try {
    // 1. Mandatory server-side cryptographic authentication check
    const authCheck = await authenticateCaller(req);
    if (!authCheck.authenticated) {
      return res.status(authCheck.statusCode).json({
        success: false,
        error: authCheck.error,
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
        ? "Français professionnel d'affaires ou Darija marocaine fluide et polie selon le contexte."
        : languagePreference === 'french_only'
        ? 'Strictement en français irréprochable et élégant.'
        : 'Privilégier la Darija marocaine chaleureuse pour les messages WhatsApp et contacts directs.'
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
4. Messages clients (WhatsApp & SMS), en français soigné ou en Darija selon la demande : accueil et remise des clés, rappel de restitution, confirmation de restitution et libération de caution, proposition de prolongation. Utilise les vraies données du contrat concerné (nom, véhicule, date et heure) quand il est identifiable.
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

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Morvello Cars Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

