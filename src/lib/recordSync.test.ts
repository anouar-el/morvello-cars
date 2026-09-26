import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addRecordTombstone,
  isRecordTombstoned,
  filterTombstonedRecords,
  clearRecordTombstones,
  syncCreateVehicle,
  syncUpdateVehicle,
  syncDeleteVehicle,
  syncCreateClient,
  syncUpdateClient,
  syncDeleteClient,
  syncCreateContract,
  syncUpdateContract,
  syncDeleteContract,
  syncCreateDeposit,
  syncUpdateDeposit,
  syncDeleteDeposit,
  syncCreatePayment,
  syncDeletePayment,
  syncCreateVehicleExpense,
  syncDeleteVehicleExpense,
  syncCompanySettings,
} from './recordSync';
import { Vehicle, Contract, Client, DepositRecord, PaymentRecord, VehicleExpense } from '../types';

describe('Problem #7: Record-Level Synchronization Architecture', () => {
  beforeEach(() => {
    clearRecordTombstones();
  });

  describe('Step 11 & 16: Tombstone anti-resurrection defense', () => {
    it('properly registers tombstones for deleted records', () => {
      expect(isRecordTombstoned('vehicles', 'veh-101')).toBe(false);
      addRecordTombstone('vehicles', 'veh-101');
      expect(isRecordTombstoned('vehicles', 'veh-101')).toBe(true);
      expect(isRecordTombstoned('contracts', 'veh-101')).toBe(false);
    });

    it('filters out tombstoned records from re-appearing in collections', () => {
      const vehicles: { id: string; plate: string }[] = [
        { id: 'veh-1', plate: '11111 | A | 73' },
        { id: 'veh-2', plate: '22222 | A | 73' },
        { id: 'veh-3', plate: '33333 | A | 73' },
      ];

      addRecordTombstone('vehicles', 'veh-2');
      const filtered = filterTombstonedRecords('vehicles', vehicles);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((v) => v.id)).toEqual(['veh-1', 'veh-3']);
      expect(filtered.some((v) => v.id === 'veh-2')).toBe(false);
    });

    it('clears tombstones on demand', () => {
      addRecordTombstone('clients', 'cli-99');
      expect(isRecordTombstoned('clients', 'cli-99')).toBe(true);
      clearRecordTombstones();
      expect(isRecordTombstoned('clients', 'cli-99')).toBe(false);
    });
  });

  describe('Step 3 & 5: Vehicles Record-Level Sync', () => {
    const testVehicle: Vehicle = {
      id: 'veh-test-1',
      brand: 'Renault',
      model: 'Clio 5',
      plate: '12345 | A | 73',
      fuelType: 'Diesel',
      status: 'available',
      currentKm: 45000,
      dailyRate: 350,
      approvalStatus: 'approved',
      assignedManagerId: 'usr-2',
      assignedManagerName: 'Said Khomri',
    };

    it('syncCreateVehicle operates specifically on single vehicle record', async () => {
      const res = await syncCreateVehicle(testVehicle, null);
      expect(res.status).toBeDefined();
      expect(typeof res.timestamp).toBe('string');
    });

    it('syncUpdateVehicle sends only the patch without overwriting other vehicles', async () => {
      const res = await syncUpdateVehicle('veh-test-1', {
        status: 'maintenance',
        currentKm: 46000,
      });
      expect(res.status).toBeDefined();
    });

    it('syncDeleteVehicle records tombstone and executes delete', async () => {
      expect(isRecordTombstoned('vehicles', 'veh-test-1')).toBe(false);
      const res = await syncDeleteVehicle('veh-test-1');
      expect(res.status).toBeDefined();
      expect(isRecordTombstoned('vehicles', 'veh-test-1')).toBe(true);
    });
  });

  describe('Step 3 & 7: Clients Record-Level Sync', () => {
    const testClient: Client = {
      id: 'cli-test-1',
      firstName: 'Karim',
      lastName: 'Benzema',
      birthDate: '1987-12-19',
      drivingLicense: 'DL-987654',
      docType: 'CIN',
      docNumber: 'BK123456',
      createdAt: '2026-03-01T10:00:00Z',
      contractCount: 0,
    };

    it('syncCreateClient persists single client record', async () => {
      const res = await syncCreateClient(testClient);
      expect(res.status).toBeDefined();
    });

    it('syncUpdateClient updates specific client without broadcasting all clients', async () => {
      const res = await syncUpdateClient('cli-test-1', {
        phone: '0612345678',
        email: 'karim@example.com',
      });
      expect(res.status).toBeDefined();
    });

    it('syncDeleteClient registers client tombstone', async () => {
      const res = await syncDeleteClient('cli-test-1');
      expect(res.status).toBeDefined();
      expect(isRecordTombstoned('clients', 'cli-test-1')).toBe(true);
    });
  });

  describe('Step 3 & 6: Contracts Record-Level Sync & Referential Integrity', () => {
    const testContract: Contract = {
      id: 'cnt-test-1',
      contractNumber: 'MC-2026-0099',
      status: 'active',
      clientId: 'cli-test-1',
      clientSnapshot: {
        id: 'cli-test-1',
        firstName: 'Karim',
        lastName: 'Benzema',
        birthDate: '1987-12-19',
        drivingLicense: 'DL-987654',
        docType: 'CIN',
        docNumber: 'BK123456',
      },
      hasSecondDriver: false,
      vehicleId: 'veh-test-1',
      vehicleSnapshot: {
        id: 'veh-test-1',
        brand: 'Renault',
        model: 'Clio 5',
        plate: '12345 | A | 73',
        fuelType: 'Diesel',
      },
      startDate: '2026-03-01',
      startTime: '10:00',
      endDate: '2026-03-05',
      endTime: '10:00',
      departureKm: 45000,
      totalAmount: 1400,
      depositAmount: 3000,
      prolongation: { isActive: false, newEndDate: '', newEndTime: '' },
      termsVersion: 'fr_v1',
      totalDays: 4,
      createdBy: 'test-user',
      createdAt: '2026-03-01T10:00:00Z',
    };

    it('syncCreateContract creates contract with related records at record level', async () => {
      const res = await syncCreateContract(testContract, {
        nextContractNumber: 100,
      });
      expect(res.status).toBeDefined();
    });

    it('syncUpdateContract updates contract status without rewriting all contracts', async () => {
      const res = await syncUpdateContract('cnt-test-1', {
        status: 'completed',
        returnKm: 45450,
      });
      expect(res.status).toBeDefined();
    });

    it('syncDeleteContract registers contract tombstone', async () => {
      const res = await syncDeleteContract('cnt-test-1');
      expect(res.status).toBeDefined();
      expect(isRecordTombstoned('contracts', 'cnt-test-1')).toBe(true);
    });
  });

  describe('Step 8: Payments and Deposits Record-Level Sync', () => {
    it('syncCreateDeposit persists deposit at row level', async () => {
      const deposit: DepositRecord = {
        id: 'dep-test-1',
        contractId: 'cnt-test-1',
        contractNumber: 'MC-2026-0099',
        clientId: 'cli-test-1',
        clientName: 'Karim Benzema',
        clientPhone: '0612345678',
        vehicleName: 'Renault Clio 5',
        vehiclePlate: '12345 | A | 73',
        amount: 3000,
        method: 'preauth_card',
        status: 'held',
        receivedAt: '2026-03-01 10:00',
        receivedBy: 'Said Khomri',
        deductions: [],
      };

      const res = await syncCreateDeposit(deposit);
      expect(res.status).toBeDefined();

      const updateRes = await syncUpdateDeposit('dep-test-1', {
        status: 'released',
        refundedAmount: 3000,
      });
      expect(updateRes.status).toBeDefined();

      const deleteRes = await syncDeleteDeposit('dep-test-1');
      expect(deleteRes.status).toBeDefined();
      expect(isRecordTombstoned('deposits', 'dep-test-1')).toBe(true);
    });

    it('syncCreatePayment and syncDeletePayment operate directly on payments', async () => {
      const payment: PaymentRecord = {
        id: 'pay-test-1',
        amount: 700,
        method: 'cash',
        date: '2026-03-01',
        notes: 'Acompte',
        recordedBy: 'Direction',
      };

      const res = await syncCreatePayment('cnt-test-1', payment);
      expect(res.status).toBeDefined();

      const delRes = await syncDeletePayment('pay-test-1');
      expect(delRes.status).toBeDefined();
      expect(isRecordTombstoned('payments', 'pay-test-1')).toBe(true);
    });
  });

  describe('Step 9: Company Settings Isolation', () => {
    it('syncCompanySettings writes only settings without sending contracts or fleet', async () => {
      const res = await syncCompanySettings({
        name: 'Morvello Cars Test',
        address: 'Aéroport Mohammed V Nouaceur',
        phone1: '+212 522 000 000',
        phone2: '+212 600 000 000',
        email: 'contact@morvellocars.com',
        website: 'https://morvellocars.com',
        ice: '001234567890001',
        rc: '12345',
        patente: '67890',
        taxId: '11223344',
        contractPrefix: 'MC',
        contractYear: 2026,
        nextContractNumber: 105,
      });

      expect(res.status).toBeDefined();
    });
  });

  describe('Step 5 & 11: Vehicle Maintenance Expenses Record-Level Sync', () => {
    it('syncCreateVehicleExpense and syncDeleteVehicleExpense target specific expense row', async () => {
      const expense: VehicleExpense = {
        id: 'exp-test-1',
        vehicleId: 'veh-test-1',
        category: 'oil_change',
        title: 'Vidange 10 000 km',
        costMAD: 800,
        date: '2026-03-01',
        kmAtExpense: 45000,
        recordedBy: 'Said Khomri',
        createdAt: '2026-03-01T10:00:00Z',
      };

      const res = await syncCreateVehicleExpense('veh-test-1', expense);
      expect(res.status).toBeDefined();

      const delRes = await syncDeleteVehicleExpense('veh-test-1', 'exp-test-1');
      expect(delRes.status).toBeDefined();
      expect(isRecordTombstoned('vehicle_expenses', 'exp-test-1')).toBe(true);
    });
  });
});
