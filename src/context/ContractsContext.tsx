import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Contract,
  ContractInspection,
  Vehicle,
  Client,
  User,
  CompanySettings,
  TermsVersion,
  DepositRecord,
} from '../types';
import { initialContracts } from '../data/mockData';
import { saveRemoteAgencyData } from '../lib/firestoreSync';
import { formatPlateFrench } from '../utils/plateUtils';

export interface ContractsContextType {
  contracts: Contract[];
  selectedContract: Contract | null;
  pdfModalContract: Contract | null;
  isPdfModalOpen: boolean;
  duplicateContractData: Contract | null;
  editingContractData: Contract | null;

  setSelectedContract: (contract: Contract | null) => void;
  setContractsList: (contracts: Contract[]) => void;
  startEditingContract: (contract: Contract, onNavigate?: () => void) => void;
  clearEditingData: () => void;
  duplicateContract: (contract: Contract, onNavigate?: () => void) => void;
  clearDuplicateData: () => void;
  openPdfModal: (contract: Contract) => void;
  closePdfModal: () => void;
  updateContractInspection: (contractId: string, inspection: ContractInspection) => void;

  createContract: (
    contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>,
    options: {
      currentUser?: User | null;
      companySettings: CompanySettings;
      termsVersion: TermsVersion;
      vehicles: Vehicle[];
      users: User[];
      onUpdateCompanySettings: (settings: Partial<CompanySettings>) => void;
      onAddDeposit: (deposit: DepositRecord) => void;
      onUpdateVehicles: (updater: (prev: Vehicle[]) => Vehicle[]) => void;
      onUpdateClients: (updater: (prev: Client[]) => Client[]) => void;
    }
  ) => Contract;

  updateContract: (
    id: string,
    data: Partial<Contract>,
    onUpdateVehicles?: (updater: (prev: Vehicle[]) => Vehicle[]) => void
  ) => Contract | undefined;

  completeContract: (
    id: string,
    returnKm: number,
    returnDate: string,
    returnTime: string,
    notes?: string,
    onReleaseVehicle?: (vehicleId: string, returnKm: number) => void
  ) => void;

  cancelContract: (
    id: string,
    reason?: string,
    onReleaseVehicle?: (vehicleId: string) => void
  ) => void;

  deleteContract: (
    id: string,
    currentUser?: User | null,
    hasPermission?: (perm: any) => boolean,
    onReleaseVehicle?: (vehicleId: string) => void
  ) => { success: boolean; error?: string };
}

const STORAGE_KEY = 'morvello_contracts_v1';

const ContractsContext = createContext<ContractsContextType | undefined>(undefined);

