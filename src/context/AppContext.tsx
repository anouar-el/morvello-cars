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
import {
  fetchRemoteAgencyData,
  saveRemoteAgencyData,
  subscribeToRemoteAgencyData,
  MorvelloCloudData,
  RemoteRowEvent,
} from '../lib/firestoreSync';
import { syncUpdateDeposit, isPendingCreate } from '../lib/recordSync';
import { mergeAuthoritative, upsertById, removeById } from '../utils/syncMerge';
import {
  PropagationScope,
  DEFAULT_PROPAGATION_SCOPE,
  planClientPropagation,
  planVehiclePropagation,
  isContractInScope,
  contractBelongsToClient,
  buildDepositClientPatch,
  buildDepositVehiclePatch,
} from '../utils/snapshotPropagation';
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
import { generateStableId } from '../utils/idUtils';

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
  /**
   * options.propagate : répercussion sur les contrats/cautions qui portent une copie de la fiche
   * 'open' (défaut) = contrats non clôturés · 'all' = tous · 'none' = garder les valeurs d'origine.
   */
  updateClient: (id: string, data: Partial<Client>, options?: { propagate?: PropagationScope }) => void;
  deleteClient: (id: string) => { success: boolean; error?: string };
  addDriver: (driver: Omit<Driver, 'id' | 'createdAt'>) => Driver;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => Vehicle;
  updateVehicle: (id: string, data: Partial<Vehicle>, options?: { propagate?: PropagationScope }) => void;
  approveVehicle: (vehicleId: string, assignedManagerId?: string) => void;
  rejectVehicle: (vehicleId: string, reason?: string) => void;
  assignVehicleManager: (vehicleId: string, managerId: string, managerName: string) => void;
  deleteVehicle: (vehicleId: string) => { success: boolean; error?: string };
  addVehicleExpense: (
    vehicleId: string,
    expenseData: Omit<VehicleExpense, 'id' | 'createdAt' | 'vehicleId'>
  ) => VehicleExpense;
  deleteVehicleExpense: (vehicleId: string, expenseId: string) => void;
  createContract: (contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>) => Promise<Contract>;
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
      depositCollected?: boolean;
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
  deleteDeposit: (depositId: string) => Promise<boolean>;

  // Inspection photos action
  updateContractInspection: (contractId: string, inspection: ContractInspection) => void;

  // Duplicate contract management
  duplicateContractReports: DuplicateContractReport[];
  repairDuplicateContracts: () => { renumberedCount: number };

  // Affectation Manager via véhicule loué
  getClientAssignedManager: (client: Client) => ClientManagerAssignment;
}

interface SyncContexts {
  vehiclesCtx: ReturnType<typeof useVehicles>;
  clientsDrivers: ReturnType<typeof useClientsDrivers>;
  contractsCtx: ReturnType<typeof useContracts>;
  depositsCtx: ReturnType<typeof useDeposits>;
  company: ReturnType<typeof useCompany>;
  auth: ReturnType<typeof useAuth>;
}

const sameDocNumber = (a: Client, b: Client) =>
  !!a.docNumber && !!b.docNumber && a.docNumber.trim().toUpperCase() === b.docNumber.trim().toUpperCase();

/**
 * Applique l'état distant : la base fait foi (liste distante = liste locale), sauf créations locales
 * en attente d'écriture. Une table dont la lecture a échoué n'est jamais traitée comme vide.
 */
