import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import {
  Client,
  Driver,
  Vehicle,
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
  createContract: (contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>) => Contract;
  updateContract: (id: string, data: Partial<Contract>) => Contract | undefined;
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
  resetAllData: () => void;

  // Deposit management actions
  updateDeposit: (id: string, data: Partial<DepositRecord>) => void;
  releaseDeposit: (depositId: string, refundedAmount: number, notes?: string) => void;
  deductDeposit: (depositId: string, deduction: Omit<DepositDeduction, 'id' | 'date'>, refundedRemaining?: boolean) => void;

  // Inspection photos action
  updateContractInspection: (contractId: string, inspection: ContractInspection) => void;

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
      if (!remote) {
        company.setCloudSyncStatus('synced');
        return true;
      }

      if (remote.vehicles && remote.vehicles.length > 0) {
        vehiclesCtx.setVehiclesList(remote.vehicles);
      }
      if (remote.clients && remote.clients.length > 0) {
        clientsDrivers.setClientsList(remote.clients);
      }
      if (remote.drivers && remote.drivers.length > 0) {
        clientsDrivers.setDriversList(remote.drivers);
      }
      if (remote.contracts && remote.contracts.length > 0) {
        contractsCtx.setContractsList(remote.contracts);
      }
      if (remote.deposits && remote.deposits.length > 0) {
        depositsCtx.setDepositsList(remote.deposits);
      }
      if (remote.companySettings) {
        company.setCompanySettingsList(remote.companySettings);
      }
      if (remote.termsVersion) {
        company.setTermsVersionList(remote.termsVersion);
      }
      if (remote.aiSettings) {
        company.setAiSettingsList(remote.aiSettings);
      }
      if (remote.auditLogs && remote.auditLogs.length > 0) {
        company.setAuditLogsList(remote.auditLogs);
      }
      if (remote.users && remote.users.length > 0) {
        auth.setUsersList(remote.users);
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
        if (remote.vehicles && remote.vehicles.length > 0) {
          ctx.vehiclesCtx.setVehiclesList(remote.vehicles);
        }
        if (remote.clients && remote.clients.length > 0) {
          ctx.clientsDrivers.setClientsList(remote.clients);
        }
        if (remote.drivers && remote.drivers.length > 0) {
          ctx.clientsDrivers.setDriversList(remote.drivers);
        }
        if (remote.contracts && remote.contracts.length > 0) {
          ctx.contractsCtx.setContractsList(remote.contracts);
        }
        if (remote.deposits && remote.deposits.length > 0) {
          ctx.depositsCtx.setDepositsList(remote.deposits);
        }
        if (remote.companySettings) {
          ctx.company.setCompanySettingsList(remote.companySettings);
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

  const updateContract = (id: string, data: Partial<Contract>): Contract | undefined => {
    return contractsCtx.updateContract(id, data, vehiclesCtx.setVehiclesListByUpdater);
  };

  const resetAllData = () => {
    localStorage.removeItem('morvello_clients_v1');
    localStorage.removeItem('morvello_drivers_v1');
    localStorage.removeItem('morvello_vehicles_v1');
    localStorage.removeItem('morvello_contracts_v1');
    localStorage.removeItem('morvello_deposits_v1');
    localStorage.removeItem('morvello_settings_v1');
    localStorage.removeItem('morvello_terms_v1');
    localStorage.removeItem('morvello_audit_v1');
    localStorage.removeItem('morvello_current_user_v1');
    localStorage.removeItem('morvello_users_v1');

    clientsDrivers.setClientsList(initialClients);
    clientsDrivers.setDriversList(initialDrivers);
    vehiclesCtx.setVehiclesList(initialVehicles);
    contractsCtx.setContractsList(initialContracts);
    depositsCtx.setDepositsList(initialDeposits);
    company.setCompanySettingsList(initialCompanySettings);
    company.setTermsVersionList(initialTermsVersion);
    company.setAuditLogsList(initialAuditLogs);
    auth.switchUser(initialUsers[0].id);
    company.addAuditLog('Réinitialisation démo', 'settings', 'system', 'Restauration complète des données initiales');
  };

  const getClientAssignedManager = (client: Client): ClientManagerAssignment => {
    return resolveClientManagerAndVehicle(client, contractsCtx.contracts, vehiclesCtx.vehicles, auth.users);
  };

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
        deleteVehicle: (id) => vehiclesCtx.deleteVehicle(id, auth.currentUser, auth.hasPermission),
        createContract,
        updateContract,
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
        resetAllData,
        updateDeposit: depositsCtx.updateDeposit,
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
