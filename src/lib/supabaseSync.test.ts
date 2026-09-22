import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractMissingColumnFromError,
  isColumnMissing,
  markColumnMissing,
  clearMissingColumnsCache,
} from './supabaseSync';

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