function applyRemoteAgencyState(remote: MorvelloCloudData, ctx: SyncContexts): void {
  const ok = remote.authoritative || {};
  const users = remote.users && remote.users.length > 0 ? remote.users : ctx.auth.users;

  // 1. Contrats
  let effectiveContracts = ctx.contractsCtx.contracts;
  if (ok.contracts !== false) {
    const remoteContracts = remote.contracts || [];
    effectiveContracts = mergeAuthoritative(
      remoteContracts,
      ctx.contractsCtx.contracts,
      (id) => isPendingCreate('contracts', id),
      (r, l) => !!r.contractNumber && r.contractNumber === l.contractNumber
    );
    ctx.contractsCtx.setContractsListByUpdater((prev) =>
      mergeAuthoritative(
        remoteContracts,
        prev,
        (id) => isPendingCreate('contracts', id),
        (r, l) => !!r.contractNumber && r.contractNumber === l.contractNumber
      )
    );
  }

  // 2. Véhicules (+ statut réconcilié avec les contrats)
  let effectiveVehicles = ctx.vehiclesCtx.vehicles;
  if (ok.vehicles !== false) {
    const remoteVehicles = remote.vehicles || [];
    const plateMatch = (r: Vehicle, l: Vehicle) =>
      !!r.plate && !!l.plate && r.plate.trim().toUpperCase() === l.plate.trim().toUpperCase();
    const merged = mergeAuthoritative(
      remoteVehicles,
      ctx.vehiclesCtx.vehicles,
      (id) => isPendingCreate('vehicles', id),
      plateMatch
    );
    effectiveVehicles = reconcileVehiclesWithContracts(merged, effectiveContracts);
    ctx.vehiclesCtx.setVehiclesListByUpdater(() => effectiveVehicles);
  }

  // 3. Clients (+ réconciliation avec les contrats : compteurs, documents, véhicule loué)
  if (ok.clients !== false) {
    const remoteClients = remote.clients || [];
    const merged = mergeAuthoritative(
      remoteClients,
      ctx.clientsDrivers.clients,
      (id) => isPendingCreate('clients', id),
      sameDocNumber
    );
    const reconciled = reconcileClientsWithContracts(merged, effectiveContracts, effectiveVehicles, users);
    ctx.clientsDrivers.setClientsListByUpdater(() => reconciled);
  }

  // 4. Cautions
  if (ok.deposits !== false) {
    const remoteDeposits = remote.deposits || [];
    ctx.depositsCtx.setDepositsListByUpdater((prev) =>
      mergeAuthoritative(remoteDeposits, prev, (id) => isPendingCreate('deposits', id))
    );
  }

  // 5. Conducteurs
  if (ok.drivers !== false) {
    const remoteDrivers = remote.drivers || [];
    ctx.clientsDrivers.setDriversListByUpdater((prev) =>
      mergeAuthoritative(remoteDrivers, prev, (id) => isPendingCreate('drivers', id))
    );
  }

  // 6. Configuration d'agence
  if (remote.companySettings) {
    ctx.company.setCompanySettingsList(
      reconcileCompanySettingsWithContracts(remote.companySettings, effectiveContracts)
    );
  }
  if (remote.termsVersion) ctx.company.setTermsVersionList(remote.termsVersion);
  if (remote.aiSettings) ctx.company.setAiSettingsList(remote.aiSettings);
  if (remote.auditLogs && remote.auditLogs.length > 0) ctx.company.setAuditLogsList(remote.auditLogs);
  if (remote.users && remote.users.length > 0) ctx.auth.setUsersList(remote.users);
}

