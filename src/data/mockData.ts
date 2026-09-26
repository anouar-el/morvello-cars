import {
  Client,
  Driver,
  Vehicle,
  Contract,
  CompanySettings,
  AuditLog,
  User,
  DepositRecord,
} from '../types';

/**
 * Empty bootstrap state. Production records must come from the authenticated
 * backend; no customer, employee, vehicle, or financial data belongs in the
 * browser bundle or Git history.
 */
export const initialCompanySettings: CompanySettings = {
  name: 'Morvello Cars',
  taxId: '',
  rc: '',
  ice: '',
  address: '',
  phone1: '',
  phone2: '',
  assistancePhone: '',
  website: '',
  email: '',
  contractPrefix: 'MC',
  contractYear: new Date().getFullYear(),
  nextContractNumber: 1,
  defaultContractTemplate: 'standard',
};

export const initialUsers: User[] = [];
export const initialClients: Client[] = [];
export const initialDrivers: Driver[] = [];
export const initialVehicles: Vehicle[] = [];
export const initialDeposits: DepositRecord[] = [];
export const initialContracts: Contract[] = [];
export const initialAuditLogs: AuditLog[] = [];
