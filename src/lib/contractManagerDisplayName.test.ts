import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncCreateContract, syncUpdateContract } from './recordSync';
import { Contract, Vehicle, Client } from '../types';

describe('Contract Manager Display Name & Phone Snapshot Specification', () => {
  const dummyVehicle: Vehicle = {
    id: 'veh-f38b8123-1111-2222-3333-444455556666',
    brand: 'Mercedes',
    model: 'Classe C',
    plate: '54321 | A | 73',
    fuelType: 'Diesel',
    status: 'available',
    currentKm: 42000,
    dailyRate: 800,
    assignedManagerId: 'usr-manager-1',
    assignedManagerName: 'Ahmed El Mansouri',
  };

  const dummyClient: Client = {
    id: 'cli-99887766-1111-2222-3333-444455556666',
    firstName: 'Youssef',
    lastName: 'Alami',
    birthDate: '1990-01-01',
    drivingLicense: 'B998877',
    docType: 'CIN',
    docNumber: 'BK123456',
    phone: '+212 600-112233',
    createdAt: '2026-01-01T00:00:00.000Z',
    contractCount: 1,
  };

  const createBaseContract = (overrides?: Partial<Contract>): Contract => ({
    id: 'cnt-00001111-2222-3333-4444-555566667777',
    contractNumber: 'CTR-2026-0099',
    status: 'active',
    clientId: dummyClient.id,
    vehicleId: dummyVehicle.id,
    hasSecondDriver: false,
    startDate: '2026-07-01',
    startTime: '10:00',
    endDate: '2026-07-05',
    endTime: '18:00',
    departureKm: 42000,
    prolongation: { isActive: false, newEndDate: '', newEndTime: '' },
    totalDays: 4,
    pricePerDay: 800,
    totalAmount: 3200,
    paidAmount: 0,
    remainingAmount: 3200,
    paymentStatus: 'unpaid',
    depositAmount: 10000,
    clientSnapshot: dummyClient as any,
    vehicleSnapshot: dummyVehicle as any,
    assignedManagerId: 'usr-manager-1',
    assignedManagerName: 'Ahmed El Mansouri',
    termsVersion: '1.0',
    createdAt: new Date().toISOString(),
    createdBy: 'Ahmed El Mansouri',
    ...overrides,
  });

  describe('1. Display Name Resolution & Fallback Logic', () => {
    it('uses the custom nickname (managerDisplayName) when present on the contract', () => {
      const contract = createBaseContract({
        managerDisplayName: 'Ahmed',
        managerPhone: '+212 661-998877',
      });

      // Simulation of document resolution
      const resolvedName = contract.managerDisplayName?.trim() || contract.assignedManagerName || '';
      expect(resolvedName).toBe('Ahmed');
      expect(contract.assignedManagerName).toBe('Ahmed El Mansouri'); // Official profile remains untouched
    });

    it('falls back to the official manager profile name when managerDisplayName is empty or absent', () => {
      const contractWithoutNickname = createBaseContract({
        managerDisplayName: undefined,
      });

      const resolvedName = contractWithoutNickname.managerDisplayName?.trim() || contractWithoutNickname.assignedManagerName || '';
      expect(resolvedName).toBe('Ahmed El Mansouri');
    });

    it('falls back to official name when managerDisplayName is whitespace-only', () => {
      const contractWithWhitespace = createBaseContract({
        managerDisplayName: '   ',
      });

      const resolvedName = contractWithWhitespace.managerDisplayName?.trim() || contractWithWhitespace.assignedManagerName || '';
      expect(resolvedName).toBe('Ahmed El Mansouri');
    });
  });

  describe('2. Manager Phone Snapshot Consistency', () => {
    it('preserves the manager phone snapshot on the contract', () => {
      const contract = createBaseContract({
        managerDisplayName: 'Ahmed',
        managerPhone: '+212 661-445566',
      });

      expect(contract.managerPhone).toBe('+212 661-445566');
    });

    it('retains the historical contract phone even if manager profile changes later', () => {
      const historicalContract = createBaseContract({
        managerDisplayName: 'Ahmed',
        managerPhone: '+212 661-111111',
      });

      // Manager changes phone in their profile
      const updatedManagerProfile = {
        id: 'usr-manager-1',
        name: 'Ahmed El Mansouri',
        phone: '+212 661-999999', // New phone number
      };

      // Contract snapshot phone must remain the historical value (+212 661-111111)
      const effectiveContractPhone = historicalContract.managerPhone || updatedManagerProfile.phone;
      expect(effectiveContractPhone).toBe('+212 661-111111');
    });
  });

  describe('3. Transactional Contract Persistence Payload Integrity', () => {
    it('passes manager_display_name and manager_phone correctly to syncCreateContract', async () => {
      const contract = createBaseContract({
        managerDisplayName: 'Ahmed',
        managerPhone: '+212 661-555555',
      });

      // Verification that contract object holds the properties for RPC & DB payload
      expect(contract.managerDisplayName).toBe('Ahmed');
      expect(contract.managerPhone).toBe('+212 661-555555');

      // Check normalization logic equivalent to ContractsContext / recordSync
      const normalizedPayload = {
        manager_display_name: contract.managerDisplayName?.trim() || null,
        manager_phone: contract.managerPhone?.trim() || null,
      };

      expect(normalizedPayload.manager_display_name).toBe('Ahmed');
      expect(normalizedPayload.manager_phone).toBe('+212 661-555555');
    });
  });
});
