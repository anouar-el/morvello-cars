import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import {
  Client,
  Driver,
  Vehicle,
  VehicleExpense,
  Contract,
  CompanySettings,
  TermsVersion,
  TermClause,
  AuditLog,
  User,
  UserRole,
  UserPermissions,
  ActiveTab,
  DepositRecord,
  DepositDeduction,
  ContractInspection,
  ThemeMode,
  AiAssistantSettings,
  PaymentRecord,
  PaymentMethod,
} from '../types';
import {
  initialClients,
  initialDrivers,
  initialVehicles,
  initialContracts,
  initialCompanySettings,
  initialAuditLogs,
  initialUsers,
  initialDeposits,
} from '../data/mockData';
import { initialTermsVersion } from '../data/termsData';
import { fetchRemoteAgencyData, saveRemoteAgencyData, subscribeToRemoteAgencyData } from '../lib/firestoreSync';
import { isAbortException } from '../initErrorHandling';
import { resolveClientManagerAndVehicle, ClientManagerAssignment } from '../utils/clientManagerUtils';
import {
  reconcileCompanySettingsWithContracts,
  findDuplicateContractNumbers,
  DuplicateContractReport,
} from '../utils/contractNumberUtils';
import { reconcileVehiclesWithContracts } from '../utils/vehicleStatusUtils';
import { reconcileClientsWithContracts } from '../utils/clientSyncUtils';
import { formatPlateFrench } from '../utils/plateUtils';

import { AuthProvider, useAuth } from './AuthContext';
import { VehiclesProvider, useVehicles } from './VehiclesContext';
import { ClientsDriversProvider, useClientsDrivers } from './ClientsDriversContext';
import { DepositsProvider, useDeposits } from './DepositsContext';
import { CompanyProvider, useCompany, CloudSyncStatus } from './CompanyContext';
import { ContractsProvider, useContracts } from './ContractsContext';

export type { CloudSyncStatus };

export interface AppContextType {
  clients: Client[];
  drivers: Driver[];
  vehicles: Vehicle[];
  contracts: Contract[];
  deposits: DepositRecord[];
  termsVersion: TermsVersion;
  companySettings: CompanySettings;
  auditLogs: AuditLog[];
  users: User[];
  availableUsers: User[];
  currentUser: User | null;
  activeTab: ActiveTab;
  selectedContract: Contract | null;
  selectedClient: Client | null;
  selectedVehicle: Vehicle | null;
  pdfModalContract: Contract | null;
  isPdfModalOpen: boolean;
  duplicateContractData: Contract | null;
  editingContractData: Contract | null;

  // Theme (Dark Mode / Light Mode)
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;

  // Cloud Firestore state & actions
  cloudSyncStatus: CloudSyncStatus;
  lastCloudSync: string | null;
  syncWithCloud: () => Promise<boolean>;
  pushToCloud: () => Promise<boolean>;

  // Actions
  setActiveTab: (tab: ActiveTab) => void;
  setCurrentUserRole: (role: UserRole) => void;
  switchUser: (userId: string) => void;
  updateUserPermissions: (userId: string, permissions: Partial<UserPermissions>) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  resetUserPermissions: (userId: string) => void;
  addUser: (userData: Omit<User, 'id'> & { password?: string }) => Promise<User>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => void;
  hasPermission: (perm: keyof UserPermissions) => boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void> | void;
  changeUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  sendResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;