export const ContractsProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialContracts;
  });

  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [pdfModalContract, setPdfModalContract] = useState<Contract | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [duplicateContractData, setDuplicateContractData] = useState<Contract | null>(null);
  const [editingContractData, setEditingContractData] = useState<Contract | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
  }, [contracts]);

  const logAction = (action: string, targetType: any, targetId: string, details: string) => {
    if (onAuditLog) {
      onAuditLog(action, targetType, targetId, details);
    }
  };

  const createContract = (
    contractData: Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'createdBy'>,
    {
      currentUser,
      companySettings,
      termsVersion,
      vehicles,
      users,
      onUpdateCompanySettings,
      onAddDeposit,
      onUpdateVehicles,
      onUpdateClients,
    }: {
      currentUser?: User | null;
      companySettings: CompanySettings;
      termsVersion: TermsVersion;
      vehicles: Vehicle[];
      users: User[];
      onUpdateCompanySettings: (settings: Partial<CompanySettings>) => void;
      onAddDeposit: (deposit: DepositRecord) => void;
      onUpdateVehicles: (updater: (prev: Vehicle[]) => Vehicle[]) => void;
      onUpdateClients: (updater: (prev: Client[]) => Client[]) => void;
    }
  ): Contract => {
    const num = String(companySettings.nextContractNumber).padStart(4, '0');
    const contractNumber = `${companySettings.contractPrefix}-${companySettings.contractYear}-${num}`;

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
      } else if (currentUser?.role === 'manager') {
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
      createdBy: currentUser?.name || 'Système',
      termsVersion: termsVersion.version,
    };

    onUpdateCompanySettings({ nextContractNumber: companySettings.nextContractNumber + 1 });

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
        receivedBy: currentUser?.name || 'Direction',
        deductions: [],
        notes: `Caution enregistrée à l'ouverture du contrat ${newContract.contractNumber}.`,
      };
      onAddDeposit(newDeposit);
      newContract.depositRecord = newDeposit;
    }

    const updatedContracts = [newContract, ...contracts];
    setContracts(updatedContracts);
    saveRemoteAgencyData({ contracts: updatedContracts }).catch((err) =>
      console.warn('Auto-save createContract to Firestore note:', err)
    );

    if (newContract.status === 'active') {
      onUpdateVehicles((prev) =>
        prev.map((v) =>
          v.id === newContract.vehicleId ? { ...v, status: 'rented', currentKm: newContract.departureKm } : v
        )
      );
    }

    const rentedVeh = vehicles.find(
      (v) => v.id === newContract.vehicleId || v.plate === newContract.vehicleSnapshot?.plate
    );
    const resolvedManagerId = rentedVeh?.assignedManagerId || newContract.assignedManagerId;
    const resolvedManagerName = rentedVeh?.assignedManagerName || newContract.assignedManagerName;

    onUpdateClients((prev) =>
      prev.map((c) =>
        c.id === newContract.clientId ||
        (c.docNumber &&
          newContract.clientSnapshot?.docNumber &&
          c.docNumber.trim().toUpperCase() === newContract.clientSnapshot.docNumber.trim().toUpperCase())
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

    logAction(
      'Création contrat',
      'contract',
      contractNumber,
      `Contrat ${contractNumber} créé pour ${newContract.clientSnapshot.firstName} ${newContract.clientSnapshot.lastName} (${newContract.vehicleSnapshot.brand} ${newContract.vehicleSnapshot.model})`
    );

    return newContract;
  };

  const updateContract = (
    id: string,
    data: Partial<Contract>,
    onUpdateVehicles?: (updater: (prev: Vehicle[]) => Vehicle[]) => void
  ): Contract | undefined => {
    const existing = contracts.find((c) => c.id === id);
    if (!existing) return undefined;

    let updatedContract: Contract | undefined = undefined;

    const updatedContracts = contracts.map((c) => {
      if (c.id === id) {
        updatedContract = { ...c, ...data };
        return updatedContract;
      }
      return c;
    });

    setContracts(updatedContracts);
    saveRemoteAgencyData({ contracts: updatedContracts }).catch((err) =>
      console.warn('Auto-save updateContract to Firestore note:', err)
    );

    if (onUpdateVehicles) {
      if (data.vehicleId && data.vehicleId !== existing.vehicleId) {
        onUpdateVehicles((prev) =>
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
        onUpdateVehicles((prev) =>
          prev.map((v) => (v.id === existing.vehicleId ? { ...v, currentKm: data.departureKm! } : v))
        );
      }
    }

    logAction(
      'Modification contrat',
      'contract',
      existing.contractNumber,
      `Mise à jour des informations du contrat ${existing.contractNumber}`
    );

    return updatedContract;
  };

  const startEditingContract = (contract: Contract, onNavigate?: () => void) => {
    setEditingContractData(contract);
    setDuplicateContractData(null);
    if (onNavigate) onNavigate();
    logAction(
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
    notes?: string,
    onReleaseVehicle?: (vehicleId: string, returnKm: number) => void
  ) => {
    const target = contracts.find((c) => c.id === id);
    if (!target) return;

    const updatedContracts = contracts.map((c) =>
      c.id === id
        ? {
            ...c,
            status: 'completed' as const,
            returnKm,
            returnDate,
            returnTime,
            notes: notes ? (c.notes ? `${c.notes}\n[Clôture]: ${notes}` : notes) : c.notes,
          }
        : c
    );

    setContracts(updatedContracts);
    saveRemoteAgencyData({ contracts: updatedContracts }).catch((err) =>
      console.warn('Auto-save completeContract to Firestore note:', err)
    );

    if (onReleaseVehicle) {
      onReleaseVehicle(target.vehicleId, returnKm);
    }

    logAction(
      'Clôture contrat',
      'contract',
      target.contractNumber,
      `Véhicule restitué à ${returnKm} KM (Restitution le ${returnDate} à ${returnTime}). Véhicule libéré.`
    );
  };

  const cancelContract = (
    id: string,
    reason?: string,
    onReleaseVehicle?: (vehicleId: string) => void
  ) => {
    const target = contracts.find((c) => c.id === id);
    if (!target) return;

    const updatedContracts = contracts.map((c) =>
      c.id === id
        ? {
            ...c,
            status: 'cancelled' as const,
            notes: reason ? (c.notes ? `${c.notes}\n[Annulation]: ${reason}` : reason) : c.notes,
          }
        : c
    );

    setContracts(updatedContracts);
    saveRemoteAgencyData({ contracts: updatedContracts }).catch((err) =>
      console.warn('Auto-save cancelContract to Firestore note:', err)
    );

    if (target.status === 'active' && onReleaseVehicle) {
      onReleaseVehicle(target.vehicleId);
    }

    logAction(
      'Annulation contrat',
      'contract',
      target.contractNumber,
      `Contrat ${target.contractNumber} annulé. Motif: ${reason || 'Non précisé'}`
    );
  };

  const deleteContract = (
    id: string,
    currentUser?: User | null,
    hasPermission?: (perm: any) => boolean,
    onReleaseVehicle?: (vehicleId: string) => void
  ): { success: boolean; error?: string } => {
    const target = contracts.find((c) => c.id === id);
    if (!target) {
      return { success: false, error: 'Contrat introuvable.' };
    }

    const isGerant = currentUser?.role === 'admin';
    const canDelete = hasPermission ? hasPermission('canDeleteContracts') : false;

    if (!isGerant && !canDelete) {
      return {
        success: false,
        error: 'Action non autorisée : seul le Gérant a le droit de supprimer définitivement un contrat.',
      };
    }

    if (target.status === 'active' && onReleaseVehicle) {
      onReleaseVehicle(target.vehicleId);
    }

    const updatedContracts = contracts.filter((c) => c.id !== id);
    setContracts(updatedContracts);
    saveRemoteAgencyData({ contracts: updatedContracts }).catch((err) =>
      console.warn('Auto-save deleteContract to Firestore note:', err)
    );

    logAction(
      'Suppression contrat',
      'contract',
      target.contractNumber,
      `Contrat ${target.contractNumber} définitivement supprimé par ${currentUser?.name || 'Direction'}`
    );

    return { success: true };
  };

  const duplicateContract = (contract: Contract, onNavigate?: () => void) => {
    setDuplicateContractData(contract);
    setEditingContractData(null);
    if (onNavigate) onNavigate();
    logAction(
      'Duplication contrat',
      'contract',
      contract.contractNumber,
      `Pré-remplissage d’un nouveau contrat à partir du contrat ${contract.contractNumber}`
    );
  };

  const clearDuplicateData = () => {
    setDuplicateContractData(null);
  };

  const openPdfModal = (contract: Contract) => {
    setPdfModalContract(contract);
    setIsPdfModalOpen(true);
    logAction(
      'Visualisation PDF A4',
      'contract',
      contract.contractNumber,
      `Consultation de la maquette A4 2 pages du contrat ${contract.contractNumber}`
    );
  };

  const closePdfModal = () => {
    setIsPdfModalOpen(false);
    setPdfModalContract(null);
  };

  const updateContractInspection = (contractId: string, inspection: ContractInspection) => {
    const updatedContracts = contracts.map((c) => {
      if (c.id === contractId) {
        return {
          ...c,
          inspection,
          departureFuel:
            inspection.departureFuel ||
            inspection.departureChecklist?.fuelLevel ||
            c.departureFuel ||
            '8/8 (Plein)',
          returnFuel: inspection.returnFuel || inspection.returnChecklist?.fuelLevel || c.returnFuel,
        };
      }
      return c;
    });

    setContracts(updatedContracts);
    saveRemoteAgencyData({ contracts: updatedContracts }).catch((err) =>
      console.warn('Auto-save updateContractInspection to Firestore note:', err)
    );

    logAction(
      'Mise à jour état des lieux',
      'contract',
      contractId,
      `Inspection mise à jour pour le contrat (${inspection.photos.length} photo(s))`
    );
  };

  const setContractsList = (newContracts: Contract[]) => {
    setContracts(newContracts);
  };

  return (
    <ContractsContext.Provider
      value={{
        contracts,
        selectedContract,
        pdfModalContract,
        isPdfModalOpen,
        duplicateContractData,
        editingContractData,
        setSelectedContract,
        setContractsList,
        startEditingContract,
        clearEditingData,
        duplicateContract,
        clearDuplicateData,
        openPdfModal,
        closePdfModal,
        updateContractInspection,
        createContract,
        updateContract,
        completeContract,
        cancelContract,
        deleteContract,
      }}
    >
      {children}
    </ContractsContext.Provider>
  );
};

export const useContracts = () => {
  const context = useContext(ContractsContext);
  if (!context) {
    throw new Error('useContracts must be used within a ContractsProvider');
  }
  return context;
};
