import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractMissingColumnFromError,
  isColumnMissing,
  markColumnMissing,
  clearMissingColumnsCache,
  resolveAssignedManagerForSupabase,
} from './supabaseSync';
import { initialContracts, initialVehicles } from '../data/mockData';
import { isContractOwnedByManager } from '../utils/managerScopeUtils';

describe('supabaseSync schema resilience', () => {
  beforeEach(() => {
    clearMissingColumnsCache();
  });

  it('correctly extracts missing column name from PostgREST PGRST204 error', () => {
    const error = {
      code: 'PGRST204',
      message: "Could not find the 'assigned_manager_id' column of 'contracts' in the schema cache",
      details: null,
    };

    const col = extractMissingColumnFromError(error);
    expect(col).toBe('assigned_manager_id');
  });

  it('manages missing columns cache correctly', () => {
    expect(isColumnMissing('contracts', 'assigned_manager_id')).toBe(false);

    markColumnMissing('contracts', 'assigned_manager_id');
    expect(isColumnMissing('contracts', 'assigned_manager_id')).toBe(true);
    expect(isColumnMissing('vehicles', 'assigned_manager_id')).toBe(false);

    clearMissingColumnsCache();
    expect(isColumnMissing('contracts', 'assigned_manager_id')).toBe(false);
  });
});

describe('resolveAssignedManagerForSupabase manager attribution', () => {
  const saidUid = '3eef50aa-c691-480d-a197-1736770f6f01';
  const ouahibUid = '8ff123aa-c691-480d-a197-1736770f6f99';

  it("does NOT reassign Ouahib's contract (usr-3) to Said's UID when Said is logged in", () => {
    // Contract MC-2026-0050 has assignedManagerId: 'usr-3' and assignedManagerName: 'Abdelkader Ouahib'
    const result = resolveAssignedManagerForSupabase(
      'usr-3',
      'Abdelkader Ouahib',
      null,
      saidUid,
      'said.khomri@morvellocars.com'
    );
    // Must NOT be Said's UID! It must preserve usr-3
    expect(result).toBe('usr-3');
  });

  it("correctly assigns Ouahib's UID when Ouahib is logged in", () => {
    const result = resolveAssignedManagerForSupabase(
      'usr-3',
      'Abdelkader Ouahib',
      null,
      ouahibUid,
      'ouahib@morvellocars.com'
    );
    expect(result).toBe(ouahibUid);
  });

  it("correctly assigns Said's UID when Said is logged in and evaluating Said's resource", () => {
    const result = resolveAssignedManagerForSupabase(
      'usr-2',
      'Said Khomri',
      null,
      saidUid,
      'said.khomri@morvellocars.com'
    );
    expect(result).toBe(saidUid);
  });

  it('correctly segregates contract MC-2026-0050 between Ouahib and Said', () => {
    const contract50 = initialContracts.find((c) => c.contractNumber === 'MC-2026-0050')!;
    expect(contract50).toBeDefined();

    // Ouahib owns MC-2026-0050
    const ownedByOuahib = isContractOwnedByManager(
      contract50,
      'usr-3',
      initialVehicles,
      'Abdelkader Ouahib',
      ouahibUid
    );
    expect(ownedByOuahib).toBe(true);

    // Said does NOT own MC-2026-0050
    const ownedBySaid = isContractOwnedByManager(
      contract50,
      'usr-2',
      initialVehicles,
      'Said Khomri',
      saidUid
    );
    expect(ownedBySaid).toBe(false);
  });
});

