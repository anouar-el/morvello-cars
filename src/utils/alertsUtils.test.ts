import { describe, it, expect } from 'vitest';
import { computeOperationalAlerts } from './alertsUtils';
import { initialVehicles, initialContracts, initialDeposits, initialClients, initialUsers } from '../data/mockData';
import { getScopedDataForUser } from './managerScopeUtils';

describe('computeOperationalAlerts', () => {
  it('computes exactly 2 operational alerts for Ouahib on 2026-09-22', () => {
    const ouahib = initialUsers.find((u) => u.name.includes('Ouahib'));
    expect(ouahib).toBeDefined();

    const { scopedVehicles, scopedContracts, scopedDeposits } = getScopedDataForUser(
      ouahib!,
      initialVehicles,
      initialContracts,
      initialDeposits,
      initialClients,
      initialUsers
    );

    const { alerts } = computeOperationalAlerts(
      scopedVehicles,
      scopedContracts,
      scopedDeposits,
      '2026-09-22'
    );

    // Expecting 2 operational alerts:
    // 1) Contract return expected today (MC-2026-0050)
    // 2) Caution 5,000 MAD held on the contract ending today
    expect(alerts.length).toBe(2);

    const returnAlert = alerts.find((a) => a.category === 'return_today');
    expect(returnAlert).toBeDefined();
    expect(returnAlert?.title).toContain('Restitution attendue');
    expect(returnAlert?.contract?.contractNumber).toBe('MC-2026-0050');

    const depositAlert = alerts.find((a) => a.category === 'deposit_held');
    expect(depositAlert).toBeDefined();
    expect(depositAlert?.deposit?.contractNumber).toBe('MC-2026-0050');
    expect(depositAlert?.deposit?.amount).toBe(5000);
  });
});
