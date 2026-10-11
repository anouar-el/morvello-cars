import { describe, it, expect, vi, beforeEach } from 'vitest';

const updates: Record<string, any>[] = [];

vi.mock('./supabase', () => {
  const missingColumnError = {
    code: 'PGRST204',
    message: "Could not find the 'manager_display_name' column of 'contracts' in the schema cache",
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })), onAuthStateChange: vi.fn() },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { updated_at: 't1', data: { a: 1 } }, error: null }) }) }),
        update: (fields: Record<string, any>) => {
          updates.push(fields);
          const result =
            'manager_display_name' in fields
              ? { data: null, error: missingColumnError }
              : { data: [{ id: 'c1' }], error: null };
          const query: any = { eq: () => query, is: () => query, select: async () => result };
          return query;
        },
      }),
    },
  };
});

import { extractMissingColumn, syncUpdateContract } from './recordSync';

describe('extractMissingColumn', () => {
  it('lit le nom de la colonne dans une erreur PGRST204', () => {
    expect(
      extractMissingColumn({ code: 'PGRST204', message: "Could not find the 'manager_phone' column of 'contracts' in the schema cache" })
    ).toBe('manager_phone');
  });

  it('retourne null pour une autre erreur', () => {
    expect(extractMissingColumn({ code: '42501', message: 'permission denied' })).toBeNull();
    expect(extractMissingColumn(null)).toBeNull();
  });
});

describe('syncUpdateContract avec une colonne absente du cache PostgREST', () => {
  beforeEach(() => {
    updates.length = 0;
  });

  it('retire la colonne absente et réussit, sans perdre la valeur (document JSON)', async () => {
    const res = await syncUpdateContract('c1', { managerDisplayName: 'Ahmed', status: 'active' } as any);

    expect(res.success).toBe(true);
    expect(updates).toHaveLength(2);
    expect('manager_display_name' in updates[0]).toBe(true);
    expect('manager_display_name' in updates[1]).toBe(false);
    expect(updates[1].status).toBe('active');
    expect(updates[1].data.managerDisplayName).toBe('Ahmed');
  });
});