/** Applique un événement temps réel sur UNE ligne (insertion/modification/suppression). */
function applyRemoteRowEvent(event: RemoteRowEvent, ctx: SyncContexts): void {
  const apply = <T extends { id: string }>(prev: T[]): T[] => {
    if (event.type === 'delete') return removeById(prev, event.id);
    const incoming = event.record as unknown as T;
    // On garde les champs purement locaux (ex. champs dérivés) et on laisse la base écraser le reste.
    const current = prev.find((p) => p.id === event.id);
    return upsertById(prev, current ? { ...current, ...incoming } : incoming);
  };

  switch (event.table) {
    case 'contracts':
      ctx.contractsCtx.setContractsListByUpdater((prev) => apply<Contract>(prev));
      break;
    case 'clients':
      ctx.clientsDrivers.setClientsListByUpdater((prev) => apply<Client>(prev));
      break;
    case 'vehicles':
      ctx.vehiclesCtx.setVehiclesListByUpdater((prev) => apply<Vehicle>(prev));
      break;
    case 'drivers':
      ctx.clientsDrivers.setDriversListByUpdater((prev) => apply<Driver>(prev));
      break;
    case 'deposits':
      ctx.depositsCtx.setDepositsListByUpdater((prev) => apply<DepositRecord>(prev));
      break;
  }
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

      // LA BASE FAIT FOI : la liste distante (filtrée par RLS) remplace l'état local. Les
      // enregistrements présents seulement en local sont conservés uniquement s'ils sont des
      // créations dont l'écriture n'a pas encore abouti. Plus de « push-back » automatique :
      // il ressuscitait les éléments supprimés par un autre utilisateur.
      if (remote) {
        applyRemoteAgencyState(remote, contextsRef.current);
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
  }, [company]);

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

  // Synchronisation temps réel multi-postes (Supabase Realtime) : les événements sont appliqués
  // ligne par ligne ; un refetch complet ne sert qu'à la reconnexion, aux conflits et aux champs dérivés.
  useEffect(() => {
    let active = true;

    // Initial fetch to load remote state immediately
    contextsRef.current.syncWithCloud().catch((err) => {
      if (!active || isAbortException(err)) return;
      console.warn('Initial cloud sync notice:', err);
    });

    const unsubscribe = subscribeToRemoteAgencyData(
      (remote) => {
        if (!active || !remote) return;
        const ctx = contextsRef.current;
        applyRemoteAgencyState(remote, ctx);

        const syncTime = remote.updatedAt || new Date().toISOString();
        ctx.company.setLastCloudSync(syncTime);
        localStorage.setItem('morvello_last_cloud_sync', syncTime);
        ctx.company.setCloudSyncStatus('synced');
      },
      (err) => {
        if (!active || isAbortException(err)) return;
        console.warn('Real-time sync notice:', err);
        contextsRef.current.company.setCloudSyncStatus('error');
      },
      (event) => {
        if (!active) return;
        applyRemoteRowEvent(event, contextsRef.current);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const createContract = async (
    contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>
  ): Promise<Contract> => {
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
    } else if (amount > 0 && contract.depositCollected !== false) {
      // Caution non prise : aucune fiche « encaissée » tant qu'elle n'est pas marquée comme prise
      const newDeposit: DepositRecord = {
        id: generateStableId('dep'),
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

  // Modification d'une fiche client, avec répercussion (au choix) sur les contrats et cautions
  // qui en portent une copie. Les autres postes reçoivent les contrats mis à jour en temps réel.
  const updateClient = (id: string, data: Partial<Client>, options?: { propagate?: PropagationScope }) => {
    const scope = options?.propagate ?? DEFAULT_PROPAGATION_SCOPE;
    const existing = clientsDrivers.clients.find((c) => c.id === id);
    clientsDrivers.updateClient(id, data);
    if (!existing || scope === 'none') return;

    const changes = planClientPropagation(contractsCtx.contracts, id, existing.docNumber, data, scope);
    if (changes.length > 0) {
      const name = `${data.firstName ?? existing.firstName} ${data.lastName ?? existing.lastName}`.trim();
      contractsCtx.applySnapshotChanges(changes, `fiche client « ${name} » modifiée`);
    }

    // Cautions rattachées aux contrats concernés (nom, téléphone du client)
    if (data.firstName === undefined && data.lastName === undefined && data.phone === undefined) return;
    const scopedContractIds = new Set(
      contractsCtx.contracts
        .filter((c) => contractBelongsToClient(c, id, existing.docNumber) && isContractInScope(c, scope))
        .map((c) => c.id)
    );
    for (const dep of depositsCtx.deposits) {
      if (!scopedContractIds.has(dep.contractId)) continue;
      const patch = buildDepositClientPatch(data, dep);
      const differs = Object.entries(patch).some(([k, v]) => (dep as any)[k] !== v);
      if (differs) depositsCtx.updateDeposit(dep.id, patch);
    }
  };

  // Modification d'un véhicule, avec répercussion (au choix) sur les contrats et cautions.
  const updateVehicle = (id: string, data: Partial<Vehicle>, options?: { propagate?: PropagationScope }) => {
    const scope = options?.propagate ?? DEFAULT_PROPAGATION_SCOPE;
    const existing = vehiclesCtx.vehicles.find((v) => v.id === id);
    vehiclesCtx.updateVehicle(id, data);
    if (!existing || scope === 'none') return;

    const patch: Partial<Vehicle> = data.plate ? { ...data, plate: formatPlateFrench(data.plate) } : data;
    const changes = planVehiclePropagation(contractsCtx.contracts, id, patch, scope);
    if (changes.length > 0) {
      const label = `${patch.brand ?? existing.brand} ${patch.model ?? existing.model} [${patch.plate ?? existing.plate}]`;
      contractsCtx.applySnapshotChanges(changes, `véhicule ${label} modifié`);
    }

    if (patch.brand === undefined && patch.model === undefined && patch.plate === undefined) return;
    const depPatch = buildDepositVehiclePatch({
      brand: patch.brand ?? existing.brand,
      model: patch.model ?? existing.model,
      plate: patch.plate ?? existing.plate,
    });
    const scopedContractIds = new Set(
      contractsCtx.contracts
        .filter((c) => (c.vehicleId === id || c.vehicleSnapshot?.id === id) && isContractInScope(c, scope))
        .map((c) => c.id)
    );
    for (const dep of depositsCtx.deposits) {
      if (!scopedContractIds.has(dep.contractId)) continue;
      const differs = Object.entries(depPatch).some(([k, v]) => (dep as any)[k] !== v);
      if (differs) depositsCtx.updateDeposit(dep.id, depPatch);
    }
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

  const deleteDepositAndSyncContract = useCallback(
    async (depositId: string): Promise<boolean> => {
      const existing = depositsCtx.deposits.find((d) => d.id === depositId);
      if (!existing) return false;

      // Si la caution était rattachée à un contrat, détacher la fiche de caution
      const matchedContract = contractsCtx.contracts.find(
        (c) => c.id === existing.contractId || c.contractNumber === existing.contractNumber
      );
      if (matchedContract && matchedContract.depositRecord?.id === depositId) {
        contractsCtx.updateContract(matchedContract.id, {
          depositRecord: undefined,
          depositCollected: false,
        });
      }

      return depositsCtx.deleteDeposit(depositId, auth.currentUser?.name);
    },
    [depositsCtx, contractsCtx, auth.currentUser]
  );

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
      for (const dep of updatedDeposits) {
        const original = depositsCtx.deposits.find((d) => d.id === dep.id);
        if (original && original.amount !== dep.amount) {
          syncUpdateDeposit(dep.id, { amount: dep.amount }).catch((err) =>
            console.warn('Record-level sync reconciled deposit note:', err)
          );
        }
      }
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
        updateClient,
        deleteClient: (id) =>
          clientsDrivers.deleteClient(
            id,
            auth.currentUser,
            (clientId, docNumber) => {
              const activeContract = contractsCtx.contracts.find(
                (c) =>
                  (c.clientId === clientId ||
                    (docNumber && c.clientSnapshot?.docNumber?.toLowerCase() === docNumber?.toLowerCase())) &&
                  (c.status === 'active' || c.status === 'draft')
              );
              return {
                isBlocked: !!activeContract,
                contractNumber: activeContract?.contractNumber,
              };
            }
          ),
        addDriver: clientsDrivers.addDriver,
        addVehicle: (vehicle) => vehiclesCtx.addVehicle(vehicle, auth.currentUser),
        updateVehicle,
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
        deleteDeposit: deleteDepositAndSyncContract,
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
