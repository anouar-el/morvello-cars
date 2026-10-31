import { describe, expect, it } from 'vitest';
import type { Contract } from '../types';
import { effectiveEndDate, summarizeToday } from './dashboardTodo';

const contract = (over: Partial<Contract>): Contract =>
  ({
    id: over.id ?? 'c',
    contractNumber: over.id ?? 'c',
    status: 'active',
    endDate: '2026-11-01',
    totalAmount: 1000,
    paidAmount: 1000,
    remainingAmount: 0,
    prolongation: { isActive: false },
    ...over,
  }) as Contract;

describe('summarizeToday', () => {
  const today = '2026-11-01';

  it('sépare les retards des retours du jour et trie les retards du plus ancien au plus récent', () => {
    const result = summarizeToday(
      [
        contract({ id: 'a', endDate: '2026-10-30' }),
        contract({ id: 'b', endDate: '2026-11-01' }),
        contract({ id: 'c', endDate: '2026-10-25' }),
        contract({ id: 'd', endDate: '2026-11-05' }),
      ],
      today
    );
    expect(result.overdue.map((c) => c.id)).toEqual(['c', 'a']);
    expect(result.dueToday.map((c) => c.id)).toEqual(['b']);
  });

  it('tient compte de la prolongation', () => {
    const prolonged = contract({ id: 'p', endDate: '2026-10-20', prolongation: { isActive: true, newEndDate: '2026-11-10' } as Contract['prolongation'] });
    expect(effectiveEndDate(prolonged)).toBe('2026-11-10');
    expect(summarizeToday([prolonged], today).overdue).toEqual([]);
  });

  it('ignore les contrats non actifs pour les retours', () => {
    const result = summarizeToday([contract({ id: 'x', status: 'completed', endDate: '2026-10-01' })], today);
    expect(result.overdue).toEqual([]);
    expect(result.dueToday).toEqual([]);
  });

  it('additionne les restes à payer des contrats en cours ou terminés, sans les annulés ni les brouillons', () => {
    const result = summarizeToday(
      [
        contract({ id: '1', remainingAmount: 300 }),
        contract({ id: '2', status: 'completed', remainingAmount: 200 }),
        contract({ id: '3', status: 'cancelled', remainingAmount: 999 }),
        contract({ id: '4', status: 'draft', remainingAmount: 999 }),
        contract({ id: '5', remainingAmount: 0 }),
      ],
      today
    );
    expect(result.unpaid).toEqual({ count: 2, total: 500 });
  });
});
