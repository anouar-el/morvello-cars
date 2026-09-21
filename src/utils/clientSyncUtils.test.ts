import { describe, it, expect } from 'vitest';
import { reconcileClientsWithContracts } from './clientSyncUtils';
import { Client, Contract } from '../types';

describe('reconcileClientsWithContracts', () => {
  it('should restore missing client from contract snapshot', () => {
    const existingClients: Client[] = [
      {
        id: 'cli-1',
        firstName: 'NEMER',
        lastName: 'ALHARBI',
        birthDate: '1990-01-01',
        drivingLicense: '1087437894',
        docType: 'Passeport',
        docNumber: 'K597400',
        contractCount: 0,
        createdAt: '2026-01-01',
      },
    ];

    const contracts: Contract[] = [
      {
        id: 'cnt-1',
        contractNumber: 'MC-2026-0051',
        clientId: 'cli-salah',
        clientSnapshot: {
          id: 'cli-salah',
          firstName: 'SALAH',
          lastName: 'TLIHA',
          birthDate: '1978-01-19',
          docType: 'Passeport',
          docNumber: 'I472903',
          drivingLicense: 'U120U6221F',
          country: 'TUNISIA',
          address: 'TUNISIA',
        } as unknown as Client,
        vehicleSnapshot: {
          brand: 'PEUGEOT',
          model: '208',
          plate: '46307 | A | 73',
        } as any,
        status: 'active',
        startDate: '2026-02-15',
        createdAt: '2026-02-15T10:00:00Z',
      } as unknown as Contract,
    ];

    const reconciled = reconcileClientsWithContracts(existingClients, contracts);

    expect(reconciled).toHaveLength(2);
    const salah = reconciled.find((c) => c.id === 'cli-salah');
    expect(salah).toBeDefined();
    expect(salah?.firstName).toBe('SALAH');
    expect(salah?.lastName).toBe('TLIHA');
    expect(salah?.docNumber).toBe('I472903');
    expect(salah?.rentedVehiclePlate).toBe('46307 | A | 73');
    expect(salah?.contractCount).toBe(1);
    expect(salah?.lastContractNumber).toBe('MC-2026-0051');
  });

  it('should not duplicate clients that already exist', () => {
    const existingClients: Client[] = [
      {
        id: 'cli-1',
        firstName: 'SALEH',
        lastName: 'ABULABAL',
        birthDate: '1985-05-05',
        drivingLicense: '1033949924',
        docType: 'Passeport',
        docNumber: 'AA53374',
        contractCount: 0,
        createdAt: '2026-01-01',
      },
    ];

    const contracts: Contract[] = [
      {
        id: 'cnt-1',
        contractNumber: 'MC-2026-0050',
        clientId: 'cli-1',
        clientSnapshot: {
          id: 'cli-1',
          firstName: 'SALEH',
          lastName: 'ABULABAL',
          birthDate: '1985-05-05',
          docType: 'Passeport',
          docNumber: 'AA53374',
          drivingLicense: '1033949924',
        } as unknown as Client,
        vehicleSnapshot: {
          brand: 'RENAULT',
          model: 'KARDIAN',
          plate: '52596 | A | 73',
        } as any,
        status: 'active',
        startDate: '2026-02-10',
      } as unknown as Contract,
    ];

    const reconciled = reconcileClientsWithContracts(existingClients, contracts);
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0].contractCount).toBe(1);
    expect(reconciled[0].rentedVehiclePlate).toBe('52596 | A | 73');
  });
});
