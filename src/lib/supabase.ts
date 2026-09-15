import { createClient } from '@supabase/supabase-js';

// Configuration URL and Anon Key (provided by user)
export const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://uxswtmfrrxagkmewpwyd.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
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
