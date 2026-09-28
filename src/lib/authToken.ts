import { supabase, isSupabaseConfigured } from './supabase';
import { auth as firebaseAuth } from './firebase';

export interface ActiveAuthToken {
  token: string | null;
  provider: 'supabase' | 'firebase' | null;
}

export type AuthProviderType = 'supabase' | 'firebase' | null;

/** Code returned by the server when the session behind a valid token no longer exists. */
export const SESSION_TERMINATED = 'SESSION_TERMINATED';

const PROVIDER_STORAGE_KEY = 'morvello_active_auth_provider';
let inMemoryActiveProvider: AuthProviderType = null;

/**
 * Sets the active application authentication provider in memory and session storage.
 * Application state only — NOT a security authority.
 */
export function setActiveAuthProvider(provider: AuthProviderType): void {
  inMemoryActiveProvider = provider;
  if (typeof window !== 'undefined') {
    try {
      if (provider) {
        sessionStorage.setItem(PROVIDER_STORAGE_KEY, provider);
      } else {
        sessionStorage.removeItem(PROVIDER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
}

/**
 * Gets the active application authentication provider from memory or session storage.
 */
export function getActiveAuthProvider(): AuthProviderType {
  if (inMemoryActiveProvider) return inMemoryActiveProvider;

  // 1. Check active Firebase SDK state: if Firebase user is actively authenticated, active provider is Firebase
  if (firebaseAuth.currentUser) {
    inMemoryActiveProvider = 'firebase';
    return 'firebase';
  }

  // 2. Check tab session storage
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(PROVIDER_STORAGE_KEY);
      if (stored === 'supabase' || stored === 'firebase') {
        inMemoryActiveProvider = stored;
        return stored;
      }
    } catch {
      // Ignore
    }
  }
  return null;
}

/**
 * Safely clears only the local Supabase session without affecting other devices.
 */
export async function clearStaleSupabaseSession(): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.warn('[Auth] Local Supabase sign-out notice:', err);
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
}

/**
 * Ends the Supabase session of THIS device only (scope 'local'): the local session is
 * cleared and SIGNED_OUT is emitted.
 * If Firebase is currently active and authenticated, switches active provider to Firebase
 * instead of logging the user out.
 */
export async function endTerminatedSession(): Promise<void> {
  await clearStaleSupabaseSession();

  // If Firebase is currently authenticated, continue with Firebase rather than forcing logout
  if (firebaseAuth.currentUser) {
    setActiveAuthProvider('firebase');
  } else {
    setActiveAuthProvider(null);
  }
}

/**
 * Returns the current active authorization token (Supabase JWT or Firebase ID token)
 * to include in Authorization headers for backend API requests.
 *
 * Provider-aware:
 * - If active provider is SUPABASE: returns Supabase access token (or refreshes on demand).
 * - If active provider is FIREBASE: returns Firebase ID token.
 * - Stale localStorage tokens do not determine or override active provider.
 */
export async function getActiveAuthToken(options: { forceRefresh?: boolean } = {}): Promise<ActiveAuthToken> {
  let activeProvider = getActiveAuthProvider();

  // If active provider is not set yet or is firebase, let Firebase finish initializing its auth state if pending
  if (!activeProvider || activeProvider === 'firebase') {
    if (!firebaseAuth.currentUser && typeof firebaseAuth.authStateReady === 'function') {
      try {
        await firebaseAuth.authStateReady();
      } catch {
        // Ignore initialization errors
      }
    }
    activeProvider = getActiveAuthProvider();
  }

  // 1. If active provider is FIREBASE (or Firebase is actively authenticated and not explicitly Supabase):
  if (activeProvider === 'firebase' || (firebaseAuth.currentUser && activeProvider !== 'supabase')) {
    if (firebaseAuth.currentUser) {
      try {
        const token = await firebaseAuth.currentUser.getIdToken(Boolean(options.forceRefresh));
        setActiveAuthProvider('firebase');
        // Ensure any stale Supabase session in localStorage is wiped to prevent zombie tokens
        clearStaleSupabaseSession().catch(() => {});
        return { token, provider: 'firebase' };
      } catch (fbTokenErr) {
        console.warn('[Auth] Failed to get Firebase ID token:', fbTokenErr);
        return { token: null, provider: null };
      }
    }
    // Firebase is the designated provider, but no authenticated Firebase user is present
    return { token: null, provider: null };
  }

  // 2. If active provider is SUPABASE:
  if (activeProvider === 'supabase') {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.auth.getSession();
        let session = data?.session;
        if (session && options.forceRefresh) {
          const { data: refreshed, error } = await supabase.auth.refreshSession();
          if (error || !refreshed?.session) {
            await endTerminatedSession();
            session = null;
          } else {
            session = refreshed.session;
          }
        }
        if (session?.access_token) {
          return { token: session.access_token, provider: 'supabase' };
        }
      } catch (sbErr) {
        console.warn('[Auth] Supabase session retrieval error:', sbErr);
      }
    }
    return { token: null, provider: null };
  }

  // 3. Fallback when provider state is not explicitly set and Firebase has no authenticated user:
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (session?.access_token) {
        setActiveAuthProvider('supabase');
        return { token: session.access_token, provider: 'supabase' };
      }
    } catch {
      // Ignore
    }
  }

  return { token: null, provider: null };
}
