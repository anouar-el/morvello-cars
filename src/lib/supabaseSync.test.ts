import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractMissingColumnFromError,
  isColumnMissing,
  markColumnMissing,
  clearMissingColumnsCache,
  resolveAssignedManagerForSupabase,
} from './supabaseSync';
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
  const managerAUid = '3eef50aa-c691-480d-a197-1736770f6f01';
  const managerBUid = '8ff123aa-c691-480d-a197-1736770f6f99';

  it("does not reassign another manager's contract to the current manager", () => {
    const result = resolveAssignedManagerForSupabase(
      'usr-3',
      'Manager B',
      null,
      managerAUid,
      'manager-a@example.test'
    );
    // It must preserve the existing legacy assignment.
    expect(result).toBe('usr-3');
  });

  it('assigns the authenticated manager UID to their own legacy record', () => {
    const result = resolveAssignedManagerForSupabase(
      'usr-3',
      'Manager B',
      null,
      managerBUid,
      'manager-b@example.test',
      [{ id: managerBUid, legacyId: 'usr-3' }]
    );
    expect(result).toBe(managerBUid);
  });

  it('assigns the authenticated manager UID to their own resource', () => {
    const result = resolveAssignedManagerForSupabase(
      'usr-2',
      'Manager A',
      null,
      managerAUid,
      'manager-a@example.test',
      [{ id: managerAUid, legacyId: 'usr-2' }]
    );
    expect(result).toBe(managerAUid);
  });

  it('segregates a contract between two managers', () => {
    const contract = { assignedManagerId: 'usr-3', vehicleId: 'veh-demo' } as any;
    const vehicles = [{ id: 'veh-demo', assignedManagerId: 'usr-3' }] as any;
    const ownedByManagerB = isContractOwnedByManager(
      contract,
      'usr-3',
      vehicles,
      'Manager B',
      managerBUid
    );
    expect(ownedByManagerB).toBe(true);

    const ownedByManagerA = isContractOwnedByManager(
      contract,
      'usr-2',
      vehicles,
      'Manager A',
      managerAUid
    );
    expect(ownedByManagerA).toBe(false);
  });
});

