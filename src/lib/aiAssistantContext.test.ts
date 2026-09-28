import { describe, expect, it } from 'vitest';
import { buildAssistantDataSection, buildAssistantDigest, effectiveReturn, todayInMorocco } from './aiAssistantContext';

// 28/09/2026 à 10h, heure du Maroc
const NOW = new Date('2026-09-28T09:00:00Z');

const contract = (over: Record<string, any>) => ({
  contractNumber: 'MRV-1',
  status: 'active',
  clientSnapshot: { firstName: 'Youssef', lastName: 'Benjelloun', phone: '0661' },
  vehicleSnapshot: { brand: 'DACIA', model: 'Duster', plate: '1 | A | 6' },
  startDate: '2026-09-20',
  startTime: '10:00',
  endDate: '2026-09-28',
  endTime: '18:00',
  totalAmount: 3000,
  paidAmount: 3000,
  depositAmount: 10000,
  ...over,
});

describe('AI assistant context', () => {
  it('uses the Moroccan calendar date', () => {
    expect(todayInMorocco(NOW)).toBe('2026-09-28');
    expect(todayInMorocco(new Date('2026-09-28T23:30:00Z'))).toBe('2026-09-29');
  });

  it('classifies departures, returns, tomorrow and overdue contracts', () => {
    const d = buildAssistantDigest(NOW, [], [
      contract({ contractNumber: 'RET-TODAY' }),
      contract({ contractNumber: 'RET-TOMORROW', endDate: '2026-09-29' }),
      contract({ contractNumber: 'LATE', endDate: '2026-09-25' }),
      contract({ contractNumber: 'DEP-TODAY', startDate: '2026-09-28', endDate: '2026-10-02' }),
      contract({ contractNumber: 'DONE', status: 'completed', endDate: '2026-09-25' }),
    ] as any);
    expect(d.returnsToday.join()).toContain('RET-TODAY');
    expect(d.returnsTomorrow.join()).toContain('RET-TOMORROW');
    expect(d.overdue).toHaveLength(1);
    expect(d.overdue[0]).toMatch(/^LATE · .* · retour prévu le 25\/09\/2026 \(3 j de retard\)$/);
    expect(d.departuresToday.join()).toContain('DEP-TODAY');
    expect(d.overdue.join()).not.toContain('DONE');
  });

  it('uses the granted prolongation as the return date', () => {
    const c = contract({ endDate: '2026-09-25', prolongation: { isActive: true, newEndDate: '2026-09-30', newEndTime: '12:00' } });
    expect(effectiveReturn(c as any)).toEqual({ date: '2026-09-30', time: '12:00' });
    expect(buildAssistantDigest(NOW, [], [c] as any).overdue).toHaveLength(0);
  });

  it('flags deposits not taken, unpaid balances and vehicle deadlines', () => {
    const d = buildAssistantDigest(
      NOW,
      [
        { brand: 'RENAULT', model: 'Clio', plate: 'X', insuranceExpiryDate: '2026-10-10', currentKm: 49500, nextOilChangeKm: 50000, vignettePaidYear: 2025 },
        { brand: 'KIA', model: 'Picanto', plate: 'Y', technicalInspectionExpiryDate: '2026-09-01' },
      ] as any,
      [contract({ contractNumber: 'NODEP', depositCollected: false, endDate: '2026-10-05', paidAmount: 1000 })] as any
    );
    expect(d.depositsNotCollected.join()).toContain('NODEP');
    expect(d.unpaidBalances.join()).toMatch(/reste à encaisser 2[\s  ]000 MAD/);
    const alerts = d.vehicleAlerts.join('\n');
    expect(alerts).toContain('expire le 10/10/2026 (dans 12 j)');
    expect(alerts).toContain('vidange dans 500 km');
    expect(alerts).toContain('vignette 2026 non payée');
    expect(alerts).toContain('visite technique EXPIRÉE');
  });

  it('builds a prompt section with the date, the insurance grid and the real deposit state', () => {
    const text = buildAssistantDataSection(NOW, {
      vehicles: [],
      contracts: [contract({ depositCollected: false, endDate: '2026-10-05' })] as any,
      deposits: [],
    });
    expect(text).toContain('DATE DU JOUR (Maroc) : 28/09/2026');
    expect(text).toContain('Pack Confort');
    expect(text).toContain('(NON prise)');
    expect(text).not.toContain('300 MAD');
  });
});
