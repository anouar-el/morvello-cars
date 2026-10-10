import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));

import { resolveAssignedManagerForSupabase } from './supabaseSync';

const ADMIN_UID = 'e41b7322-8daf-4950-8d35-8cc00d9e107c';
const EZZAY_UID = '2904e4b9-560f-4b74-9b74-acee1e6b9607';

describe('resolveAssignedManagerForSupabase — repli sans responsable', () => {
  it('un admin qui écrit une ligne sans responsable la laisse non affectée (NULL)', () => {
    expect(resolveAssignedManagerForSupabase(undefined, 'Mohamed Ezzay', null, ADMIN_UID, 'a@x.com', undefined, true)).toBeNull();
    expect(resolveAssignedManagerForSupabase('', undefined, null, ADMIN_UID, 'a@x.com', undefined, true)).toBeNull();
  });

  it('un manager qui écrit une ligne sans responsable se l\'attribue (exigé par la RLS)', () => {
    expect(resolveAssignedManagerForSupabase(undefined, undefined, null, EZZAY_UID, 'e@x.com', undefined, false)).toBe(EZZAY_UID);
  });

  it('conserve le responsable existant en base, même pour un admin', () => {
    expect(resolveAssignedManagerForSupabase(undefined, undefined, EZZAY_UID, ADMIN_UID, 'a@x.com', undefined, true)).toBe(EZZAY_UID);
  });

  it('résout un identifiant historique vers l\'UUID du bon utilisateur', () => {
    const users = [
      { id: ADMIN_UID, legacyId: 'usr-1' },
      { id: EZZAY_UID, legacyId: 'usr-4' },
    ];
    expect(resolveAssignedManagerForSupabase('usr-4', 'Mohamed Ezzay', null, ADMIN_UID, 'a@x.com', users, true)).toBe(EZZAY_UID);
  });

  it('garde la valeur locale fournie, sans la remplacer par l\'admin connecté', () => {
    expect(resolveAssignedManagerForSupabase(EZZAY_UID, 'Mohamed Ezzay', null, ADMIN_UID, 'a@x.com', undefined, true)).toBe(EZZAY_UID);
  });
});
