import { createClient } from '@supabase/supabase-js';

export function normalizeSupabaseUrl(raw?: string): string {
  const fallback = 'https://uxswtmfrrxagkmewpwyd.supabase.co';
  if (!raw || typeof raw !== 'string') return fallback;
  let url = raw.trim();
  // Strip trailing slashes
  url = url.replace(/\/+$/, '');
  // Strip /rest/v1 or /auth/v1 subpaths mistakenly appended in env settings
  url = url.replace(/\/rest\/v1\/?$/i, '');
  url = url.replace(/\/auth\/v1\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url.startsWith('http') ? url : fallback;
}

const rawUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : undefined;
const rawAnonKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_ANON_KEY : undefined;

// Configuration URL and Anon Key (provided by user, normalized)
export const SUPABASE_URL = normalizeSupabaseUrl(rawUrl);

export const SUPABASE_ANON_KEY =
  (rawAnonKey && rawAnonKey.trim()) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4c3d0bWZycnhhZ2ttZXdwd3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzkwNTcsImV4cCI6MjEwNTA1NTA1N30.13FmqeiJWy7DRrFYton4PGtuZhyUnvKT3Kn_Rr16mlA';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('your-project') &&
    SUPABASE_ANON_KEY.length > 20
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
