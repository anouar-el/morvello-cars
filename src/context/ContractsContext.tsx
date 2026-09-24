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
  PaymentRecord,
  PaymentMethod,
} from '../types';
import { initialContracts } from '../data/mockData';
import { saveRemoteAgencyData } from '../lib/firestoreSync';
import { formatPlateFrench } from '../utils/plateUtils';
import {
  getNextAvailableContractNumber,
  findDuplicateContractNumbers,
  repairAndDeduplicateContracts,
  sortContractsByNumber,
  DuplicateContractReport,
} from '../utils/contractNumberUtils';

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

  repairDuplicateContracts: (
    deposits: DepositRecord[],
    companySettings: CompanySettings,
    onUpdateDeposits: (deps: DepositRecord[]) => void,
    onUpdateCompanySettings: (settings: CompanySettings) => void
  ) => { renumberedCount: number };

  updateContract: (
    id: string,
    data: Partial<Contract>,
    onUpdateVehicles?: (updater: (prev: Vehicle[]) => Vehicle[]) => void
  ) => Contract | undefined;

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

const normalizeContractFinancials = (c: Contract): Contract => {
  const pricePerDay = c.pricePerDay !== undefined ? Number(c.pricePerDay) : 0;
  const totalDays = c.totalDays || 1;
  const totalAmount = c.totalAmount !== undefined ? Number(c.totalAmount) : (pricePerDay * totalDays);
  const payments = c.payments || [];
  const paidAmount = payments.length > 0
    ? payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
    : (c.paidAmount !== undefined ? Number(c.paidAmount) : 0);
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const paymentStatus: 'paid' | 'partial' | 'unpaid' =
    totalAmount === 0 || remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  return {
    ...c,
    pricePerDay,
    totalDays,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
  };
};

