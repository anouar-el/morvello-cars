import { describe, it, expect } from 'vitest';
import { reconcileClientsWithContracts } from './clientSyncUtils';
import type { Contract } from '../types';

const snapshot = {
  id: 'cli-1',
  firstName: 'Karim',
  lastName: 'B',
  birthDate: '1990-01-01',
  drivingLicense: 'DL1',
  docType: 'CIN',
  docNumber: 'AB123',
  phone: '0600',
};

const contract = (over: Partial<Contract>): Contract =>
  ({
    id: 'c1',
    contractNumber: 'MC-2026-0001',
    status: 'completed',
    clientId: 'cli-1',
    clientSnapshot: snapshot,
    vehicleId: 'veh-1',
    vehicleSnapshot: { id: 'veh-1', brand: 'R', model: 'C', plate: '1-A-1', fuelType: 'Diesel' },
    startDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  }) as Contract;

describe('reconcileClientsWithContracts — clients supprimés', () => {
  it('ne recrée pas un client dont le contrat a été détaché (client_id NULL en base)', () => {
    const result = reconcileClientsWithContracts([], [contract({ clientId: '' })]);
    expect(result).toHaveLength(0);
  });

  it('recrée toujours un client absent de la liste (périmètre RLS) tant que le contrat y est rattaché', () => {
    const result = reconcileClientsWithContracts([], [contract({})]);
    expect(result.map((c) => c.id)).toEqual(['cli-1']);
  });

  it('ne compte pas un contrat détaché pour un autre client', () => {
    const other = {
      id: 'cli-2',
      firstName: 'Autre',
      lastName: 'Client',
      birthDate: '',
      drivingLicense: '',
      docType: 'CIN',
      docNumber: 'ZZ999',
      createdAt: '2026-01-01',
      contractCount: 0,
    } as any;
    const result = reconcileClientsWithContracts([other], [contract({ clientId: '' })]);
    expect(result).toHaveLength(1);
    expect(result[0].contractCount).toBe(0);
  });
});
