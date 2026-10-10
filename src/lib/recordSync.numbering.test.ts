import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: any[]) => rpc(...args),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })), onAuthStateChange: vi.fn() },
  },
}));

import { allocateContractNumber } from './recordSync';

describe('allocateContractNumber (numérotation atomique)', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('transmet préfixe, année et minimum suggéré, et retourne le numéro de la base', async () => {
    rpc.mockResolvedValue({
      data: { success: true, prefix: 'MC', year: 2026, sequence: 52, contract_number: 'MC-2026-0052' },
      error: null,
    });

    const res = await allocateContractNumber('MC', 2026, 50);

    expect(rpc).toHaveBeenCalledWith('allocate_contract_number', {
      p_prefix: 'MC',
      p_year: 2026,
      p_min_sequence: 50,
    });
    expect(res).toEqual({ contractNumber: 'MC-2026-0052', sequence: 52, prefix: 'MC', year: 2026 });
  });

  it('retourne null (repli local) si la fonction SQL est absente', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    expect(await allocateContractNumber('MC', 2026, 1)).toBeNull();
  });

  it('retourne null en cas de refus ou de réponse invalide', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect(await allocateContractNumber('MC', 2026, 1)).toBeNull();

    rpc.mockResolvedValue({ data: { success: true }, error: null });
    expect(await allocateContractNumber('MC', 2026, 1)).toBeNull();
  });

  it('retourne null sur exception réseau', async () => {
    rpc.mockRejectedValue(new Error('Failed to fetch'));
    expect(await allocateContractNumber('MC', 2026, 1)).toBeNull();
  });
});
