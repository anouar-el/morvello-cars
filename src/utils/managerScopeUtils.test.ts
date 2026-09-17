import { describe, it, expect } from 'vitest';
import {
  isVehicleOwnedByManager,
  isContractOwnedByManager,
  isDepositOwnedByManager,
  isClientOwnedByManager,
  getScopedDataForUser,
} from './managerScopeUtils';
import { Vehicle, Contract, DepositRecord, Client, User } from '../types';

// Helper to create minimal test vehicle
const makeVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: 'veh-1',
  brand: 'Peugeot',
  model: '208',
  plate: '12345-A-1',
  fuelType: 'Diesel',
  status: 'available',
  currentKm: 25000,
  ...overrides,
});

// Helper to create minimal test contract
const makeContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 'ctr-1',
  contractNumber: 'MC-2026-001',
  status: 'active',
  clientId: 'cli-1',
  clientSnapshot: {
    id: 'cli-1',
    firstName: 'Karim',
    lastName: 'Alaoui',
    birthDate: '1990-05-15',
    drivingLicense: 'B123456',
    docType: 'CIN',
    docNumber: 'AB123456',
  },
  hasSecondDriver: false,
  vehicleId: 'veh-1',
  vehicleSnapshot: {
    id: 'veh-1',
    brand: 'Peugeot',
    model: '208',
    plate: '12345-A-1',
    fuelType: 'Diesel',
  },
  startDate: '2026-03-01',
  startTime: '10:00',
  endDate: '2026-03-05',
  endTime: '10:00',
  departureKm: 25000,
  prolongation: { isActive: false, newEndDate: '', newEndTime: '' },
  termsVersion: 'v1.0',
  totalDays: 4,
  pricePerDay: 300,
  totalAmount: 1200,
  depositAmount: 5000,
  createdAt: '2026-03-01T09:00:00Z',
  createdBy: 'Mohamed Ezzay',
  ...overrides,
});

// Helper to create minimal test deposit
const makeDeposit = (overrides: Partial<DepositRecord> = {}): DepositRecord => ({
  id: 'dep-1',
  contractId: 'ctr-1',
  contractNumber: 'MC-2026-001',
  clientId: 'cli-1',
  clientName: 'Karim Alaoui',
  clientPhone: '+212600000000',
  vehiclePlate: '12345-A-1',
  vehicleName: 'Peugeot 208',
  amount: 5000,
  method: 'preauth_card',
  status: 'held',
  receivedAt: '2026-03-01T10:00:00Z',
  receivedBy: 'Mohamed Ezzay',
  deductions: [],
  ...overrides,
});

// Helper to create minimal test client
const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'cli-1',
  firstName: 'Karim',
  lastName: 'Alaoui',
  birthDate: '1990-05-15',
  drivingLicense: 'B123456',
  docType: 'CIN',
  docNumber: 'AB123456',
  createdAt: '2026-01-10T10:00:00Z',
  contractCount: 1,
  ...overrides,
});

