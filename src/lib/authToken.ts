import { supabase, isSupabaseConfigured } from './supabase';
import { auth as firebaseAuth } from './firebase';

export interface ActiveAuthToken {
  token: string | null;
  provider: 'supabase' | 'firebase' | null;
}

// Refresh a Supabase token that expires within this margin instead of sending it as-is
const REFRESH_MARGIN_SECONDS = 60;

/**
 * Returns the current active authorization token (Supabase JWT or Firebase ID token)
 * to include in Authorization headers for backend API requests.
 *
 * getSession() returns the cached session even when its access token has expired
 * (e.g. a tab left open while the browser throttled the auto-refresh), so an expired
 * or nearly expired token is refreshed first. `forceRefresh` does it unconditionally,
 * for a retry after the server rejected the token.
 */
export async function getActiveAuthToken(options: { forceRefresh?: boolean } = {}): Promise<ActiveAuthToken> {
  // 1. Check Supabase Auth first (authoritative login system)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      let session = data?.session;
      if (session) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expiresSoon = !session.expires_at || session.expires_at - nowSeconds < REFRESH_MARGIN_SECONDS;
        if (options.forceRefresh || expiresSoon) {
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