export const ContractsProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
  const [contracts, setContracts] = useState<Contract[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: Contract[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (c) => !['cnt-1', 'cnt-2', 'cnt-3', 'cnt-4', 'cnt-48', 'cnt-49'].includes(c.id)
          );
          if (filtered.length > 0) {
            const upgraded = filtered.map((c) => {
              if (c.id === 'cnt-1789166132353' && (!c.payments || c.payments.length <= 1 || (c.remainingAmount && c.remainingAmount > 0))) {
                const init = initialContracts.find((i) => i.id === c.id);
                if (init) return init;
              }
              return c;
            });
            return sortContractsByNumber(upgraded.map(normalizeContractFinancials), 'desc');
          }
        }
      } catch (e) {
        console.warn('Error reading saved contracts:', e);
      }
    }
    return sortContractsByNumber(initialContracts.map(normalizeContractFinancials), 'desc');
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
    const { formattedContractNumber, nextSequence } = getNextAvailableContractNumber(
      contracts,
      companySettings
    );
    const contractNumber = formattedContractNumber;

    let assignedManagerId = contractData.assignedManagerId;
    let assignedManagerName = contractData.assignedManagerName;
    let managerPhone = contractData.managerPhone;

    if (!assignedManagerId || !managerPhone) {
      const veh = vehicles.find((v) => v.id === contractData.vehicleId);
      if (veh?.assignedManagerId) {
        const mgr = users.find((u) => u.id === veh.assignedManagerId || u.legacyId === veh.assignedManagerId);
        assignedManagerId = assignedManagerId || (mgr?.firebaseUid || (!mgr?.id?.startsWith('usr-') ? mgr?.id : undefined) || veh.assignedManagerId);
        assignedManagerName = assignedManagerName || veh.assignedManagerName || mgr?.name;
        managerPhone = managerPhone || mgr?.phone;
      } else if (currentUser?.role === 'manager') {
        assignedManagerId = assignedManagerId || currentUser.firebaseUid || currentUser.id;
        assignedManagerName = assignedManagerName || currentUser.name;
        managerPhone = managerPhone || currentUser.phone;
      }
    }

    // Toujours résoudre un identifiant hérité ('usr-N') vers le véritable UUID Supabase si disponible
    if (assignedManagerId) {
      const matchedMgr = users.find((u) => u.id === assignedManagerId || u.legacyId === assignedManagerId);
      if (matchedMgr) {
        if (matchedMgr.firebaseUid) {
          assignedManagerId = matchedMgr.firebaseUid;
        } else if (matchedMgr.id && !matchedMgr.id.startsWith('usr-')) {
          assignedManagerId = matchedMgr.id;
        }
      }
    }

    const pricePerDay = contractData.pricePerDay !== undefined ? Number(contractData.pricePerDay) : 0;
    const totalDays = contractData.totalDays || 1;
    const totalContractAmount = contractData.totalAmount !== undefined
      ? Number(contractData.totalAmount)
      : (pricePerDay * totalDays);
    const initialPayments = contractData.payments || [];
    const initialPaid = contractData.paidAmount !== undefined
      ? contractData.paidAmount
      : initialPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    const initialRemaining = contractData.remainingAmount !== undefined
      ? contractData.remainingAmount
      : Math.max(0, totalContractAmount - initialPaid);

    const newContract: Contract = normalizeContractFinancials({
      ...contractData,
      assignedManagerId,
      assignedManagerName,
      managerPhone,
      id: `cnt-${Date.now()}`,
      contractNumber,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || 'Système',
      termsVersion: termsVersion.version,
      payments: initialPayments,
      pricePerDay,
      totalDays,
      totalAmount: totalContractAmount,
      paidAmount: initialPaid,
      remainingAmount: initialRemaining,
      paymentStatus: totalContractAmount === 0 || initialRemaining <= 0 ? 'paid' : initialPaid > 0 ? 'partial' : 'unpaid',
    });

    const updatedCompanySettings: CompanySettings = {
      ...companySettings,
      nextContractNumber: nextSequence + 1,
    };
    onUpdateCompanySettings(updatedCompanySettings);

    const rentedVeh = vehicles.find(
      (v) => v.id === newContract.vehicleId || v.plate === newContract.vehicleSnapshot?.plate
    );
    let resolvedManagerId = rentedVeh?.assignedManagerId || newContract.assignedManagerId;
    if (resolvedManagerId) {
      const matchedMgr = users.find((u) => u.id === resolvedManagerId || u.legacyId === resolvedManagerId);
      if (matchedMgr) {
        if (matchedMgr.firebaseUid) {
          resolvedManagerId = matchedMgr.firebaseUid;
        } else if (matchedMgr.id && !matchedMgr.id.startsWith('usr-')) {
          resolvedManagerId = matchedMgr.id;
        }
      }
    }
    const resolvedManagerName = rentedVeh?.assignedManagerName || newContract.assignedManagerName;

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
        assignedManagerId: resolvedManagerId,
        assignedManagerName: resolvedManagerName,
        createdBy: currentUser?.name || 'Direction',
      };
      onAddDeposit(newDeposit);
      newContract.depositRecord = newDeposit;
    }

    let computedClients: Client[] | undefined;
    onUpdateClients((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          c.id === newContract.clientId ||
          (c.docNumber &&
            newContract.clientSnapshot?.docNumber &&
            c.docNumber.trim().toUpperCase() === newContract.clientSnapshot.docNumber.trim().toUpperCase())
      );

      let updatedClients: Client[];
      if (existingIdx !== -1) {
        updatedClients = prev.map((c, idx) =>
          idx === existingIdx
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
        );
      } else if (newContract.clientSnapshot) {
        const snap = newContract.clientSnapshot;
        const newClient: Client = {
          id: newContract.clientId || `cli-${Date.now()}`,
          firstName: snap.firstName || '',
          lastName: snap.lastName || '',
          birthDate: snap.birthDate || '',
          drivingLicense: snap.drivingLicense || '',
          docType: snap.docType || 'CIN',
          docNumber: snap.docNumber || '',
          phone: snap.phone || '',
          email: snap.email || '',
          country: snap.country || '',
          address: snap.address || '',
          cinDocUrl: snap.cinDocUrl,
          cinDocName: snap.cinDocName,
          cinDocVersoUrl: snap.cinDocVersoUrl,
          cinDocVersoName: snap.cinDocVersoName,
          licenseDocUrl: snap.licenseDocUrl,
          licenseDocName: snap.licenseDocName,
          licenseDocVersoUrl: snap.licenseDocVersoUrl,
          licenseDocVersoName: snap.licenseDocVersoName,
          documents: snap.documents || [],
          notes: `Titulaire du contrat ${newContract.contractNumber}`,
          createdAt: newContract.createdAt || new Date().toISOString(),
          contractCount: 1,
          lastContractDate: newContract.startDate,
          lastContractNumber: newContract.contractNumber,
          assignedManagerId: resolvedManagerId,
          assignedManagerName: resolvedManagerName,
          rentedVehicleBrand: newContract.vehicleSnapshot?.brand || rentedVeh?.brand,
          rentedVehicleModel: newContract.vehicleSnapshot?.model || rentedVeh?.model,
          rentedVehiclePlate: newContract.vehicleSnapshot?.plate || rentedVeh?.plate,
          createdBy: newContract.createdBy,
        };
        updatedClients = [newClient, ...prev];
      } else {
        updatedClients = prev;
      }
      computedClients = updatedClients;
      return updatedClients;
    });

    if (newContract.status === 'active') {
      onUpdateVehicles((prev) =>
        prev.map((v) => {
          const matchById = v.id === newContract.vehicleId;
          const matchByPlate =
            v.plate &&
            newContract.vehicleSnapshot?.plate &&
            v.plate.trim().toUpperCase() === newContract.vehicleSnapshot.plate.trim().toUpperCase();
          if (matchById || matchByPlate) {
            return {
              ...v,
              status: 'rented' as const,
              currentKm: Math.max(v.currentKm || 0, newContract.departureKm || 0),
            };
          }
          return v;
        })
      );
    }

    const updatedContracts = sortContractsByNumber([newContract, ...contracts], 'desc');
    setContracts(updatedContracts);
    saveRemoteAgencyData({
      contracts: updatedContracts,
      clients: computedClients,
      companySettings: updatedCompanySettings,
    }).catch((err) =>
      console.warn('Auto-save createContract to Firestore note:', err)
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
        const merged: Contract = { ...c, ...data };
        if (data.depositAmount !== undefined) {
          const numDeposit = Number(data.depositAmount);
          merged.depositAmount = numDeposit;
          if (merged.depositRecord) {
            merged.depositRecord = {
              ...merged.depositRecord,
              amount: numDeposit,
            };
          }
        }
        updatedContract = normalizeContractFinancials(merged);
        return updatedContract;
      }
      return c;
    });

    setContracts(updatedContracts);
    if (pdfModalContract?.id === id && updatedContract) {
      setPdfModalContract(updatedContract);
    }
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

  const addPaymentToContract = (
    contractId: string,
    payment: Omit<PaymentRecord, 'id' | 'date'> & { date?: string; id?: string },
    actorName: string = 'Direction'
  ): Contract | undefined => {
    const existing = contracts.find((c) => c.id === contractId);
    if (!existing) return undefined;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newPaymentRecord: PaymentRecord = {
      id: payment.id || `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: Math.max(0, Number(payment.amount) || 0),
      method: payment.method,
      date: payment.date || formattedDate,
      notes: payment.notes || '',
      recordedBy: payment.recordedBy || actorName,
      receiptNumber:
        payment.receiptNumber ||
        `REC-${existing.contractNumber}-${(existing.payments?.length || 0) + 1}`,
    };

    const currentPayments = existing.payments || [];
    const newPayments = [...currentPayments, newPaymentRecord];
    const totalPaid = newPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const existingRate = existing.pricePerDay !== undefined ? Number(existing.pricePerDay) : 0;
    const contractTotal = existing.totalAmount !== undefined ? Number(existing.totalAmount) : (existingRate * (existing.totalDays || 1));
    const newRemaining = Math.max(0, contractTotal - totalPaid);
    const newPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      contractTotal === 0 || newRemaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    const updated = updateContract(contractId, {
      payments: newPayments,
      paidAmount: totalPaid,
      remainingAmount: newRemaining,
      paymentStatus: newPaymentStatus,
    });

    logAction(
      'Paiement reçu',
      'contract',
      existing.contractNumber,
      `Paiement de ${newPaymentRecord.amount} MAD enregistré (${newPaymentRecord.method}) par ${actorName}. Reste à payer : ${newRemaining} MAD.`
    );

    return updated;
  };

  const updateContractPayment = (
    contractId: string,
    paymentId: string,
    paymentData: Partial<PaymentRecord>,
    actorName: string = 'Direction'
  ): Contract | undefined => {
    const existing = contracts.find((c) => c.id === contractId);
    if (!existing) return undefined;

    const currentPayments = existing.payments || [];
    const updatedPayments = currentPayments.map((p) =>
      p.id === paymentId
        ? {
            ...p,
            ...paymentData,
            amount: paymentData.amount !== undefined ? Math.max(0, Number(paymentData.amount) || 0) : p.amount,
          }
        : p
    );

    const totalPaid = updatedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const existingRate = existing.pricePerDay !== undefined ? Number(existing.pricePerDay) : 0;
    const contractTotal = existing.totalAmount !== undefined ? Number(existing.totalAmount) : (existingRate * (existing.totalDays || 1));
    const newRemaining = Math.max(0, contractTotal - totalPaid);
    const newPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      contractTotal === 0 || newRemaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    const updated = updateContract(contractId, {
      payments: updatedPayments,
      paidAmount: totalPaid,
      remainingAmount: newRemaining,
      paymentStatus: newPaymentStatus,
    });

    logAction(
      'Modification paiement',
      'contract',
      existing.contractNumber,
      `Paiement #${paymentId} modifié par ${actorName}. Total payé : ${totalPaid} MAD, Reste : ${newRemaining} MAD.`
    );

    return updated;
  };

  const deleteContractPayment = (
    contractId: string,
    paymentId: string,
    actorName: string = 'Direction'
  ): Contract | undefined => {
    const existing = contracts.find((c) => c.id === contractId);
    if (!existing) return undefined;

    const currentPayments = existing.payments || [];
    const targetPayment = currentPayments.find((p) => p.id === paymentId);
    const updatedPayments = currentPayments.filter((p) => p.id !== paymentId);

    const totalPaid = updatedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const existingRate = existing.pricePerDay !== undefined ? Number(existing.pricePerDay) : 0;
    const contractTotal = existing.totalAmount !== undefined ? Number(existing.totalAmount) : (existingRate * (existing.totalDays || 1));
    const newRemaining = Math.max(0, contractTotal - totalPaid);
    const newPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      contractTotal === 0 || newRemaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    const updated = updateContract(contractId, {
      payments: updatedPayments,
      paidAmount: totalPaid,
      remainingAmount: newRemaining,
      paymentStatus: newPaymentStatus,
    });

    logAction(
      'Suppression paiement',
      'contract',
      existing.contractNumber,
      `Paiement de ${targetPayment?.amount || 0} MAD supprimé par ${actorName}. Reste recalculé : ${newRemaining} MAD.`
    );

    return updated;
  };

  const updateContractFinancials = (
    contractId: string,
    financials: {
      pricePerDay?: number;
      totalAmount?: number;
      totalDays?: number;
      depositAmount?: number;
    },
    actorName: string = 'Direction'
  ): Contract | undefined => {
    const existing = contracts.find((c) => c.id === contractId);
    if (!existing) return undefined;

    const currentPayments = existing.payments || [];
    const totalPaid = currentPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const pricePerDay = financials.pricePerDay !== undefined
      ? Number(financials.pricePerDay)
      : (existing.pricePerDay !== undefined ? Number(existing.pricePerDay) : 0);
    const totalDays = financials.totalDays !== undefined
      ? Number(financials.totalDays)
      : (existing.totalDays || 1);

    const newTotalAmount =
      financials.totalAmount !== undefined
        ? Math.max(0, Number(financials.totalAmount) || 0)
        : financials.pricePerDay !== undefined
        ? pricePerDay * totalDays
        : (existing.totalAmount !== undefined ? Number(existing.totalAmount) : (pricePerDay * totalDays));

    const newRemaining = Math.max(0, newTotalAmount - totalPaid);
    const newPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      newTotalAmount === 0 || newRemaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    const newDepositAmount = financials.depositAmount !== undefined
      ? Number(financials.depositAmount)
      : existing.depositAmount;

    const updated = updateContract(contractId, {
      ...financials,
      depositAmount: newDepositAmount,
      pricePerDay,
      totalDays,
      totalAmount: newTotalAmount,
      paidAmount: totalPaid,
      remainingAmount: newRemaining,
      paymentStatus: newPaymentStatus,
    });

    logAction(
      'Modification tarification contrat',
      'contract',
      existing.contractNumber,
      `Tarification mise à jour par ${actorName}. Total : ${newTotalAmount} MAD, Reste à payer : ${newRemaining} MAD.`
    );

    return updated;
  };

  const settleContractBalance = (
    contractId: string,
    actorName: string = 'Ahmed Benali',
    method: PaymentMethod = 'tpe_card',
    notes: string = 'Règlement solde contrat'
  ): Contract | undefined => {
    const existing = contracts.find((c) => c.id === contractId);
    if (!existing) return undefined;

    const norm = normalizeContractFinancials(existing);
    const remaining = norm.remainingAmount ?? 0;
    if (remaining <= 0) return norm;

    return addPaymentToContract(
      contractId,
      {
        amount: remaining,
        method,
        notes,
        recordedBy: actorName,
      },
      actorName
    );
  };

  const refreshActiveContracts = () => {
    setContracts((prev) => {
      const updated = prev.map((c) => {
        if (
          c.id === 'cnt-1789166132353' &&
          (!c.payments || c.payments.length <= 1 || (c.remainingAmount && c.remainingAmount > 0))
        ) {
          const init = initialContracts.find((i) => i.id === c.id);
          if (init) return normalizeContractFinancials(init);
        }
        return normalizeContractFinancials(c);
      });
      saveRemoteAgencyData({ contracts: updated }).catch((err) =>
        console.warn('[Contracts] Remote sync warning:', err)
      );
      return updated;
    });
    logAction(
      'Mise à jour des contrats',
      'contract',
      'all',
      'Actualisation de l’ensemble des contrats en cours et recalcul des soldes'
    );
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
    const normalized = normalizeContractFinancials(contract);
    setPdfModalContract(normalized);
    setIsPdfModalOpen(true);
    logAction(
      'Visualisation PDF A4',
      'contract',
      normalized.contractNumber,
      `Consultation de la maquette A4 2 pages du contrat ${normalized.contractNumber}`
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

  const repairDuplicateContracts = (
    deposits: DepositRecord[],
    companySettings: CompanySettings,
    onUpdateDeposits: (deps: DepositRecord[]) => void,
    onUpdateCompanySettings: (settings: CompanySettings) => void
  ): { renumberedCount: number } => {
    const result = repairAndDeduplicateContracts(contracts, deposits, companySettings);
    if (result.renumberedCount > 0) {
      setContracts(result.repairedContracts);
      onUpdateDeposits(result.repairedDeposits);
      onUpdateCompanySettings(result.updatedCompanySettings);
      saveRemoteAgencyData({
        contracts: result.repairedContracts,
        deposits: result.repairedDeposits,
        companySettings: result.updatedCompanySettings,
      }).catch((err) => console.warn('Auto-save repaired contracts note:', err));
      logAction(
        'Réparation numérotation contrats',
        'contract',
        'system',
        `${result.renumberedCount} contrat(s) en doublon ont été réattribués avec des numéros uniques et consécutifs.`
      );
    }
    return { renumberedCount: result.renumberedCount };
  };

  const setContractsList = (newContracts: Contract[]) => {
    const filtered = newContracts.filter(
      (c) => !['cnt-1', 'cnt-2', 'cnt-3', 'cnt-4', 'cnt-48', 'cnt-49'].includes(c.id)
    );
    const normalized = (filtered.length > 0 ? filtered : initialContracts).map(normalizeContractFinancials);
    setContracts(sortContractsByNumber(normalized, 'desc'));
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
        repairDuplicateContracts,
        updateContract,
        addPaymentToContract,
        updateContractPayment,
        deleteContractPayment,
        updateContractFinancials,
        settleContractBalance,
        refreshActiveContracts,
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
