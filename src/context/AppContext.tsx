import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Client,
  Driver,
  Vehicle,
  Contract,
  CompanySettings,
  AuditLog,
  User,
  TermsVersion,
  TermClause,
  ActiveTab,
  UserRole,
  UserPermissions,
  DEFAULT_PERMISSIONS_BY_ROLE,
  DepositRecord,
  DepositMethod,
  DepositDeduction,
  ContractInspection,
  InspectionPhoto,
  ThemeMode,
  AiAssistantSettings,
  DEFAULT_AI_SETTINGS,
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
import { formatPlateFrench } from '../utils/plateUtils';
import { fetchRemoteAgencyData, saveRemoteAgencyData } from '../lib/firestoreSync';
import { resolveClientManagerAndVehicle, ClientManagerAssignment } from '../utils/clientManagerUtils';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface AppContextType {
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
  addUser: (userData: Omit<User, 'id'> & { password?: string }) => User;
  updateUser: (userId: string, data: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  hasPermission: (perm: keyof UserPermissions) => boolean;
  login: (email: string, pass: string) => { success: boolean; error?: string };
  logout: () => void;

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

const STORAGE_KEYS = {
  CLIENTS: 'morvello_clients_v1',
  DRIVERS: 'morvello_drivers_v1',
  VEHICLES: 'morvello_vehicles_v1',
  CONTRACTS: 'morvello_contracts_v1',
  DEPOSITS: 'morvello_deposits_v1',
  SETTINGS: 'morvello_settings_v1',
  TERMS: 'morvello_terms_v1',
  AUDIT: 'morvello_audit_v1',
  USER: 'morvello_current_user_v1',
  USERS: 'morvello_users_v1',
  THEME: 'morvello_theme_v1',
  AI_SETTINGS: 'morvello_ai_settings_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state (Dark Mode vs Light Mode)
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark'; // Prestige dark luxury by default
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped: User[] = parsed
            .filter((u) => u.id !== 'usr-4' && u.name !== 'Kenza Tazi')
            .map((u) => {
            const initialMatch = initialUsers.find((iu) => iu.id === u.id);
            let name = u.name;
            let email = u.email;
            if (u.id === 'usr-1' && (name === 'Ahmed Benali' || !name)) {
              name = 'Anouar';
              email = 'anouar@morvellocars.com';
            } else if (u.id === 'usr-2' && (name === 'Youssef El Amrani' || !name)) {
              name = 'Said Khomri';
              email = 'said.khomri@morvellocars.com';
            } else if (u.id === 'usr-3' && (name === 'Rachid Bennani' || !name)) {
              name = 'Abdelkader Ouahib';
              email = 'abdelkader.ouahib@morvellocars.com';
            }
            return {
              ...u,
              name: initialMatch?.name || name,
              email: initialMatch?.email || email,
              phone: u.phone || initialMatch?.phone,
              permissions: u.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] },
            };
          });

          // Ensure any newly added users in initialUsers are added if not present
          for (const iu of initialUsers) {
            if (!mapped.some((u) => u.id === iu.id)) {
              mapped.push(iu);
            }
          }
          return mapped;
        }
      } catch (e) {
        console.error('Failed to parse saved users', e);
      }
    }
    return initialUsers;
  });
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    const list: Client[] = saved ? JSON.parse(saved) : initialClients;
    return list.map((c) => {
      // RENAULT KARDIAN est affectée à Abdelkader, donc le client lui appartient
      const isKardianClient =
        c.id === 'cli-4' ||
        (c.rentedVehicleBrand?.trim().toUpperCase() === 'RENAULT' &&
          c.rentedVehicleModel?.trim().toUpperCase().includes('KARDIAN'));
      if (isKardianClient) {
        return {
          ...c,
          assignedManagerId: 'usr-3',
          assignedManagerName: 'Abdelkader Ouahib',
        };
      }
      return c;
    });
  });

  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRIVERS);
    return saved ? JSON.parse(saved) : initialDrivers;
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    const list: Vehicle[] = saved ? JSON.parse(saved) : initialVehicles;

    // Strict rule: "supprime tout et laisse just : RENAULT KARDIAN 52596 | A | 73 et ajout les vehicule :"
    // Only keep vehicles from the approved table (initialVehicles) plus any newly added custom vehicles
    const validPlates = new Set(initialVehicles.map((v) => v.plate.replace(/\s+/g, '')));
    const filtered = list.filter((v) => validPlates.has(v.plate?.replace(/\s+/g, '')));
    const mergedList = [...filtered];
    for (const iv of initialVehicles) {
      if (!mergedList.some((v) => v.plate.replace(/\s+/g, '') === iv.plate.replace(/\s+/g, ''))) {
        mergedList.push(iv);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(mergedList));
    } catch {
      // ignore
    }

    return mergedList.map((v) => ({
      ...v,
      plate: formatPlateFrench(v.plate),
      approvalStatus: v.approvalStatus || 'approved',
    }));
  });

  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTRACTS);
    const list: Contract[] = saved ? JSON.parse(saved) : initialContracts;

    // Règle stricte : "supprime tout les contrat sauf : MC-2026-0050"
    const c50Only = list.filter((c) => c.contractNumber === 'MC-2026-0050');
    const finalContracts = c50Only.length > 0 ? c50Only : initialContracts.filter((c) => c.contractNumber === 'MC-2026-0050');

    // Purge le localStorage pour éliminer les anciens contrats supprimés
    try {
      localStorage.setItem(STORAGE_KEYS.CONTRACTS, JSON.stringify(finalContracts));
    } catch {
      // ignore
    }

    return finalContracts.map((c) => {
      const initialMatch = initialContracts.find((ic) => ic.id === c.id);
      const isKardianContract =
        c.vehicleId === 'veh-kardian' ||
        c.vehicleId === 'veh-1789165868336' ||
        (c.vehicleSnapshot?.brand?.trim().toUpperCase() === 'RENAULT' &&
          c.vehicleSnapshot?.model?.trim().toUpperCase().includes('KARDIAN'));

      return {
        ...c,
        departureFuel: c.departureFuel || c.inspection?.departureChecklist?.fuelLevel || '1/8 (Réserve)',
        assignedManagerId: isKardianContract ? 'usr-3' : (c.assignedManagerId ?? initialMatch?.assignedManagerId),
        assignedManagerName: isKardianContract ? 'Abdelkader Ouahib' : (c.assignedManagerName ?? initialMatch?.assignedManagerName),
        managerPhone: isKardianContract ? '+212 663-789123' : (c.managerPhone ?? initialMatch?.managerPhone),
        vehicleSnapshot: {
          ...c.vehicleSnapshot,
          plate: formatPlateFrench(c.vehicleSnapshot?.plate),
        },
      };
    });
  });

  const [deposits, setDeposits] = useState<DepositRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEPOSITS);
    const list: DepositRecord[] = saved ? JSON.parse(saved) : initialDeposits;
    const dep50Only = list.filter((d) => !d.contractNumber || d.contractNumber === 'MC-2026-0050');
    const finalList = dep50Only.length > 0 ? dep50Only : initialDeposits;
    try {
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(finalList));
    } catch {
      // ignore
    }
    return finalList.map((d) => ({
      ...d,
      vehiclePlate: formatPlateFrench(d.vehiclePlate),
    }));
  });

  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const address = (parsed.address && parsed.address.includes('ANNAKHIL')) ? '' : (parsed.address || '');
        return {
          ...initialCompanySettings,
          ...parsed,
          address,
          assistancePhone: parsed.assistancePhone || initialCompanySettings.assistancePhone || '0522582962 / 0522589535',
        };
      } catch {
        return initialCompanySettings;
      }
    }
    return initialCompanySettings;
  });

  const [aiSettings, setAiSettings] = useState<AiAssistantSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
    if (saved) {
      try {
        return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_AI_SETTINGS;
      }
    }
    return DEFAULT_AI_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(aiSettings));
  }, [aiSettings]);

  const [termsVersion, setTermsVersion] = useState<TermsVersion>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TERMS);
    return saved ? JSON.parse(saved) : initialTermsVersion;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT);
    return saved ? JSON.parse(saved) : initialAuditLogs;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && u.id !== 'usr-4' && u.name !== 'Kenza Tazi') {
          const match = initialUsers.find((iu) => iu.id === u.id);
          if (match) return match;
          if (u.name === 'Ahmed Benali' || u.role === 'admin') {
            return initialUsers.find((iu) => iu.role === 'admin') || initialUsers[0];
          }
          return u;
        }
      } catch {
        // ignore parse error
      }
    }
    return initialUsers[0];
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [pdfModalContract, setPdfModalContract] = useState<Contract | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [duplicateContractData, setDuplicateContractData] = useState<Contract | null>(null);
  const [editingContractData, setEditingContractData] = useState<Contract | null>(null);

  // Cloud Firestore Sync State
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(() => {
    return localStorage.getItem('morvello_last_cloud_sync');
  });

  // Pull remote data on initial load
  useEffect(() => {
    let isMounted = true;
    const loadCloudData = async () => {
      try {
        setCloudSyncStatus('syncing');
        const remoteData = await fetchRemoteAgencyData();
        if (!isMounted) return;

        if (remoteData) {
          if (remoteData.vehicles && remoteData.vehicles.length > 0) {
            const validPlates = new Set(initialVehicles.map((v) => v.plate.replace(/\s+/g, '')));
            const filteredRemote = remoteData.vehicles.filter((v) => validPlates.has(v.plate?.replace(/\s+/g, '')));
            const merged = [...filteredRemote];
            for (const iv of initialVehicles) {
              if (!merged.some((v) => v.plate.replace(/\s+/g, '') === iv.plate.replace(/\s+/g, ''))) {
                merged.push(iv);
              }
            }
            setVehicles(merged);
            if (merged.length !== remoteData.vehicles.length) {
              await saveRemoteAgencyData({ vehicles: merged });
            }
          } else {
            setVehicles(initialVehicles);
            await saveRemoteAgencyData({ vehicles: initialVehicles });
          }
          if (remoteData.clients && remoteData.clients.length > 0) setClients(remoteData.clients);
          if (remoteData.drivers && remoteData.drivers.length > 0) setDrivers(remoteData.drivers);
          if (remoteData.contracts && remoteData.contracts.length > 0) {
            const c50Only = remoteData.contracts.filter((c) => c.contractNumber === 'MC-2026-0050');
            if (c50Only.length > 0) {
              setContracts(c50Only);
              if (c50Only.length !== remoteData.contracts.length) {
                await saveRemoteAgencyData({ contracts: c50Only });
              }
            } else {
              setContracts(initialContracts);
              await saveRemoteAgencyData({ contracts: initialContracts });
            }
          } else {
            setContracts(initialContracts);
            await saveRemoteAgencyData({ contracts: initialContracts });
          }
          if (remoteData.deposits && remoteData.deposits.length > 0) {
            const dep50Only = remoteData.deposits.filter((d) => !d.contractNumber || d.contractNumber === 'MC-2026-0050');
            setDeposits(dep50Only.length > 0 ? dep50Only : initialDeposits);
            if (dep50Only.length !== remoteData.deposits.length) {
              await saveRemoteAgencyData({ deposits: dep50Only });
            }
          }
          if (remoteData.companySettings) setCompanySettings(remoteData.companySettings);
          if (remoteData.aiSettings) setAiSettings({ ...DEFAULT_AI_SETTINGS, ...remoteData.aiSettings });
          if (remoteData.termsVersion) setTermsVersion(remoteData.termsVersion);
          if (remoteData.users && remoteData.users.length > 0) {
            const mergedUsers = remoteData.users.filter((u) => u.id !== 'usr-4' && u.name !== 'Kenza Tazi');
            for (const iu of initialUsers) {
              if (!mergedUsers.some((u) => u.id === iu.id)) {
                mergedUsers.push(iu);
              }
            }
            setUsers(mergedUsers);
          }
          setCloudSyncStatus('synced');
          const syncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setLastCloudSync(syncTime);
          localStorage.setItem('morvello_last_cloud_sync', syncTime);
        } else {
          // First time initialization: upload the local state to Firebase
          await saveRemoteAgencyData({
            vehicles,
            clients,
            drivers,
            contracts,
            deposits,
            companySettings,
            aiSettings,
            termsVersion,
            users,
            updatedBy: currentUser?.name || 'Système',
          });
          setCloudSyncStatus('synced');
          const syncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setLastCloudSync(syncTime);
          localStorage.setItem('morvello_last_cloud_sync', syncTime);
        }
      } catch (err) {
        console.warn('Initial Firestore sync note:', err);
        if (isMounted) setCloudSyncStatus('idle');
      }
    };

    loadCloudData();
    return () => {
      isMounted = false;
    };
  }, []);

  const pushToCloud = async (): Promise<boolean> => {
    try {
      setCloudSyncStatus('syncing');
      const success = await saveRemoteAgencyData({
        vehicles,
        clients,
        drivers,
        contracts,
        deposits,
        companySettings,
        aiSettings,
        termsVersion,
        users,
        updatedBy: currentUser?.name || 'Système',
      });
      if (success) {
        setCloudSyncStatus('synced');
        const syncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        setLastCloudSync(syncTime);
        localStorage.setItem('morvello_last_cloud_sync', syncTime);
        return true;
      } else {
        setCloudSyncStatus('error');
        return false;
      }
    } catch {
      setCloudSyncStatus('error');
      return false;
    }
  };

  const syncWithCloud = async (): Promise<boolean> => {
    try {
      setCloudSyncStatus('syncing');
      const remoteData = await fetchRemoteAgencyData();
      if (remoteData) {
        if (remoteData.vehicles && remoteData.vehicles.length > 0) {
          setVehicles(remoteData.vehicles);
        } else {
          setVehicles(initialVehicles);
        }
        if (remoteData.clients && remoteData.clients.length > 0) setClients(remoteData.clients);
        if (remoteData.drivers && remoteData.drivers.length > 0) setDrivers(remoteData.drivers);
        if (remoteData.contracts && remoteData.contracts.length > 0) setContracts(remoteData.contracts);
        if (remoteData.deposits && remoteData.deposits.length > 0) setDeposits(remoteData.deposits);
        if (remoteData.companySettings) setCompanySettings(remoteData.companySettings);
        if (remoteData.aiSettings) setAiSettings({ ...DEFAULT_AI_SETTINGS, ...remoteData.aiSettings });
        if (remoteData.termsVersion) setTermsVersion(remoteData.termsVersion);
        if (remoteData.users && remoteData.users.length > 0) {
          const mergedUsers = remoteData.users.filter((u) => u.id !== 'usr-4' && u.name !== 'Kenza Tazi');
          for (const iu of initialUsers) {
            if (!mergedUsers.some((u) => u.id === iu.id)) {
              mergedUsers.push(iu);
            }
          }
          setUsers(mergedUsers);
        }
        setCloudSyncStatus('synced');
        const syncTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        setLastCloudSync(syncTime);
        localStorage.setItem('morvello_last_cloud_sync', syncTime);
        return true;
      } else {
        return await pushToCloud();
      }
    } catch {
      setCloudSyncStatus('error');
      return false;
    }
  };

  // Persistence effects
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
  }, [drivers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTRACTS, JSON.stringify(contracts));
  }, [contracts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deposits));
  }, [deposits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(companySettings));
  }, [companySettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TERMS, JSON.stringify(termsVersion));
  }, [termsVersion]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  // Keep currentUser in sync if its permissions or role were updated in users list
  useEffect(() => {
    const matched = users.find((u) => u.id === currentUser.id);
    if (matched && (JSON.stringify(matched) !== JSON.stringify(currentUser))) {
      setCurrentUser(matched);
    }
  }, [users, currentUser.id]);

  const addAuditLog = (
    action: string,
    targetType: AuditLog['targetType'],
    targetId: string,
    details: string
  ) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
      2,
      '0'
    )}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: formattedDate,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      targetType,
      targetId,
      details,
    };

    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const setCurrentUserRole = (role: UserRole) => {
    const matching = users.find((u) => u.role === role) || initialUsers.find((u) => u.role === role) || {
      id: `usr-${role}`,
      name: role === 'admin' ? 'Anouar' : role === 'manager' ? 'Said Khomri' : 'Kenza Tazi',
      role,
      email: `${role}@morvellocars.com`,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
    };
    setCurrentUser(matching);
    addAuditLog('Changement de rôle', 'settings', matching.id, `Profil basculé vers le rôle : ${role.toUpperCase()}`);
  };

  const switchUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId) || initialUsers.find((u) => u.id === userId);
    if (targetUser) {
      setCurrentUser(targetUser);
      addAuditLog(
        'Basculement utilisateur',
        'settings',
        targetUser.id,
        `Session active : ${targetUser.name} (${targetUser.role.toUpperCase()}${targetUser.assignedFleetName ? ` - ${targetUser.assignedFleetName}` : ''})`
      );
    }
  };

  const updateUserPermissions = (userId: string, permissions: Partial<UserPermissions>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const currentPerms = u.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] };
          const updatedPerms = { ...currentPerms, ...permissions };
          return {
            ...u,
            permissions: updatedPerms,
          };
        }
        return u;
      })
    );

    const targetUser = users.find((u) => u.id === userId);
    addAuditLog(
      'Mise à jour permissions',
      'user_permission',
      userId,
      `Habilitations modifiées pour ${targetUser?.name || userId} par le Gérant (${currentUser.name})`
    );
  };

  const updateUserRole = (userId: string, role: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            role,
            permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
          };
        }
        return u;
      })
    );

    const targetUser = users.find((u) => u.id === userId);
    addAuditLog(
      'Changement de rôle membre',
      'user_permission',
      userId,
      `Rôle de ${targetUser?.name || userId} redéfini en ${role.toUpperCase()} par le Gérant (${currentUser.name})`
    );
  };

  const resetUserPermissions = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] } }
          : u
      )
    );
    addAuditLog(
      'Réinitialisation permissions',
      'user_permission',
      userId,
      `Rétablissement du profil type par défaut pour ${targetUser.name} (${targetUser.role.toUpperCase()})`
    );
  };

  const login = (email: string, pass: string): { success: boolean; error?: string } => {
    const trimmedEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (!user) {
      return { success: false, error: 'Aucun compte trouvé avec cet e-mail.' };
    }
    const storedPass = user.password || 'admin123';
    if (pass !== storedPass) {
      return { success: false, error: 'Mot de passe incorrect.' };
    }
    setCurrentUser(user);
    addAuditLog('Connexion', 'user_permission', user.id, `Connexion réussie de ${user.name} (${user.role.toUpperCase()})`);
    return { success: true };
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog('Déconnexion', 'user_permission', currentUser.id, `Déconnexion de ${currentUser.name}`);
    }
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  const addUser = (userData: Omit<User, 'id'> & { password?: string }): User => {
    const newUser: User = {
      ...userData,
      password: userData.password || 'morvello123',
      id: `usr-${Date.now()}`,
      permissions: userData.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[userData.role] },
    };
    setUsers((prev) => [...prev, newUser]);
    addAuditLog(
      'Ajout membre d’équipe',
      'user_permission',
      newUser.id,
      `Nouveau collaborateur créé : ${newUser.name} (${newUser.role.toUpperCase()}) par le Gérant`
    );
    return newUser;
  };

  const updateUser = (userId: string, data: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, ...data };
          if (currentUser?.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );
    const target = users.find((u) => u.id === userId);
    addAuditLog(
      'Mise à jour collaborateur',
      'user_permission',
      userId,
      `Profil et coordonnées mis à jour pour ${target?.name || userId}${data.phone ? ` (Tél direct: ${data.phone})` : ''}`
    );
  };

  const deleteUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    addAuditLog(
      'Suppression collaborateur',
      'user_permission',
      userId,
      `Compte collaborateur supprimé : ${targetUser.name}`
    );
  };

  const hasPermission = (perm: keyof UserPermissions): boolean => {
    if (currentUser.role === 'admin') return true;
    if (currentUser.permissions && typeof currentUser.permissions[perm] === 'boolean') {
      return currentUser.permissions[perm];
    }
    const defaultPerms = DEFAULT_PERMISSIONS_BY_ROLE[currentUser.role];
    return defaultPerms ? defaultPerms[perm] : false;
  };

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt' | 'contractCount'>): Client => {
    const isManager = currentUser.role === 'manager';
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString(),
      contractCount: 0,
      assignedManagerId: clientData.assignedManagerId || (isManager ? currentUser.id : undefined),
      assignedManagerName: clientData.assignedManagerName || (isManager ? currentUser.name : undefined),
    };
    setClients((prev) => [newClient, ...prev]);
    addAuditLog('Création client', 'client', newClient.id, `Création fiche client : ${newClient.firstName} ${newClient.lastName} (${newClient.docNumber})`);
    return newClient;
  };

  const updateClient = (id: string, data: Partial<Client>) => {
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
    addAuditLog('Mise à jour client', 'client', id, `Modification fiche client #${id}`);
  };

  const deleteClient = (id: string): { success: boolean; error?: string } => {
    const client = clients.find((c) => c.id === id);
    if (!client) {
      return { success: false, error: 'Client introuvable.' };
    }

    const isGerant = currentUser.role === 'admin';
    const isManager = currentUser.role === 'manager';

    if (!isGerant && !isManager && !hasPermission('canDeleteClients')) {
      return {
        success: false,
        error: 'Permission refusée : vous ne disposez pas des droits pour supprimer ce client.',
      };
    }

    // Safety check: is client currently on an active contract?
    const activeContract = contracts.find(
      (c) => (c.clientId === id || (c.clientSnapshot?.docNumber && c.clientSnapshot.docNumber.trim().toUpperCase() === client.docNumber.trim().toUpperCase())) && c.status === 'active'
    );
    if (activeContract) {
      return {
        success: false,
        error: `Impossible de supprimer ce client : il est actuellement engagé dans le contrat en cours N° ${activeContract.contractNumber}. Clôturez ou annulez d'abord le contrat.`,
      };
    }

    const updatedClients = clients.filter((c) => c.id !== id);
    setClients(updatedClients);

    if (selectedClient?.id === id) {
      setSelectedClient(null);
    }

    // Auto-sync to Firebase Firestore
    saveRemoteAgencyData({ clients: updatedClients }).catch((err) => {
      console.warn('Erreur Firestore après suppression client:', err);
    });

    addAuditLog(
      'Suppression client',
      'client',
      id,
      `Suppression définitive de la fiche client : ${client.firstName} ${client.lastName} (${client.docNumber}) par ${currentUser.name} (${currentUser.role.toUpperCase()})`
    );

    return { success: true };
  };

  const addDriver = (driverData: Omit<Driver, 'id' | 'createdAt'>): Driver => {
    const newDriver: Driver = {
      ...driverData,
      id: `drv-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setDrivers((prev) => [newDriver, ...prev]);
    addAuditLog('Création conducteur', 'driver', newDriver.id, `Nouveau conducteur : ${newDriver.firstName} ${newDriver.lastName}`);
    return newDriver;
  };

  const addVehicle = (vehicleData: Omit<Vehicle, 'id'>): Vehicle => {
    const isGerant = currentUser.role === 'admin';
    const isManager = currentUser.role === 'manager';
    const needsGerantApproval = !isGerant;

    const assignedUser = initialUsers.find((u) => u.id === vehicleData.assignedManagerId);

    const newVehicle: Vehicle = {
      ...vehicleData,
      id: `veh-${Date.now()}`,
      plate: formatPlateFrench(vehicleData.plate),
      // Règle : L'ajout se fait par tout le monde, mais sous approbation obligatoire du Gérant
      approvalStatus: needsGerantApproval ? 'pending_approval' : (vehicleData.approvalStatus || 'approved'),
      proposedBy: needsGerantApproval ? currentUser.name : (vehicleData.proposedBy || currentUser.name),
      proposedAt: needsGerantApproval ? new Date().toISOString() : (vehicleData.proposedAt || new Date().toISOString()),
      // Si manager, pré-affecté par défaut à son agence sauf si précisé
      assignedManagerId: isManager ? currentUser.id : vehicleData.assignedManagerId,
      assignedManagerName: isManager ? currentUser.name : (assignedUser?.name || vehicleData.assignedManagerName),
    };

    const updatedVehicles = [newVehicle, ...vehicles];
    setVehicles(updatedVehicles);
    saveRemoteAgencyData({ vehicles: updatedVehicles }).catch((err) =>
      console.warn('Auto-save vehicle to Firestore note:', err)
    );
    addAuditLog(
      needsGerantApproval ? 'Proposition nouveau véhicule' : 'Ajout direct véhicule',
      'vehicle',
      newVehicle.id,
      needsGerantApproval
        ? `Véhicule proposé par ${currentUser.name} (${currentUser.role.toUpperCase()}) - En attente d'approbation obligatoire du Gérant : ${newVehicle.brand} ${newVehicle.model} (${newVehicle.plate})`
        : `Ajout direct au parc par le Gérant (${currentUser.name}) : ${newVehicle.brand} ${newVehicle.model} (${newVehicle.plate})${newVehicle.assignedManagerName ? ` affecté à : ${newVehicle.assignedManagerName}` : ''}`
    );
    return newVehicle;
  };

  const updateVehicle = (id: string, data: Partial<Vehicle>) => {
    const updatedVehicles = vehicles.map((v) => {
      if (v.id === id) {
        const updated = { ...v, ...data };
        if (data.plate) updated.plate = formatPlateFrench(data.plate);
        return updated;
      }
      return v;
    });
    setVehicles(updatedVehicles);
    saveRemoteAgencyData({ vehicles: updatedVehicles }).catch((err) =>
      console.warn('Auto-save updateVehicle to Firestore note:', err)
    );
    addAuditLog('Mise à jour véhicule', 'vehicle', id, `Modification données véhicule #${id}`);
  };

  const approveVehicle = (vehicleId: string, assignedManagerId?: string) => {
    const allUsers = initialUsers;
    const updatedVehicles = vehicles.map((v) => {
      if (v.id === vehicleId) {
        const targetManager = assignedManagerId
          ? allUsers.find((u) => u.id === assignedManagerId)
          : allUsers.find((u) => u.id === v.assignedManagerId);
        return {
          ...v,
          approvalStatus: 'approved' as const,
          assignedManagerId: targetManager ? targetManager.id : v.assignedManagerId,
          assignedManagerName: targetManager ? targetManager.name : v.assignedManagerName,
        };
      }
      return v;
    });
    setVehicles(updatedVehicles);
    saveRemoteAgencyData({ vehicles: updatedVehicles }).catch((err) =>
      console.warn('Auto-save approveVehicle to Firestore note:', err)
    );
    addAuditLog(
      'Approbation véhicule',
      'vehicle',
      vehicleId,
      `Véhicule #${vehicleId} approuvé et intégré au parc officiel par le Gérant (${currentUser.name})`
    );
  };

  const rejectVehicle = (vehicleId: string, reason?: string) => {
    const updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            approvalStatus: 'rejected' as const,
            notes: reason ? `${v.notes || ''} [Refus Gérant: ${reason}]` : v.notes,
          }
        : v
    );
    setVehicles(updatedVehicles);
    saveRemoteAgencyData({ vehicles: updatedVehicles }).catch((err) =>
      console.warn('Auto-save rejectVehicle to Firestore note:', err)
    );
    addAuditLog(
      'Refus ajout véhicule',
      'vehicle',
      vehicleId,
      `Proposition de véhicule refusée par le Gérant (${reason || 'Non justifié'})`
    );
  };

  const assignVehicleManager = (vehicleId: string, managerId: string, managerName: string) => {
    const targetVeh = vehicles.find((v) => v.id === vehicleId);

    const updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            assignedManagerId: managerId,
            assignedManagerName: managerName,
          }
        : v
    );
    setVehicles(updatedVehicles);

    // Mettre à jour automatiquement les contrats liés à ce véhicule
    const updatedContracts = contracts.map((cnt) =>
      cnt.vehicleId === vehicleId || (targetVeh && cnt.vehicleSnapshot?.plate === targetVeh.plate)
        ? {
            ...cnt,
            assignedManagerId: managerId,
            assignedManagerName: managerName,
          }
        : cnt
    );
    setContracts(updatedContracts);

    // Mettre à jour automatiquement les clients qui louent ce véhicule
    const updatedClients = clients.map((c) => {
      const clientContracts = contracts.filter(
        (cnt) =>
          cnt.clientId === c.id ||
          (cnt.clientSnapshot?.docNumber &&
            c.docNumber &&
            cnt.clientSnapshot.docNumber.trim().toUpperCase() === c.docNumber.trim().toUpperCase())
      );
      const hasRentedThisVehicle =
        clientContracts.some(
          (cnt) => cnt.vehicleId === vehicleId || (targetVeh && cnt.vehicleSnapshot?.plate === targetVeh.plate)
        ) ||
        (targetVeh && c.rentedVehiclePlate && c.rentedVehiclePlate.trim() === targetVeh.plate.trim());

      if (hasRentedThisVehicle) {
        return {
          ...c,
          assignedManagerId: managerId,
          assignedManagerName: managerName,
        };
      }
      return c;
    });
    setClients(updatedClients);

    saveRemoteAgencyData({
      vehicles: updatedVehicles,
      contracts: updatedContracts,
      clients: updatedClients,
    }).catch((err) =>
      console.warn('Auto-save assignVehicleManager to Firestore note:', err)
    );

    addAuditLog(
      'Affectation responsable',
      'vehicle',
      vehicleId,
      `Véhicule affecté à ${managerName} par le Gérant (${currentUser.name})`
    );
  };

  const deleteVehicle = (vehicleId: string): { success: boolean; error?: string } => {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) {
      return { success: false, error: 'Véhicule introuvable.' };
    }

    const isGerant = currentUser.role === 'admin';
    const isManager = currentUser.role === 'manager';

    if (!isGerant && !isManager && !hasPermission('canDeleteVehicles')) {
      return { success: false, error: 'Permission refusée : seuls le Gérant et les Managers peuvent supprimer un véhicule.' };
    }

    // Safety check: is vehicle currently rented on an active contract?
    const activeContract = contracts.find(
      (c) => c.vehicleId === vehicleId && c.status === 'active'
    );
    if (activeContract) {
      return {
        success: false,
        error: `Impossible de supprimer ce véhicule car il est actuellement loué sous le contrat en cours ${activeContract.contractNumber}. Clôturez ou annulez d'abord le contrat.`,
      };
    }

    // Remove vehicle from list
    const updatedVehicles = vehicles.filter((v) => v.id !== vehicleId);
    setVehicles(updatedVehicles);
    saveRemoteAgencyData({ vehicles: updatedVehicles }).catch((err) =>
      console.warn('Auto-save deleteVehicle to Firestore note:', err)
    );

    addAuditLog(
      'Suppression véhicule',
      'vehicle',
      vehicleId,
      `Véhicule supprimé définitivement du parc par ${currentUser.name} (${currentUser.role.toUpperCase()}) : ${veh.brand} ${veh.model} [${veh.plate}]`
    );

    return { success: true };
  };

  const createContract = (
    contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>
  ): Contract => {
    const num = String(companySettings.nextContractNumber).padStart(4, '0');
    const contractNumber = `${companySettings.contractPrefix}-${companySettings.contractYear}-${num}`;

    // Resolve assigned manager & phone if not explicitly provided
    let assignedManagerId = contractData.assignedManagerId;
    let assignedManagerName = contractData.assignedManagerName;
    let managerPhone = contractData.managerPhone;

    if (!assignedManagerId || !managerPhone) {
      const veh = vehicles.find((v) => v.id === contractData.vehicleId);
      if (veh?.assignedManagerId) {
        const mgr = users.find((u) => u.id === veh.assignedManagerId);
        assignedManagerId = assignedManagerId || veh.assignedManagerId;
        assignedManagerName = assignedManagerName || veh.assignedManagerName || mgr?.name;
        managerPhone = managerPhone || mgr?.phone;
      } else if (currentUser.role === 'manager') {
        assignedManagerId = assignedManagerId || currentUser.id;
        assignedManagerName = assignedManagerName || currentUser.name;
        managerPhone = managerPhone || currentUser.phone;
      }
    }

    const newContract: Contract = {
      ...contractData,
      assignedManagerId,
      assignedManagerName,
      managerPhone,
      id: `cnt-${Date.now()}`,
      contractNumber,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
      termsVersion: termsVersion.version,
    };

    // Update next contract number
    setCompanySettings((prev) => ({
      ...prev,
      nextContractNumber: prev.nextContractNumber + 1,
    }));

    // Auto-create Deposit Record if deposit amount was provided
    if (newContract.depositAmount && newContract.depositAmount > 0) {
      const newDeposit: DepositRecord = {
        id: `dep-${Date.now()}`,
        contractId: newContract.id,
        contractNumber: newContract.contractNumber,
        clientId: newContract.clientId,
        clientName: `${newContract.clientSnapshot.firstName} ${newContract.clientSnapshot.lastName}`,
        clientPhone: newContract.clientSnapshot.phone,
        vehicleName: `${newContract.vehicleSnapshot.brand} ${newContract.vehicleSnapshot.model}`,
        vehiclePlate: formatPlateFrench(newContract.vehicleSnapshot.plate),
        amount: newContract.depositAmount,
        method: newContract.depositRecord?.method || 'preauth_card',
        methodDetails: newContract.depositRecord?.methodDetails || 'Empreinte bancaire TPE',
        status: 'held',
        receivedAt: `${newContract.startDate} ${newContract.startTime}`,
        receivedBy: currentUser.name,
        deductions: [],
        notes: `Caution enregistrée à l'ouverture du contrat ${newContract.contractNumber}.`,
      };
      setDeposits((prev) => [newDeposit, ...prev]);
      newContract.depositRecord = newDeposit;
    }

    // Update contract list
    setContracts((prev) => [newContract, ...prev]);

    // Update vehicle status to rented if status is active
    if (newContract.status === 'active') {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === newContract.vehicleId
            ? { ...v, status: 'rented', currentKm: newContract.departureKm }
            : v
        )
      );
    }

    // Affectation automatique du client au manager qui possède le véhicule loué
    const rentedVeh = vehicles.find(
      (v) => v.id === newContract.vehicleId || v.plate === newContract.vehicleSnapshot?.plate
    );
    const resolvedManagerId = rentedVeh?.assignedManagerId || newContract.assignedManagerId;
    const resolvedManagerName = rentedVeh?.assignedManagerName || newContract.assignedManagerName;

    // Update client contract count, last contract & manager assignment from the rented vehicle
    setClients((prev) =>
      prev.map((c) =>
        c.id === newContract.clientId ||
        (c.docNumber && newContract.clientSnapshot?.docNumber && c.docNumber.trim().toUpperCase() === newContract.clientSnapshot.docNumber.trim().toUpperCase())
          ? {
              ...c,
              assignedManagerId: resolvedManagerId,
              assignedManagerName: resolvedManagerName,
              rentedVehicleBrand: newContract.vehicleSnapshot?.brand || rentedVeh?.brand,
              rentedVehicleModel: newContract.vehicleSnapshot?.model || rentedVeh?.model,
              rentedVehiclePlate: newContract.vehicleSnapshot?.plate || rentedVeh?.plate,
              contractCount: (c.contractCount || 0) + 1,
              lastContractDate: newContract.startDate,
              lastContractNumber: newContract.contractNumber,
            }
          : c
      )
    );

    addAuditLog(
      'Création contrat',
      'contract',
      contractNumber,
      `Contrat ${contractNumber} créé pour ${newContract.clientSnapshot.firstName} ${newContract.clientSnapshot.lastName} (${newContract.vehicleSnapshot.brand} ${newContract.vehicleSnapshot.model})`
    );

    return newContract;
  };

  const updateContract = (id: string, data: Partial<Contract>): Contract | undefined => {
    const existing = contracts.find((c) => c.id === id);
    if (!existing) return undefined;

    let updatedContract: Contract | undefined = undefined;

    setContracts((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          updatedContract = { ...c, ...data };
          return updatedContract;
        }
        return c;
      })
    );

    // If vehicle changed in active contract
    if (data.vehicleId && data.vehicleId !== existing.vehicleId) {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === existing.vehicleId && existing.status === 'active') {
            return { ...v, status: 'available' };
          }
          if (v.id === data.vehicleId && (data.status || existing.status) === 'active') {
            return { ...v, status: 'rented', currentKm: data.departureKm ?? v.currentKm };
          }
          return v;
        })
      );
    } else if (data.departureKm !== undefined && (data.status || existing.status) === 'active') {
      // Update KM of current vehicle
      setVehicles((prev) =>
        prev.map((v) => (v.id === existing.vehicleId ? { ...v, currentKm: data.departureKm! } : v))
      );
    }

    addAuditLog(
      'Modification contrat',
      'contract',
      existing.contractNumber,
      `Mise à jour des informations du contrat ${existing.contractNumber} (${existing.clientSnapshot.firstName} ${existing.clientSnapshot.lastName})`
    );

    return updatedContract;
  };

  const startEditingContract = (contract: Contract) => {
    setEditingContractData(contract);
    setDuplicateContractData(null);
    setActiveTab('new_contract');
    addAuditLog(
      'Édition contrat',
      'contract',
      contract.contractNumber,
      `Ouverture du mode édition pour le contrat ${contract.contractNumber}`
    );
  };

  const clearEditingData = () => {
    setEditingContractData(null);
  };

  const completeContract = (
    id: string,
    returnKm: number,
    returnDate: string,
    returnTime: string,
    notes?: string
  ) => {
    const target = contracts.find((c) => c.id === id);
    if (!target) return;

    setContracts((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'completed',
              returnKm,
              returnDate,
              returnTime,
              notes: notes ? (c.notes ? `${c.notes}\n[Clôture]: ${notes}` : notes) : c.notes,
            }
          : c
      )
    );

    // Release vehicle back to available with updated km
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === target.vehicleId
          ? { ...v, status: 'available', currentKm: returnKm }
          : v
      )
    );

    addAuditLog(
      'Clôture contrat',
      'contract',
      target.contractNumber,
      `Véhicule restitué à ${returnKm} KM (Restitution le ${returnDate} à ${returnTime}). Véhicule libéré.`
    );
  };

  const cancelContract = (id: string, reason?: string) => {
    const target = contracts.find((c) => c.id === id);
    if (!target) return;

    setContracts((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'cancelled',
              notes: reason ? (c.notes ? `${c.notes}\n[Annulation]: ${reason}` : reason) : c.notes,
            }
          : c
      )
    );

    // If vehicle was rented by this contract, release it
    if (target.status === 'active') {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === target.vehicleId ? { ...v, status: 'available' } : v
        )
      );
    }

    addAuditLog(
      'Annulation contrat',
      'contract',
      target.contractNumber,
      `Contrat ${target.contractNumber} annulé. Motif: ${reason || 'Non précisé'}`
    );
  };

  const deleteContract = (id: string): { success: boolean; error?: string } => {
    const target = contracts.find((c) => c.id === id);
    if (!target) {
      return { success: false, error: 'Contrat introuvable.' };
    }

    // Strictly restricted to Gérant (admin role) OR users with canDeleteContracts permission
    const isGerant = currentUser.role === 'admin';
    if (!isGerant && !hasPermission('canDeleteContracts')) {
      return {
        success: false,
        error: 'Action non autorisée : seul le Gérant a le droit de supprimer définitivement un contrat.',
      };
    }

    // Release vehicle if contract was active
    if (target.status === 'active') {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === target.vehicleId ? { ...v, status: 'available' } : v
        )
      );
    }

    // Remove contract
    setContracts((prev) => prev.filter((c) => c.id !== id));

    // Also remove any related deposits
    setDeposits((prev) => prev.filter((d) => d.contractId !== id && d.contractNumber !== target.contractNumber));

    addAuditLog(
      'Suppression contrat',
      'contract',
      target.contractNumber,
      `Contrat ${target.contractNumber} (${target.clientSnapshot.lastName} ${target.clientSnapshot.firstName} - ${target.vehicleSnapshot.brand} ${target.vehicleSnapshot.model}) supprimé définitivement par le Gérant (${currentUser.name})`
    );

    return { success: true };
  };

  const duplicateContract = (contract: Contract) => {
    setDuplicateContractData(contract);
    setActiveTab('new_contract');
    addAuditLog(
      'Duplication contrat',
      'contract',
      contract.contractNumber,
      `Pré-remplissage d’un nouveau contrat à partir du contrat ${contract.contractNumber}`
    );
  };

  const clearDuplicateData = () => {
    setDuplicateContractData(null);
  };

  const updateCompanySettings = (settings: Partial<CompanySettings>) => {
    setCompanySettings((prev) => ({ ...prev, ...settings }));
    addAuditLog('Mise à jour paramètres', 'settings', 'company', 'Modification des paramètres de la société');
  };

  const updateAiSettings = (newSettings: Partial<AiAssistantSettings>) => {
    setAiSettings((prev) => ({ ...prev, ...newSettings }));
    addAuditLog(
      'Mise à jour Charte IA',
      'settings',
      'ai_assistant',
      'Modification du style, de la vision et des réponses de l’assistant IA'
    );
  };

  const resetAiSettings = () => {
    setAiSettings(DEFAULT_AI_SETTINGS);
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(DEFAULT_AI_SETTINGS));
    addAuditLog(
      'Réinitialisation Charte IA',
      'settings',
      'ai_assistant',
      'Restauration de la configuration d’origine de l’assistant IA'
    );
  };

  const updateTermsVersion = (terms: TermsVersion) => {
    setTermsVersion(terms);
    addAuditLog('Mise à jour conditions', 'terms', terms.version, `Mise à jour des conditions générales version ${terms.version}`);
  };

  const addTermsClause = (clause: TermClause) => {
    setTermsVersion((prev) => ({
      ...prev,
      clauses: [...prev.clauses, clause],
    }));
    addAuditLog(
      'Ajout clause contractuelle',
      'terms',
      clause.number,
      `Nouvelle clause ${clause.number} (${clause.title}) ajoutée par le Gérant (${currentUser.name})`
    );
  };

  const updateTermsClause = (number: string, clauseData: Partial<TermClause>) => {
    setTermsVersion((prev) => ({
      ...prev,
      clauses: prev.clauses.map((c) => (c.number === number ? { ...c, ...clauseData } : c)),
    }));
    addAuditLog(
      'Modification clause contractuelle',
      'terms',
      number,
      `Clause ${number} mise à jour par le Gérant (${currentUser.name})`
    );
  };

  const deleteTermsClause = (number: string) => {
    setTermsVersion((prev) => ({
      ...prev,
      clauses: prev.clauses.filter((c) => c.number !== number),
    }));
    addAuditLog(
      'Suppression clause contractuelle',
      'terms',
      number,
      `Clause ${number} retirée des conditions générales par le Gérant (${currentUser.name})`
    );
  };

  const openPdfModal = (contract: Contract) => {
    setPdfModalContract(contract);
    setIsPdfModalOpen(true);
    addAuditLog('Visualisation PDF A4', 'contract', contract.contractNumber, `Consultation de la maquette A4 2 pages du contrat ${contract.contractNumber}`);
  };

  const closePdfModal = () => {
    setIsPdfModalOpen(false);
    setPdfModalContract(null);
  };

  const updateDeposit = (id: string, data: Partial<DepositRecord>) => {
    setDeposits((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...data } : d))
    );
    addAuditLog('Mise à jour caution', 'contract', id, `Modification des données de caution #${id}`);
  };

  const releaseDeposit = (depositId: string, refundedAmount: number, notes?: string) => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setDeposits((prev) =>
      prev.map((d) => {
        if (d.id === depositId) {
          return {
            ...d,
            status: 'released',
            releasedAt: formatted,
            releasedBy: currentUser.name,
            refundedAmount,
            notes: notes ? (d.notes ? `${d.notes}\n[Restitution]: ${notes}` : notes) : d.notes,
          };
        }
        return d;
      })
    );

    addAuditLog(
      'Restitution de caution',
      'contract',
      depositId,
      `Caution ${depositId} restituée par ${currentUser.name}. Montant remboursé : ${refundedAmount} MAD.`
    );
  };

  const deductDeposit = (
    depositId: string,
    deductionData: Omit<DepositDeduction, 'id' | 'date'>,
    refundedRemaining: boolean = false
  ) => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const newDeduction: DepositDeduction = {
      ...deductionData,
      id: `ded-${Date.now()}`,
      date: dateStr,
    };

    setDeposits((prev) =>
      prev.map((d) => {
        if (d.id === depositId) {
          const updatedDeductions = [...d.deductions, newDeduction];
          const totalDeducted = updatedDeductions.reduce((sum, item) => sum + item.amount, 0);
          const remaining = Math.max(0, d.amount - totalDeducted);
          const isFull = totalDeducted >= d.amount;
          const status = isFull ? 'fully_retained' : 'partially_deducted';

          return {
            ...d,
            deductions: updatedDeductions,
            status,
            refundedAmount: refundedRemaining ? remaining : (d.refundedAmount || remaining),
            releasedAt: refundedRemaining ? `${dateStr} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : d.releasedAt,
            releasedBy: refundedRemaining ? currentUser.name : d.releasedBy,
          };
        }
        return d;
      })
    );

    addAuditLog(
      'Déduction sur caution',
      'contract',
      depositId,
      `Retenue de ${deductionData.amount} MAD (${deductionData.label}) sur la caution #${depositId}`
    );
  };

  const updateContractInspection = (contractId: string, inspection: ContractInspection) => {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id === contractId) {
          return {
            ...c,
            inspection,
            departureFuel: inspection.departureFuel || inspection.departureChecklist?.fuelLevel || c.departureFuel || '8/8 (Plein)',
            returnFuel: inspection.returnFuel || inspection.returnChecklist?.fuelLevel || c.returnFuel,
          };
        }
        return c;
      })
    );
    addAuditLog(
      'Mise à jour état des lieux',
      'contract',
      contractId,
      `Inspection et photos d'état des lieux mises à jour pour le contrat (${inspection.photos.length} photo(s) attachée(s))`
    );
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.DRIVERS);
    localStorage.removeItem(STORAGE_KEYS.VEHICLES);
    localStorage.removeItem(STORAGE_KEYS.CONTRACTS);
    localStorage.removeItem(STORAGE_KEYS.DEPOSITS);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.TERMS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT);
    localStorage.removeItem(STORAGE_KEYS.USER);

    setClients(initialClients);
    setDrivers(initialDrivers);
    setVehicles(initialVehicles);
    setContracts(initialContracts);
    setDeposits(initialDeposits);
    setCompanySettings(initialCompanySettings);
    setTermsVersion(initialTermsVersion);
    setAuditLogs(initialAuditLogs);
    setCurrentUser(initialUsers[0]);
    addAuditLog('Réinitialisation démo', 'settings', 'system', 'Restauration complète des données initiales de démonstration');
  };

  const getClientAssignedManager = (client: Client): ClientManagerAssignment => {
    return resolveClientManagerAndVehicle(client, contracts, vehicles, users);
  };

  return (
    <AppContext.Provider
      value={{
        clients,
        drivers,
        vehicles,
        contracts,
        deposits,
        termsVersion,
        companySettings,
        auditLogs,
        users,
        availableUsers: users,
        currentUser,
        activeTab,
        selectedContract,
        selectedClient,
        selectedVehicle,
        pdfModalContract,
        isPdfModalOpen,
        duplicateContractData,
        editingContractData,
        cloudSyncStatus,
        lastCloudSync,
        syncWithCloud,
        pushToCloud,
        setActiveTab,
        setCurrentUserRole,
        switchUser,
        login,
        logout,
        updateUserPermissions,
        updateUserRole,
        resetUserPermissions,
        addUser,
        updateUser,
        deleteUser,
        hasPermission,
        updateTermsVersion,
        addTermsClause,
        updateTermsClause,
        deleteTermsClause,
        addClient,
        updateClient,
        deleteClient,
        addDriver,
        addVehicle,
        updateVehicle,
        approveVehicle,
        rejectVehicle,
        assignVehicleManager,
        deleteVehicle,
        createContract,
        updateContract,
        startEditingContract,
        clearEditingData,
        completeContract,
        cancelContract,
        deleteContract,
        duplicateContract,
        clearDuplicateData,
        updateCompanySettings,
        aiSettings,
        updateAiSettings,
        resetAiSettings,
        addAuditLog,
        openPdfModal,
        closePdfModal,
        setSelectedContract,
        setSelectedClient,
        setSelectedVehicle,
        resetAllData,
        theme,
        toggleTheme,
        setTheme,
        updateDeposit,
        releaseDeposit,
        deductDeposit,
        updateContractInspection,
        getClientAssignedManager,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
