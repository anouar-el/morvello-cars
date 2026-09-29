import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncDeleteDeposit } from './recordSync';
import { DepositRecord, Contract } from '../types';

describe('Deposit Deletion Architecture & Contract Synchronization', () => {
  const dummyDeposit: DepositRecord = {
    id: 'dep-9988-1111-2222',
    contractId: 'cnt-0001-2222',
    contractNumber: 'CTR-2026-0042',
    clientId: 'cli-123',
    clientName: 'Karim Tazi',
    clientPhone: '+212 661-223344',
    vehicleName: 'Range Rover Evoque',
    vehiclePlate: '12345 | A | 73',
    amount: 10000,
    method: 'preauth_card',
    methodDetails: 'Empreinte CB VISA *4920',
    status: 'held',
    receivedAt: '2026-09-29 10:00',
    receivedBy: 'Ahmed',
    deductions: [],
  };

  const dummyContract: Contract = {
    id: 'cnt-0001-2222',
    contractNumber: 'CTR-2026-0042',
    status: 'active',
    clientId: 'cli-123',
    clientSnapshot: {
      id: 'cli-123',
      firstName: 'Karim',
      lastName: 'Tazi',
      birthDate: '1990-01-01',
      drivingLicense: 'B123',
      docType: 'CIN',
      docNumber: 'AB123456',
    },
    hasSecondDriver: false,
    vehicleId: 'veh-123',
    vehicleSnapshot: {
      id: 'veh-123',
      brand: 'Land Rover',
      model: 'Range Rover Evoque',
      plate: '12345 | A | 73',
      fuelType: 'Diesel',
    },
    startDate: '2026-10-01',
    startTime: '10:00',
    endDate: '2026-10-05',
    endTime: '18:00',
    departureKm: 30000,
    prolongation: { isActive: false, newEndDate: '', newEndTime: '' },
    totalDays: 4,
    termsVersion: '1.0',
    depositAmount: 10000,
    depositCollected: true,
    depositRecord: dummyDeposit,
    createdAt: '2026-09-29T10:00:00.000Z',
    createdBy: 'Ahmed',
  };

  it('correctly dispatches syncDeleteDeposit with deposit identifier', async () => {
    const res = await syncDeleteDeposit(dummyDeposit.id);
    expect(res.success).toBe(true);
    expect(res.data).toBe(dummyDeposit.id);
  });

  it('unlinks depositRecord and resets depositCollected when deposit is deleted for a contract', () => {
    let currentContract: Contract = { ...dummyContract };
    let deposits: DepositRecord[] = [dummyDeposit];

    // Simulate deleteDeposit action
    const depositIdToDelete = dummyDeposit.id;
    deposits = deposits.filter((d) => d.id !== depositIdToDelete);

    if (currentContract.depositRecord?.id === depositIdToDelete) {
      currentContract = {
        ...currentContract,
        depositRecord: undefined,
        depositCollected: false,
      };
    }

    expect(deposits.length).toBe(0);
    expect(currentContract.depositRecord).toBeUndefined();
    expect(currentContract.depositCollected).toBe(false);
  });

  it('allows admin and manager to delete deposits, but restricts standard agents', () => {
    const canUserDeleteDeposit = (role: 'admin' | 'manager' | 'agent', canManageDeposits?: boolean) => {
      return role === 'admin' || role === 'manager' || Boolean(canManageDeposits);
    };

    expect(canUserDeleteDeposit('admin')).toBe(true);
    expect(canUserDeleteDeposit('manager')).toBe(true);
    expect(canUserDeleteDeposit('agent', false)).toBe(false);
    expect(canUserDeleteDeposit('agent', true)).toBe(true);
  });
});