describe('managerScopeUtils', () => {
  describe('isVehicleOwnedByManager', () => {
    it('returns true when vehicle is directly assigned by assignedManagerId', () => {
      const veh = makeVehicle({ assignedManagerId: 'mgr-said' });
      expect(isVehicleOwnedByManager(veh, 'mgr-said')).toBe(true);
    });

    it('returns true when vehicle is proposedBy managerName (case insensitive and trimmed)', () => {
      const veh = makeVehicle({ proposedBy: '  Said Khomri  ' });
      expect(isVehicleOwnedByManager(veh, 'mgr-said', 'said khomri')).toBe(true);
      expect(isVehicleOwnedByManager(veh, 'mgr-said', 'SAID KHOMRI')).toBe(true);
    });

    it('returns true when vehicle assignedManagerName matches managerName (case insensitive)', () => {
      const veh = makeVehicle({ assignedManagerName: 'Mohamed Ezzay' });
      expect(isVehicleOwnedByManager(veh, 'mgr-mohamed', 'mohamed ezzay')).toBe(true);
      expect(isVehicleOwnedByManager(veh, 'mgr-mohamed', '  MOHAMED EZZAY  ')).toBe(true);
    });

    it('returns false when IDs are similar but not equal', () => {
      const veh = makeVehicle({ assignedManagerId: 'mgr-said-10' });
      expect(isVehicleOwnedByManager(veh, 'mgr-said-1')).toBe(false);
      expect(isVehicleOwnedByManager(veh, 'mgr-said')).toBe(false);
    });

    it('returns false when managerName is a partial substring rather than full match', () => {
      const veh = makeVehicle({ assignedManagerName: 'Said Khomri' });
      expect(isVehicleOwnedByManager(veh, 'mgr-other', 'Said')).toBe(false);
    });

    it('returns false when neither ID nor name match', () => {
      const veh = makeVehicle({
        assignedManagerId: 'mgr-larbi',
        assignedManagerName: 'Larbi Khomri',
      });
      expect(isVehicleOwnedByManager(veh, 'mgr-said', 'Said Khomri')).toBe(false);
    });

    it('handles missing, empty, null, or undefined parameters safely', () => {
      const veh = makeVehicle();
      expect(isVehicleOwnedByManager(null as any, 'mgr-said')).toBe(false);
      expect(isVehicleOwnedByManager(undefined as any, 'mgr-said')).toBe(false);
      expect(isVehicleOwnedByManager(veh, '')).toBe(false);
      expect(isVehicleOwnedByManager(veh, null as any)).toBe(false);
      expect(isVehicleOwnedByManager(veh, 'mgr-said', undefined)).toBe(false);
    });
  });

  describe('isContractOwnedByManager', () => {
    it('returns true via Path 1: direct contract assignment (assignedManagerId)', () => {
      const contract = makeContract({ assignedManagerId: 'mgr-said' });
      expect(isContractOwnedByManager(contract, 'mgr-said', [])).toBe(true);
    });

    it('returns true via Path 2: matching rented vehicle by ID owned by manager', () => {
      const veh = makeVehicle({ id: 'veh-99', assignedManagerId: 'mgr-said' });
      const contract = makeContract({ vehicleId: 'veh-99' });
      expect(isContractOwnedByManager(contract, 'mgr-said', [veh])).toBe(true);
    });

    it('returns true via Path 2: matching rented vehicle by snapshot plate owned by manager', () => {
      const veh = makeVehicle({
        id: 'veh-different',
        plate: '88888-B-26',
        assignedManagerId: 'mgr-said',
      });
      const contract = makeContract({
        vehicleId: 'veh-unknown',
        vehicleSnapshot: {
          id: 'veh-snap',
          brand: 'Renault',
          model: 'Clio',
          plate: '  88888-B-26  ',
          fuelType: 'Diesel',
        },
      });
      expect(isContractOwnedByManager(contract, 'mgr-said', [veh])).toBe(true);
    });

    it('returns true via Path 3: createdBy matching managerName (case insensitive and trimmed)', () => {
      const contract = makeContract({ createdBy: '  Abdelkader Ouahib  ' });
      expect(
        isContractOwnedByManager(contract, 'mgr-abdel', [], 'abdelkader ouahib')
      ).toBe(true);
    });

    it('returns true via Path 4: assignedManagerName matching managerName', () => {
      const contract = makeContract({ assignedManagerName: 'Mohamed Ezzay' });
      expect(
        isContractOwnedByManager(contract, 'mgr-mohamed', [], 'MOHAMED EZZAY')
      ).toBe(true);
    });

    it('returns false when contract belongs to a different manager across all paths', () => {
      const otherVeh = makeVehicle({ id: 'veh-other', assignedManagerId: 'mgr-other' });
      const contract = makeContract({
        assignedManagerId: 'mgr-other',
        assignedManagerName: 'Other Manager',
        createdBy: 'Other Manager',
        vehicleId: 'veh-other',
      });
      expect(
        isContractOwnedByManager(contract, 'mgr-said', [otherVeh], 'Said Khomri')
      ).toBe(false);
    });

    it('handles boundary and null/undefined values safely', () => {
      expect(isContractOwnedByManager(null as any, 'mgr-said', [])).toBe(false);
      expect(isContractOwnedByManager(undefined as any, 'mgr-said', [])).toBe(false);
      expect(isContractOwnedByManager(makeContract(), '', [])).toBe(false);
    });
  });

  describe('isDepositOwnedByManager', () => {
    it('returns true when deposit is linked to contract owned by manager (by contractId)', () => {
      const contract = makeContract({ id: 'ctr-100', assignedManagerId: 'mgr-said' });
      const deposit = makeDeposit({ contractId: 'ctr-100' });
      expect(isDepositOwnedByManager(deposit, 'mgr-said', [contract], [])).toBe(true);
    });

    it('returns true when deposit is linked to contract owned by manager (by contractNumber)', () => {
      const contract = makeContract({
        id: 'ctr-diff',
        contractNumber: 'MC-SPECIFIC-2026',
        assignedManagerId: 'mgr-said',
      });
      const deposit = makeDeposit({
        contractId: 'ctr-unknown',
        contractNumber: 'MC-SPECIFIC-2026',
      });
      expect(isDepositOwnedByManager(deposit, 'mgr-said', [contract], [])).toBe(true);
    });

    it('returns true when deposit is matched by vehiclePlate owned by manager', () => {
      const veh = makeVehicle({ plate: '55555-D-1', assignedManagerId: 'mgr-said' });
      const deposit = makeDeposit({
        contractId: 'non-existent',
        contractNumber: 'non-existent',
        vehiclePlate: ' 55555-D-1 ',
      });
      expect(isDepositOwnedByManager(deposit, 'mgr-said', [], [veh])).toBe(true);
    });

    it('returns true when deposit receivedBy matches managerName', () => {
      const deposit = makeDeposit({
        contractId: 'ctr-other',
        contractNumber: 'MC-OTHER',
        vehiclePlate: '99999-Z-9',
        receivedBy: '  Said Khomri  ',
      });
      expect(
        isDepositOwnedByManager(deposit, 'mgr-said', [], [], 'said khomri')
      ).toBe(true);
    });

    it('returns false when deposit belongs entirely to another manager', () => {
      const otherContract = makeContract({
        id: 'ctr-other',
        contractNumber: 'MC-OTHER',
        assignedManagerId: 'mgr-other',
      });
      const otherVeh = makeVehicle({
        plate: '99999-Z-9',
        assignedManagerId: 'mgr-other',
      });
      const deposit = makeDeposit({
        contractId: 'ctr-other',
        contractNumber: 'MC-OTHER',
        vehiclePlate: '99999-Z-9',
        receivedBy: 'Other Person',
      });
      expect(
        isDepositOwnedByManager(deposit, 'mgr-said', [otherContract], [otherVeh], 'Said Khomri')
      ).toBe(false);
    });

    it('does not falsely match a contract when deposit and contract both lack contractNumber (regression test)', () => {
      const contractWithoutNumber = makeContract({
        id: 'ctr-without-num',
        contractNumber: undefined as any,
        assignedManagerId: 'mgr-said',
      });
      const unlinkedDeposit = makeDeposit({
        id: 'dep-unlinked',
        contractId: undefined,
        contractNumber: undefined as any,
        vehiclePlate: undefined,
        receivedBy: undefined,
      });

      expect(
        isDepositOwnedByManager(unlinkedDeposit, 'mgr-said', [contractWithoutNumber], [])
      ).toBe(false);
    });

    it('matches deposit by contractId even when contractNumber is undefined on both', () => {
      const contractWithoutNumber = makeContract({
        id: 'ctr-target-id',
        contractNumber: undefined as any,
        assignedManagerId: 'mgr-said',
      });
      const depositWithId = makeDeposit({
        id: 'dep-target',
        contractId: 'ctr-target-id',
        contractNumber: undefined as any,
      });

      expect(
        isDepositOwnedByManager(depositWithId, 'mgr-said', [contractWithoutNumber], [])
      ).toBe(true);
    });

    it('handles null/undefined deposit or empty manager ID', () => {
      expect(isDepositOwnedByManager(null as any, 'mgr-said', [], [])).toBe(false);
      expect(isDepositOwnedByManager(makeDeposit(), '', [], [])).toBe(false);
    });
  });

  describe('isClientOwnedByManager', () => {
    it('returns true when client has assignedManagerId matching managerId', () => {
      const client = makeClient({ assignedManagerId: 'mgr-said' });
      expect(isClientOwnedByManager(client, 'mgr-said', [], [])).toBe(true);
    });

    it('returns false when client is explicitly assigned to another manager', () => {
      const client = makeClient({ assignedManagerId: 'mgr-other' });
      expect(isClientOwnedByManager(client, 'mgr-said', [], [])).toBe(false);
    });

    it('returns false when client is renting a vehicle belonging to another manager', () => {
      const client = makeClient({ id: 'cli-renting', docNumber: 'CIN-RENT' });
      const otherVeh = makeVehicle({ id: 'veh-other', assignedManagerId: 'mgr-other' });
      const activeContract = makeContract({
        clientId: 'cli-renting',
        vehicleId: 'veh-other',
        status: 'active',
      });

      expect(
        isClientOwnedByManager(client, 'mgr-said', [activeContract], [otherVeh])
      ).toBe(false);
    });

    it('returns true when client has no manager assigned and no conflicting contracts', () => {
      const openClient = makeClient({ assignedManagerId: undefined });
      expect(isClientOwnedByManager(openClient, 'mgr-said', [], [])).toBe(true);
    });

    it('handles null, undefined or empty managerId', () => {
      expect(isClientOwnedByManager(null as any, 'mgr-said', [], [])).toBe(false);
      expect(isClientOwnedByManager(makeClient(), '', [], [])).toBe(false);
    });
  });

  describe('getScopedDataForUser', () => {
    const vehSaid = makeVehicle({ id: 'v-said', plate: '11111-A-1', assignedManagerId: 'mgr-said' });
    const vehLarbi = makeVehicle({ id: 'v-larbi', plate: '22222-B-2', assignedManagerId: 'mgr-larbi' });
    const allVehicles = [vehSaid, vehLarbi];

    const cliSaid = makeClient({
      id: 'cli-said',
      firstName: 'Karim',
      lastName: 'Alaoui',
      docNumber: 'CIN-SAID-1',
      assignedManagerId: 'mgr-said',
    });
    const cliLarbi = makeClient({
      id: 'cli-larbi',
      firstName: 'Larbi',
      lastName: 'Khomri',
      docNumber: 'CIN-LARBI-2',
      assignedManagerId: 'mgr-larbi',
    });
    const allClients = [cliSaid, cliLarbi];

    const ctrSaid = makeContract({
      id: 'c-said',
      contractNumber: 'MC-2026-001',
      clientId: 'cli-said',
      clientSnapshot: {
        id: 'cli-said',
        firstName: 'Karim',
        lastName: 'Alaoui',
        birthDate: '1990-05-15',
        drivingLicense: 'B123456',
        docType: 'CIN',
        docNumber: 'CIN-SAID-1',
      },
      assignedManagerId: 'mgr-said',
      vehicleId: 'v-said',
    });
    const ctrLarbi = makeContract({
      id: 'c-larbi',
      contractNumber: 'MC-2026-002',
      clientId: 'cli-larbi',
      clientSnapshot: {
        id: 'cli-larbi',
        firstName: 'Larbi',
        lastName: 'Khomri',
        birthDate: '1985-02-20',
        drivingLicense: 'B654321',
        docType: 'CIN',
        docNumber: 'CIN-LARBI-2',
      },
      assignedManagerId: 'mgr-larbi',
      vehicleId: 'v-larbi',
    });
    const allContracts = [ctrSaid, ctrLarbi];

    const depSaid = makeDeposit({
      id: 'd-said',
      contractId: 'c-said',
      contractNumber: 'MC-2026-001',
      clientId: 'cli-said',
      clientName: 'Karim Alaoui',
      vehiclePlate: '11111-A-1',
    });
    const depLarbi = makeDeposit({
      id: 'd-larbi',
      contractId: 'c-larbi',
      contractNumber: 'MC-2026-002',
      clientId: 'cli-larbi',
      clientName: 'Larbi Khomri',
      vehiclePlate: '22222-B-2',
    });
    const allDeposits = [depSaid, depLarbi];

    it('returns all data unrestricted when currentUser is Admin', () => {
      const adminUser: User = {
        id: 'usr-admin',
        name: 'Anouar Gérant',
        email: 'anouar@morvellocars.com',
        role: 'admin',
      };

      const result = getScopedDataForUser(
        adminUser,
        allVehicles,
        allContracts,
        allDeposits,
        allClients
      );

      expect(result.isRestricted).toBe(false);
      expect(result.scopedVehicles).toHaveLength(2);
      expect(result.scopedContracts).toHaveLength(2);
      expect(result.scopedDeposits).toHaveLength(2);
      expect(result.scopedClients).toHaveLength(2);
    });

    it('returns all data unrestricted when currentUser is null (default fallback)', () => {
      const result = getScopedDataForUser(
        null,
        allVehicles,
        allContracts,
        allDeposits,
        allClients
      );

      expect(result.isRestricted).toBe(false);
      expect(result.scopedVehicles).toEqual(allVehicles);
    });

    it('strictly isolates data when currentUser is a Manager', () => {
      const managerSaid: User = {
        id: 'mgr-said',
        name: 'Said Khomri',
        email: 'said.khomri@morvellocars.com',
        role: 'manager',
      };

      const result = getScopedDataForUser(
        managerSaid,
        allVehicles,
        allContracts,
        allDeposits,
        allClients
      );

      expect(result.isRestricted).toBe(true);
      // Said must only see his own vehicle
      expect(result.scopedVehicles.map((v) => v.id)).toEqual(['v-said']);
      // Said must only see his own contract
      expect(result.scopedContracts.map((c) => c.id)).toEqual(['c-said']);
      // Said must only see his own deposit
      expect(result.scopedDeposits.map((d) => d.id)).toEqual(['d-said']);
      // Said must only see his own client, Larbi client is excluded
      expect(result.scopedClients.map((c) => c.id)).toEqual(['cli-said']);
    });
  });
});
