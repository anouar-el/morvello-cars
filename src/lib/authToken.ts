import { supabase, isSupabaseConfigured } from './supabase';
import { auth as firebaseAuth } from './firebase';

export interface ActiveAuthToken {
  token: string | null;
  provider: 'supabase' | 'firebase' | null;
}

/**
 * Returns the current active authorization token (Supabase JWT or Firebase ID token)
 * to include in Authorization headers for backend API requests.
 *
 * getSession() already exchanges an expired access token for a new one. An extra manual
 * refresh must not run alongside supabase-js's own auto-refresh: reusing a rotated refresh
 * token makes Supabase revoke the whole session. So a refresh is only forced on demand,
 * for the single retry after the server rejected the token.
 */
export async function getActiveAuthToken(options: { forceRefresh?: boolean } = {}): Promise<ActiveAuthToken> {
  // 1. Check Supabase Auth first (authoritative login system)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      let session = data?.session;
      if (session) {
        if (options.forceRefresh) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) session = refreshed.session;
        }
        if (session.access_token) {
          return { token: session.access_token, provider: 'supabase' };
        }
      }
    } catch {
      // Ignore session errors
    }
  }

  // 2. Check Firebase Auth (Google Sign-In or Firebase session)
  if (firebaseAuth.currentUser) {
    try {
      const token = await firebaseAuth.currentUser.getIdToken(Boolean(options.forceRefresh));
      return { token, provider: 'firebase' };
    } catch {
      // Ignore token errors
    }
  }

  return { token: null, provider: null };
}
