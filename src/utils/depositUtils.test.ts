import { describe, expect, it } from 'vitest';
import { getDepositCollectionStatus, shouldRecordDeposit } from './depositUtils';

describe('deposit collection status', () => {
  it('shows nothing when no deposit is due', () => {
    expect(getDepositCollectionStatus({ depositAmount: 0, depositCollected: false })).toBe('none');
    expect(shouldRecordDeposit({ depositAmount: 0 })).toBe(false);
  });

  it('only records a held deposit when it was actually taken', () => {
    expect(getDepositCollectionStatus({ depositAmount: 8000, depositCollected: false })).toBe('not_collected');
    expect(shouldRecordDeposit({ depositAmount: 8000, depositCollected: false })).toBe(false);
    expect(shouldRecordDeposit({ depositAmount: 8000, depositCollected: true })).toBe(true);
  });

  it('treats contracts created before the flag as collected', () => {
    expect(getDepositCollectionStatus({ depositAmount: 5000 })).toBe('collected');
  });
});