  // Terms & Clauses Management (Gérant)
  updateTermsVersion: (terms: TermsVersion) => void;
  addTermsClause: (clause: TermClause) => void;
  updateTermsClause: (number: string, clauseData: Partial<TermClause>) => void;
  deleteTermsClause: (number: string) => void;

  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'contractCount'>) => Client;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => { success: boolean; error?: string };
  addDriver: (driver: Omit<Driver, 'id' | 'createdAt'>) => Driver;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Vehicle;
  updateVehicle: (id: string, data: Partial<Vehicle>) => void;
  approveVehicle: (vehicleId: string, assignedManagerId?: string) => void;
  rejectVehicle: (vehicleId: string, reason?: string) => void;
  assignVehicleManager: (vehicleId: string, managerId: string, managerName: string) => void;
  deleteVehicle: (vehicleId: string) => { success: boolean; error?: string };
  addVehicleExpense: (
    vehicleId: string,
    expenseData: Omit<VehicleExpense, 'id' | 'createdAt' | 'vehicleId'>
  ) => VehicleExpense;
  deleteVehicleExpense: (vehicleId: string, expenseId: string) => void;
  createContract: (contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>) => Contract;
  updateContract: (id: string, data: Partial<Contract>) => Contract | undefined;
  addPaymentToContract: (
    contractId: string,
    payment: Omit<PaymentRecord, 'id' | 'date'> & { date?: string; id?: string },
    actorName?: string
  ) => Contract | undefined;
  updateContractPayment: (
    contractId: string,
    paymentId: string,
    paymentData: Partial<PaymentRecord>,
    actorName?: string
  ) => Contract | undefined;
  deleteContractPayment: (
    contractId: string,
    paymentId: string,
    actorName?: string
  ) => Contract | undefined;
  updateContractFinancials: (
    contractId: string,
    financials: {
      pricePerDay?: number;
      totalAmount?: number;
      totalDays?: number;
      depositAmount?: number;
    },
    actorName?: string
  ) => Contract | undefined;
  settleContractBalance: (
    contractId: string,
    actorName?: string,
    method?: PaymentMethod,
    notes?: string
  ) => Contract | undefined;
  refreshActiveContracts: () => void;
  startEditingContract: (contract: Contract) => void;
  clearEditingData: () => void;
  completeContract: (id: string, returnKm: number, returnDate: string, returnTime: string, notes?: string) => void;
  cancelContract: (id: string, reason?: string) => void;
  deleteContract: (id: string) => { success: boolean; error?: string };
  duplicateContract: (contract: Contract) => void;
  clearDuplicateData: () => void;
  updateCompanySettings: (settings: Partial<CompanySettings>) => void;
  aiSettings: AiAssistantSettings;
  updateAiSettings: (settings: Partial<AiAssistantSettings>) => void;
  resetAiSettings: () => void;
  addAuditLog: (action: string, targetType: AuditLog['targetType'], targetId: string, details: string) => void;
  openPdfModal: (contract: Contract) => void;
  closePdfModal: () => void;
  setSelectedContract: (contract: Contract | null) => void;
  setSelectedClient: (client: Client | null) => void;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;

  // Deposit management actions
  updateDeposit: (id: string, data: Partial<DepositRecord>) => void;
  releaseDeposit: (depositId: string, refundedAmount: number, notes?: string) => void;
  deductDeposit: (depositId: string, deduction: Omit<DepositDeduction, 'id' | 'date'>, refundedRemaining?: boolean) => void;

  // Inspection photos action
  updateContractInspection: (contractId: string, inspection: ContractInspection) => void;

  // Duplicate contract management
  duplicateContractReports: DuplicateContractReport[];
  repairDuplicateContracts: () => { renumberedCount: number };

  // Affectation Manager via véhicule loué
  getClientAssignedManager: (client: Client) => ClientManagerAssignment;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppContextInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const company = useCompany();
  const auth = useAuth();
  const vehiclesCtx = useVehicles();
  const clientsDrivers = useClientsDrivers();
  const depositsCtx = useDeposits();
  const contractsCtx = useContracts();

  // Cloud Firestore Sync Actions
  const syncWithCloud = useCallback(async (): Promise<boolean> => {
    company.setCloudSyncStatus('syncing');
    try {
      const remote = await fetchRemoteAgencyData();

      // Intelligent Bidirectional Reconciliation:
      // Preserves existing local items (e.g. contracts or clients created in this browser)
      // while pulling remote cloud records so no data is ever lost across browsers.
      let shouldPushBack = false;

      // 1. Contracts Merge
      const localContracts = contractsCtx.contracts;
      const remoteContracts = remote?.contracts || [];
      const mergedContracts = [...remoteContracts];
      for (const lc of localContracts) {
        if (!mergedContracts.some((rc) => rc.id === lc.id || (rc.contractNumber && rc.contractNumber === lc.contractNumber))) {
          mergedContracts.push(lc);
          shouldPushBack = true;
        }
      }
      if (mergedContracts.length > 0) {
        contractsCtx.setContractsList(mergedContracts);
      }

      // 2. Vehicles Merge & Reconcile with active contracts
      const localVehicles = vehiclesCtx.vehicles;
      const remoteVehicles = remote?.vehicles || [];
      const mergedVehicles = [...remoteVehicles];
      for (const lv of localVehicles) {
        if (!mergedVehicles.some((rv) => rv.id === lv.id || (rv.plate && lv.plate && rv.plate.trim().toUpperCase() === lv.plate.trim().toUpperCase()))) {
          mergedVehicles.push(lv);
          shouldPushBack = true;
        }
      }
      const rawVehicles = mergedVehicles.length > 0 ? mergedVehicles : localVehicles;
      const reconciledVehicles = reconcileVehiclesWithContracts(rawVehicles, mergedContracts);
      if (reconciledVehicles.length > 0) {
        vehiclesCtx.setVehiclesList(reconciledVehicles);
      }

      // 3. Clients Merge & Reconcile with contracts
      const localClients = clientsDrivers.clients;
      const remoteClients = remote?.clients || [];
      const mergedClients = [...remoteClients];
      for (const lcli of localClients) {
        if (!mergedClients.some((rcli) => rcli.id === lcli.id || (rcli.docNumber && lcli.docNumber && rcli.docNumber.trim().toUpperCase() === lcli.docNumber.trim().toUpperCase()))) {
          mergedClients.push(lcli);
          shouldPushBack = true;
        }
      }
      const rawClients = mergedClients.length > 0 ? mergedClients : localClients;
      const reconciledClients = reconcileClientsWithContracts(
        rawClients,
        mergedContracts,
        rawVehicles,
        remote?.users || auth.users
      );
      if (reconciledClients.length > mergedClients.length) {
        shouldPushBack = true;
      }
      if (reconciledClients.length > 0) {
        clientsDrivers.setClientsList(reconciledClients);
      }

      // 4. Deposits Merge
      const localDeposits = depositsCtx.deposits;
      const remoteDeposits = remote?.deposits || [];
      const mergedDeposits = [...remoteDeposits];
      for (const ld of localDeposits) {
        if (!mergedDeposits.some((rd) => rd.id === ld.id)) {
          mergedDeposits.push(ld);
          shouldPushBack = true;
        }
      }
      if (mergedDeposits.length > 0) {
        depositsCtx.setDepositsList(mergedDeposits);
      }

      // 5. Drivers
      if (remote?.drivers && remote.drivers.length > 0) {
        clientsDrivers.setDriversList(remote.drivers);
      }

      // 6. Company Settings
      const activeSettings = remote?.companySettings || company.companySettings;
      const reconciledSettings = reconcileCompanySettingsWithContracts(
        activeSettings,
        mergedContracts
      );
      company.setCompanySettingsList(reconciledSettings);

      if (remote?.termsVersion) {
        company.setTermsVersionList(remote.termsVersion);
      }
      if (remote?.aiSettings) {
        company.setAiSettingsList(remote.aiSettings);
      }
      if (remote?.auditLogs && remote.auditLogs.length > 0) {
        company.setAuditLogsList(remote.auditLogs);
      }
      if (remote?.users && remote.users.length > 0) {
        auth.setUsersList(remote.users);
      }

      // If local browser held records that cloud lacked, or if cloud was not populated:
      if (shouldPushBack || !remote || remoteContracts.length < mergedContracts.length) {
        saveRemoteAgencyData({
          vehicles: reconciledVehicles,
          clients: reconciledClients,
          drivers: clientsDrivers.drivers,
          contracts: mergedContracts,
          deposits: mergedDeposits,
          companySettings: reconciledSettings,
          termsVersion: remote?.termsVersion || company.termsVersion,
          aiSettings: remote?.aiSettings || company.aiSettings,
          auditLogs: remote?.auditLogs || company.auditLogs,
          users: remote?.users || auth.users,
        }).catch((err) => console.warn('Automatic cloud synchronization push notice:', err));
      }

      const syncTime = new Date().toISOString();
      company.setLastCloudSync(syncTime);
      localStorage.setItem('morvello_last_cloud_sync', syncTime);
      company.setCloudSyncStatus('synced');
      return true;
    } catch (err) {
      console.warn('Sync with cloud failed:', err);
      company.setCloudSyncStatus('error');
      return false;
    }
  }, [company, auth, vehiclesCtx, clientsDrivers, depositsCtx, contractsCtx]);

  const pushToCloud = useCallback(async (): Promise<boolean> => {
    company.setCloudSyncStatus('syncing');
    try {
      const success = await saveRemoteAgencyData({
        vehicles: vehiclesCtx.vehicles,
        clients: clientsDrivers.clients,
        drivers: clientsDrivers.drivers,
        contracts: contractsCtx.contracts,
        deposits: depositsCtx.deposits,
        companySettings: company.companySettings,
        termsVersion: company.termsVersion,
        aiSettings: company.aiSettings,
        auditLogs: company.auditLogs,
        users: auth.users,
      });

      if (success) {
        const syncTime = new Date().toISOString();
        company.setLastCloudSync(syncTime);
        localStorage.setItem('morvello_last_cloud_sync', syncTime);
        company.setCloudSyncStatus('synced');
        return true;
      } else {
        company.setCloudSyncStatus('error');
        return false;
      }
    } catch (err) {
      console.warn('Push to cloud failed:', err);
      company.setCloudSyncStatus('error');
      return false;
    }
  }, [company, auth, vehiclesCtx, clientsDrivers, depositsCtx, contractsCtx]);

  // Store latest context references for stable callbacks without triggering effect loops
  const contextsRef = useRef({
    vehiclesCtx,
    clientsDrivers,
    contractsCtx,
    depositsCtx,
    company,
    auth,
    syncWithCloud,
  });

  useEffect(() => {
    contextsRef.current = {
      vehiclesCtx,
      clientsDrivers,
      contractsCtx,
      depositsCtx,
      company,
      auth,
      syncWithCloud,
    };
  });

  // Real-time multi-workstation sync using Firestore onSnapshot
  useEffect(() => {
    let active = true;

    // Initial fetch to load remote state immediately
    contextsRef.current.syncWithCloud().catch((err) => {
      if (!active || isAbortException(err)) return;
      console.warn('Initial cloud sync notice:', err);
    });

    // Subscribe to real-time Firestore updates across all agency workstations
    const unsubscribe = subscribeToRemoteAgencyData(
      (remote) => {
        if (!active || !remote) return;
        const ctx = contextsRef.current;

        let effectiveContracts = ctx.contractsCtx.contracts;
        if (remote.contracts && remote.contracts.length > 0) {
          const current = ctx.contractsCtx.contracts;
          const merged = [...remote.contracts];
          for (const c of current) {
            if (!merged.some((m) => m.id === c.id || (m.contractNumber && m.contractNumber === c.contractNumber))) {
              merged.push(c);
            }
          }
          effectiveContracts = merged;
          ctx.contractsCtx.setContractsList(merged);
        }

        if (remote.clients && remote.clients.length > 0) {
          const current = ctx.clientsDrivers.clients;
          const merged = [...remote.clients];
          for (const c of current) {
            if (!merged.some((m) => m.id === c.id || (m.docNumber && c.docNumber && m.docNumber.trim().toUpperCase() === c.docNumber.trim().toUpperCase()))) {
              merged.push(c);
            }
          }
          const reconciledCli = reconcileClientsWithContracts(
            merged,
            effectiveContracts,
            ctx.vehiclesCtx.vehicles,
            ctx.auth.users
          );
          ctx.clientsDrivers.setClientsList(reconciledCli);
        } else if (effectiveContracts.length > 0) {
          const current = ctx.clientsDrivers.clients;
          const reconciledCli = reconcileClientsWithContracts(
            current,
            effectiveContracts,
            ctx.vehiclesCtx.vehicles,
            ctx.auth.users
          );
          ctx.clientsDrivers.setClientsList(reconciledCli);
        }

        if (remote.vehicles && remote.vehicles.length > 0) {
          const current = ctx.vehiclesCtx.vehicles;
          const merged = [...remote.vehicles];
          for (const v of current) {
            if (!merged.some((m) => m.id === v.id || (m.plate && v.plate && m.plate.trim().toUpperCase() === v.plate.trim().toUpperCase()))) {
              merged.push(v);
            }
          }
          const reconciled = reconcileVehiclesWithContracts(merged, effectiveContracts);
          ctx.vehiclesCtx.setVehiclesList(reconciled);
        } else {
          const current = ctx.vehiclesCtx.vehicles;
          const reconciled = reconcileVehiclesWithContracts(current, effectiveContracts);
          ctx.vehiclesCtx.setVehiclesList(reconciled);
        }

        if (remote.deposits && remote.deposits.length > 0) {
          const current = ctx.depositsCtx.deposits;
          const merged = [...remote.deposits];
          for (const d of current) {
            if (!merged.some((m) => m.id === d.id)) {
              merged.push(d);
            }
          }
          ctx.depositsCtx.setDepositsList(merged);
        }

        if (remote.drivers && remote.drivers.length > 0) {
          ctx.clientsDrivers.setDriversList(remote.drivers);
        }

        if (remote.companySettings) {
          const contractsForReconcile =
            remote.contracts && remote.contracts.length > 0
              ? remote.contracts
              : ctx.contractsCtx.contracts;
          const reconciled = reconcileCompanySettingsWithContracts(
            remote.companySettings,
            contractsForReconcile
          );
          ctx.company.setCompanySettingsList(reconciled);
        }
        if (remote.termsVersion) {
          ctx.company.setTermsVersionList(remote.termsVersion);
        }
        if (remote.aiSettings) {
          ctx.company.setAiSettingsList(remote.aiSettings);
        }
        if (remote.auditLogs && remote.auditLogs.length > 0) {
          ctx.company.setAuditLogsList(remote.auditLogs);
        }
        if (remote.users && remote.users.length > 0) {
          ctx.auth.setUsersList(remote.users);
        }

        const syncTime = remote.updatedAt || new Date().toISOString();
        ctx.company.setLastCloudSync(syncTime);
        localStorage.setItem('morvello_last_cloud_sync', syncTime);
        ctx.company.setCloudSyncStatus('synced');
      },
      (err) => {
        if (!active || isAbortException(err)) return;
        console.warn('Real-time Firestore sync notice:', err);
        contextsRef.current.company.setCloudSyncStatus('error');
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const createContract = (
    contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>
  ): Contract => {
    return contractsCtx.createContract(contractData, {
      currentUser: auth.currentUser,
      companySettings: company.companySettings,
      termsVersion: company.termsVersion,
      vehicles: vehiclesCtx.vehicles,
      users: auth.users,
      onUpdateCompanySettings: company.updateCompanySettings,
      onAddDeposit: depositsCtx.addDepositRecord,
      onUpdateVehicles: vehiclesCtx.setVehiclesListByUpdater,
      onUpdateClients: clientsDrivers.setClientsListByUpdater,
    });
  };

  // Synchronize contract depositAmount with deposits context
  const syncContractDeposit = useCallback((contract: Contract, newDepositAmount?: number) => {
    if (newDepositAmount === undefined) return;
    const amount = Math.max(0, Number(newDepositAmount) || 0);

    const existingIndex = depositsCtx.deposits.findIndex(
      (d) =>
        d.contractId === contract.id ||
        d.contractNumber === contract.contractNumber ||
        (contract.depositRecord && d.id === contract.depositRecord.id)
    );

    if (existingIndex >= 0) {
      const existing = depositsCtx.deposits[existingIndex];
      depositsCtx.updateDeposit(existing.id, {
        amount,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        clientId: contract.clientId || existing.clientId,
        clientName:
          `${contract.clientSnapshot?.firstName || ''} ${contract.clientSnapshot?.lastName || ''}`.trim() ||
          existing.clientName,
        clientPhone: contract.clientSnapshot?.phone || existing.clientPhone,
        vehicleName: contract.vehicleSnapshot
          ? `${contract.vehicleSnapshot.brand} ${contract.vehicleSnapshot.model}`
          : existing.vehicleName,
        vehiclePlate: contract.vehicleSnapshot
          ? formatPlateFrench(contract.vehicleSnapshot.plate)
          : existing.vehiclePlate,
        assignedManagerId: contract.assignedManagerId || existing.assignedManagerId,
        assignedManagerName: contract.assignedManagerName || existing.assignedManagerName,
      });
    } else if (amount > 0) {
      const newDeposit: DepositRecord = {
        id: `dep-${Date.now()}`,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        clientId: contract.clientId,
        clientName:
          `${contract.clientSnapshot?.firstName || ''} ${contract.clientSnapshot?.lastName || ''}`.trim() ||
          'Client',
        clientPhone: contract.clientSnapshot?.phone || '',
        vehicleName: contract.vehicleSnapshot
          ? `${contract.vehicleSnapshot.brand} ${contract.vehicleSnapshot.model}`
          : 'Véhicule',
        vehiclePlate: contract.vehicleSnapshot ? formatPlateFrench(contract.vehicleSnapshot.plate) : '',
        amount,
        method: contract.depositRecord?.method || 'preauth_card',
        methodDetails: contract.depositRecord?.methodDetails || 'Empreinte bancaire TPE',
        status: 'held',
        receivedAt: `${contract.startDate || ''} ${contract.startTime || ''}`.trim() || new Date().toISOString(),
        receivedBy: auth.currentUser?.name || 'Direction',
        deductions: [],
        notes: `Caution enregistrée pour le contrat ${contract.contractNumber}.`,
        assignedManagerId: contract.assignedManagerId,
        assignedManagerName: contract.assignedManagerName,
        createdBy: auth.currentUser?.name || 'Direction',
      };
      depositsCtx.addDepositRecord(newDeposit);
    }
  }, [depositsCtx, auth.currentUser]);

  const updateContract = (id: string, data: Partial<Contract>): Contract | undefined => {
    const updated = contractsCtx.updateContract(id, data, vehiclesCtx.setVehiclesListByUpdater);
    if (updated && data.depositAmount !== undefined) {
      syncContractDeposit(updated, data.depositAmount);
    }
    return updated;
  };

  const updateDepositAndSyncContract = useCallback((id: string, data: Partial<DepositRecord>) => {
    depositsCtx.updateDeposit(id, data);
    const existing = depositsCtx.deposits.find((d) => d.id === id);
    const contractNumber = data.contractNumber || existing?.contractNumber;
    const contractId = data.contractId || existing?.contractId;

    if (contractId || contractNumber) {
      const linkedContract = contractsCtx.contracts.find(
        (c) => (contractId && c.id === contractId) || (contractNumber && c.contractNumber === contractNumber)
      );
      if (linkedContract && data.amount !== undefined) {
        contractsCtx.updateContract(linkedContract.id, {
          depositAmount: Number(data.amount),
          depositRecord: {
            ...(existing || {}),
            ...data,
          } as DepositRecord,
        });
      }
    }
  }, [depositsCtx, contractsCtx]);

  // Reconcile contract deposit amounts with deposits records on startup
  const hasReconciledDepositsRef = useRef(false);
  useEffect(() => {
    if (hasReconciledDepositsRef.current) return;
    if (contractsCtx.contracts.length === 0 || depositsCtx.deposits.length === 0) return;
    hasReconciledDepositsRef.current = true;

    let hasChanges = false;
    const updatedDeposits = depositsCtx.deposits.map((dep) => {
      const matchedContract = contractsCtx.contracts.find(
        (c) => c.id === dep.contractId || c.contractNumber === dep.contractNumber
      );
      if (
        matchedContract &&
        matchedContract.depositAmount !== undefined &&
        matchedContract.depositAmount !== dep.amount
      ) {
        hasChanges = true;
        return {
          ...dep,
          amount: Number(matchedContract.depositAmount),
        };
      }
      return dep;
    });

    if (hasChanges) {
      depositsCtx.setDepositsList(updatedDeposits);
      saveRemoteAgencyData({ deposits: updatedDeposits }).catch((err) =>
        console.warn('Auto-save reconciled deposits to Firestore:', err)
      );
    }
  }, [contractsCtx.contracts, depositsCtx.deposits, depositsCtx]);

  const getClientAssignedManager = (client: Client): ClientManagerAssignment => {
    return resolveClientManagerAndVehicle(client, contractsCtx.contracts, vehiclesCtx.vehicles, auth.users);
  };

  const duplicateContractReports = React.useMemo(
    () => findDuplicateContractNumbers(contractsCtx.contracts),
    [contractsCtx.contracts]
  );

  const repairDuplicateContracts = useCallback(() => {
    return contractsCtx.repairDuplicateContracts(
      depositsCtx.deposits,
      company.companySettings,
      depositsCtx.setDepositsList,
      company.updateCompanySettings
    );
  }, [contractsCtx, depositsCtx, company]);

  return (
    <AppContext.Provider
      value={{
        clients: clientsDrivers.clients,
        drivers: clientsDrivers.drivers,
        vehicles: vehiclesCtx.vehicles,
        contracts: contractsCtx.contracts,
        deposits: depositsCtx.deposits,
        termsVersion: company.termsVersion,
        companySettings: company.companySettings,
        auditLogs: company.auditLogs,
        users: auth.users,
        availableUsers: auth.users,
        currentUser: auth.currentUser,
        activeTab: company.activeTab,
        selectedContract: contractsCtx.selectedContract,
        selectedClient: clientsDrivers.selectedClient,
        selectedVehicle: vehiclesCtx.selectedVehicle,
        pdfModalContract: contractsCtx.pdfModalContract,
        isPdfModalOpen: contractsCtx.isPdfModalOpen,
        duplicateContractData: contractsCtx.duplicateContractData,
        editingContractData: contractsCtx.editingContractData,
        duplicateContractReports,
        repairDuplicateContracts,
        theme: company.theme,
        toggleTheme: company.toggleTheme,
        setTheme: company.setTheme,
        cloudSyncStatus: company.cloudSyncStatus,
        lastCloudSync: company.lastCloudSync,
        syncWithCloud,
        pushToCloud,
        setActiveTab: company.setActiveTab,
        setCurrentUserRole: auth.setCurrentUserRole,
        switchUser: auth.switchUser,
        updateUserPermissions: auth.updateUserPermissions,
        updateUserRole: auth.updateUserRole,
        resetUserPermissions: auth.resetUserPermissions,
        addUser: auth.addUser,
        updateUser: auth.updateUser,
        deleteUser: auth.deleteUser,
        hasPermission: auth.hasPermission,
        login: auth.login,
        loginWithGoogle: auth.loginWithGoogle,
        logout: auth.logout,
        changeUserPassword: auth.changeUserPassword,
        sendResetEmail: auth.sendResetEmail,
        updateTermsVersion: company.updateTermsVersion,
        addTermsClause: (clause) => company.addTermsClause(clause, auth.currentUser?.name),
        updateTermsClause: (number, data) => company.updateTermsClause(number, data, auth.currentUser?.name),
        deleteTermsClause: (number) => company.deleteTermsClause(number, auth.currentUser?.name),
        addClient: clientsDrivers.addClient,
        updateClient: clientsDrivers.updateClient,
        deleteClient: clientsDrivers.deleteClient,
        addDriver: clientsDrivers.addDriver,
        addVehicle: vehiclesCtx.addVehicle,
        updateVehicle: vehiclesCtx.updateVehicle,
        approveVehicle: vehiclesCtx.approveVehicle,
        rejectVehicle: vehiclesCtx.rejectVehicle,
        assignVehicleManager: vehiclesCtx.assignVehicleManager,
        deleteVehicle: (id) =>
          vehiclesCtx.deleteVehicle(
            id,
            auth.currentUser,
            (vehicleId) =>
              contractsCtx.contracts.some(
                (c) => c.vehicleId === vehicleId && (c.status === 'active' || c.status === 'draft')
              )
          ),
        addVehicleExpense: (vehicleId, expenseData) =>
          vehiclesCtx.addVehicleExpense(vehicleId, expenseData, auth.currentUser),
        deleteVehicleExpense: (vehicleId, expenseId) =>
          vehiclesCtx.deleteVehicleExpense(vehicleId, expenseId, auth.currentUser),
        createContract,
        updateContract,
        addPaymentToContract: (contractId, payment, actorName) =>
          contractsCtx.addPaymentToContract(contractId, payment, actorName || auth.currentUser?.name),
        updateContractPayment: (contractId, paymentId, paymentData, actorName) =>
          contractsCtx.updateContractPayment(contractId, paymentId, paymentData, actorName || auth.currentUser?.name),
        deleteContractPayment: (contractId, paymentId, actorName) =>
          contractsCtx.deleteContractPayment(contractId, paymentId, actorName || auth.currentUser?.name),
        updateContractFinancials: (contractId, financials, actorName) => {
          const updated = contractsCtx.updateContractFinancials(contractId, financials, actorName || auth.currentUser?.name);
          if (updated && financials.depositAmount !== undefined) {
            syncContractDeposit(updated, financials.depositAmount);
          }
          return updated;
        },
        settleContractBalance: (contractId, actorName, method, notes) =>
          contractsCtx.settleContractBalance(contractId, actorName || auth.currentUser?.name, method, notes),
        refreshActiveContracts: contractsCtx.refreshActiveContracts,
        startEditingContract: (contract) =>
          contractsCtx.startEditingContract(contract, () => company.setActiveTab('new_contract')),
        clearEditingData: contractsCtx.clearEditingData,
        completeContract: (id, km, date, time, notes) =>
          contractsCtx.completeContract(id, km, date, time, notes, (vId, rKm) =>
            vehiclesCtx.releaseVehicle(vId, rKm)
          ),
        cancelContract: (id, reason) =>
          contractsCtx.cancelContract(id, reason, (vId) => vehiclesCtx.releaseVehicle(vId)),
        deleteContract: (id) =>
          contractsCtx.deleteContract(id, auth.currentUser, auth.hasPermission, (vId) =>
            vehiclesCtx.releaseVehicle(vId)
          ),
        duplicateContract: (contract) =>
          contractsCtx.duplicateContract(contract, () => company.setActiveTab('new_contract')),
        clearDuplicateData: contractsCtx.clearDuplicateData,
        updateCompanySettings: company.updateCompanySettings,
        aiSettings: company.aiSettings,
        updateAiSettings: company.updateAiSettings,
        resetAiSettings: company.resetAiSettings,
        addAuditLog: company.addAuditLog,
        openPdfModal: contractsCtx.openPdfModal,
        closePdfModal: contractsCtx.closePdfModal,
        setSelectedContract: contractsCtx.setSelectedContract,
        setSelectedClient: clientsDrivers.setSelectedClient,
        setSelectedVehicle: vehiclesCtx.setSelectedVehicle,
        updateDeposit: updateDepositAndSyncContract,
        releaseDeposit: (depositId, amount, notes) =>
          depositsCtx.releaseDeposit(depositId, amount, notes, auth.currentUser?.name),
        deductDeposit: (depositId, deduction, refundRemaining) =>
          depositsCtx.deductDeposit(depositId, deduction, refundRemaining, auth.currentUser?.name),
        updateContractInspection: contractsCtx.updateContractInspection,
        getClientAssignedManager,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CompanyProvider>
      <AuthProvider>
        <VehiclesProvider>
          <ClientsDriversProvider>
            <DepositsProvider>
              <ContractsProvider>
                <AppContextInner>{children}</AppContextInner>
              </ContractsProvider>
            </DepositsProvider>
          </ClientsDriversProvider>
        </VehiclesProvider>
      </AuthProvider>
    </CompanyProvider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Re-export specialized hooks for modular consumption
export { useAuth, useVehicles, useClientsDrivers, useDeposits, useContracts, useCompany };
