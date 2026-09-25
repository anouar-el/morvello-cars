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
 * Single, unified interface ensuring backend API endpoints receive valid
 * verifiable bearer tokens from whichever identity provider is currently in session.
 */
export async function getActiveAuthToken(): Promise<ActiveAuthToken> {
  // 1. Check Supabase Auth first (authoritative login system)
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        return { token: data.session.access_token, provider: 'supabase' };
      }
    } catch {
      // Ignore session errors
    }
  }

  // 2. Check Firebase Auth (Google Sign-In or Firebase session)
  if (firebaseAuth.currentUser) {
    try {
      const token = await firebaseAuth.currentUser.getIdToken();
      return { token, provider: 'firebase' };
    } catch {
      // Ignore token errors
    }
  }

  return { token: null, provider: null };
}
