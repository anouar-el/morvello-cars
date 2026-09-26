import React, { createContext, useContext, useState, useEffect } from 'react';
import { Vehicle, User, VehicleExpense } from '../types';
import { initialVehicles, initialUsers } from '../data/mockData';
import { formatPlateFrench } from '../utils/plateUtils';
import { isVehicleOwnedByManager } from '../utils/managerScopeUtils';
import { resolveCanonicalUserId } from '../utils/identityMapping';
import {
  syncCreateVehicle,
  syncUpdateVehicle,
  syncDeleteVehicle,
  syncCreateVehicleExpense,
  syncDeleteVehicleExpense,
} from '../lib/recordSync';

export interface VehiclesContextType {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  addVehicle: (vehicleData: Omit<Vehicle, 'id'>, currentUser?: User | null) => Vehicle;
  updateVehicle: (id: string, data: Partial<Vehicle>) => void;
  approveVehicle: (vehicleId: string, assignedManagerId?: string, actorName?: string) => void;
  rejectVehicle: (vehicleId: string, reason?: string) => void;
  assignVehicleManager: (vehicleId: string, managerId: string, managerName: string, actorName?: string) => void;
  deleteVehicle: (vehicleId: string, currentUser?: User | null, activeContractCheck?: (vehicleId: string) => boolean) => { success: boolean; error?: string };
  releaseVehicle: (vehicleId: string, returnKm?: number) => void;
  addVehicleExpense: (
    vehicleId: string,
    expenseData: Omit<VehicleExpense, 'id' | 'createdAt' | 'vehicleId'>,
    currentUser?: User | null
  ) => VehicleExpense;
  deleteVehicleExpense: (
    vehicleId: string,
    expenseId: string,
    currentUser?: User | null
  ) => void;
  setVehiclesList: (vehicles: Vehicle[]) => void;
  setVehiclesListByUpdater: (updater: (prev: Vehicle[]) => Vehicle[]) => void;
}

const STORAGE_KEY = 'morvello_vehicles_v1';

const VehiclesContext = createContext<VehiclesContextType | undefined>(undefined);

export const VehiclesProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialVehicles;
  });

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  }, [vehicles]);

  const logAction = (action: string, targetType: any, targetId: string, details: string) => {
    if (onAuditLog) {
      onAuditLog(action, targetType, targetId, details);
    }
  };

  const addVehicle = (vehicleData: Omit<Vehicle, 'id'>, currentUser?: User | null): Vehicle => {
    const isGerant = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';
    const needsGerantApproval = !isGerant;

    const assignedUser = initialUsers.find((u) => u.id === vehicleData.assignedManagerId);

    const canonicalUserId = currentUser?.supabaseUid || (currentUser?.id && !currentUser.id.startsWith('usr-') ? currentUser.id : undefined) || currentUser?.id;
    let resolvedManagerId = isManager && canonicalUserId ? canonicalUserId : vehicleData.assignedManagerId;
    if (resolvedManagerId) {
      const matched = initialUsers.find((u) => u.id === resolvedManagerId || u.legacyId === resolvedManagerId);
      if (matched?.supabaseUid) {
        resolvedManagerId = matched.supabaseUid;
      } else if (matched?.id && !matched.id.startsWith('usr-')) {
        resolvedManagerId = matched.id;
      }
    }

    const newVehicle: Vehicle = {
      ...vehicleData,
      id: `veh-${Date.now()}`,
      plate: formatPlateFrench(vehicleData.plate),
      approvalStatus: needsGerantApproval ? 'pending_approval' : (vehicleData.approvalStatus || 'approved'),
      proposedBy: needsGerantApproval ? (currentUser?.name || 'Agent') : (vehicleData.proposedBy || currentUser?.name || 'Gérant'),
      proposedAt: needsGerantApproval ? new Date().toISOString() : (vehicleData.proposedAt || new Date().toISOString()),
      assignedManagerId: resolvedManagerId,
      assignedManagerName: isManager && currentUser ? currentUser.name : (assignedUser?.name || vehicleData.assignedManagerName),
    };

    const updatedVehicles = [newVehicle, ...vehicles];
    setVehicles(updatedVehicles);
    syncCreateVehicle(newVehicle, currentUser).catch((err) =>
      console.warn('Record-level sync addVehicle note:', err)
    );

    logAction(
      needsGerantApproval ? 'Proposition nouveau véhicule' : 'Ajout direct véhicule',
      'vehicle',
      newVehicle.id,
      needsGerantApproval
        ? `Véhicule proposé par ${currentUser?.name || 'Collaborateur'} - En attente d'approbation : ${newVehicle.brand} ${newVehicle.model} (${newVehicle.plate})`
        : `Ajout direct au parc par le Gérant (${currentUser?.name || 'Direction'}) : ${newVehicle.brand} ${newVehicle.model} (${newVehicle.plate})`
    );

    return newVehicle;
  };

  const updateVehicle = (id: string, data: Partial<Vehicle>) => {
    const existing = vehicles.find((v) => v.id === id);
    const updatedVehicles = vehicles.map((v) => {
      if (v.id === id) {
        const updated = { ...v, ...data };
        if (data.plate) updated.plate = formatPlateFrench(data.plate);
        return updated;
      }
      return v;
    });
    setVehicles(updatedVehicles);
    const patch = { ...data };
    if (data.plate) patch.plate = formatPlateFrench(data.plate);
    syncUpdateVehicle(id, patch, (existing as any)?.updatedAt || (existing as any)?.updated_at).catch((err) =>
      console.warn('Record-level sync updateVehicle note:', err)
    );
    logAction('Mise à jour véhicule', 'vehicle', id, `Modification données véhicule #${id}`);
  };

  const approveVehicle = (vehicleId: string, assignedManagerId?: string, actorName: string = 'Gérant') => {
    let resolvedId = assignedManagerId;
    let managerName: string | undefined = undefined;

    const updatedVehicles = vehicles.map((v) => {
      if (v.id === vehicleId) {
        const targetManager = assignedManagerId
          ? initialUsers.find((u) => u.id === assignedManagerId || u.legacyId === assignedManagerId)
          : initialUsers.find((u) => u.id === v.assignedManagerId || u.legacyId === v.assignedManagerId);
        resolvedId = targetManager?.supabaseUid || (targetManager?.id && !targetManager.id.startsWith('usr-') ? targetManager.id : undefined) || assignedManagerId || v.assignedManagerId;
        managerName = targetManager ? targetManager.name : v.assignedManagerName;
        return {
          ...v,
          approvalStatus: 'approved' as const,
          assignedManagerId: resolvedId,
          assignedManagerName: managerName,
        };
      }
      return v;
    });
    setVehicles(updatedVehicles);
    syncUpdateVehicle(vehicleId, {
      approvalStatus: 'approved',
      assignedManagerId: resolvedId,
      assignedManagerName: managerName,
    }).catch((err) =>
      console.warn('Record-level sync approveVehicle note:', err)
    );
    logAction(
      'Approbation véhicule',
      'vehicle',
      vehicleId,
      `Véhicule #${vehicleId} approuvé et intégré au parc par ${actorName}`
    );
  };

  const rejectVehicle = (vehicleId: string, reason?: string) => {
    let newNotes: string | undefined = undefined;
    const updatedVehicles = vehicles.map((v) => {
      if (v.id === vehicleId) {
        newNotes = reason ? `${v.notes || ''} [Refus Gérant: ${reason}]` : v.notes;
        return {
          ...v,
          approvalStatus: 'rejected' as const,
          notes: newNotes,
        };
      }
      return v;
    });
    setVehicles(updatedVehicles);
    syncUpdateVehicle(vehicleId, {
      approvalStatus: 'rejected',
      notes: newNotes,
    }).catch((err) =>
      console.warn('Record-level sync rejectVehicle note:', err)
    );
    logAction(
      'Refus ajout véhicule',
      'vehicle',
      vehicleId,
      `Proposition de véhicule refusée par le Gérant (${reason || 'Non justifié'})`
    );
  };

  const assignVehicleManager = (
    vehicleId: string,
    managerId: string,
    managerName: string,
    actorName: string = 'Gérant'
  ) => {
    const matched = initialUsers.find((u) => u.id === managerId || u.legacyId === managerId);
    const resolvedId = matched?.supabaseUid || (matched?.id && !matched.id.startsWith('usr-') ? matched.id : managerId);
    const updatedVehicles = vehicles.map((v) =>
      v.id === vehicleId
        ? {
            ...v,
            assignedManagerId: resolvedId,
            assignedManagerName: managerName,
          }
        : v
    );
    setVehicles(updatedVehicles);
    syncUpdateVehicle(vehicleId, {
      assignedManagerId: resolvedId,
      assignedManagerName: managerName,
    }).catch((err) =>
      console.warn('Record-level sync assignVehicleManager note:', err)
    );
    logAction(
      'Affectation responsable',
      'vehicle',
      vehicleId,
      `Véhicule affecté à ${managerName} par ${actorName}`
    );
  };

  const deleteVehicle = (
    vehicleId: string,
    currentUser?: User | null,
    activeContractCheck?: (vehicleId: string) => boolean
  ): { success: boolean; error?: string } => {
    const veh = vehicles.find((v) => v.id === vehicleId);
    if (!veh) {
      return { success: false, error: 'Véhicule introuvable.' };
    }

    const isGerant = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    if (!isGerant && !isManager) {
      return {
        success: false,
        error: 'Permission refusée : seuls le Gérant et les Managers peuvent supprimer un véhicule.',
      };
    }

    if (!isGerant) {
      const currentUserId = currentUser?.supabaseUid || (currentUser?.id && !currentUser.id.startsWith('usr-') ? currentUser.id : undefined) || currentUser?.id;
      const isOwned = isVehicleOwnedByManager(
        veh,
        currentUserId || '',
        currentUser?.name,
        currentUser?.supabaseUid || currentUser?.id
      );
      if (!isOwned) {
        return {
          success: false,
          error: 'Permission refusée : vous ne pouvez supprimer que les véhicules sous votre responsabilité.',
        };
      }
    }

    if (activeContractCheck && activeContractCheck(vehicleId)) {
      return {
        success: false,
        error: `Impossible de supprimer ce véhicule car il est actuellement engagé dans un contrat en cours. Clôturez ou annulez d'abord le contrat.`,
      };
    }

    const updatedVehicles = vehicles.filter((v) => v.id !== vehicleId);
    setVehicles(updatedVehicles);
    syncDeleteVehicle(vehicleId, currentUser).catch((err) =>
      console.warn('Record-level sync deleteVehicle note:', err)
    );

    logAction(
      'Suppression véhicule',
      'vehicle',
      vehicleId,
      `Véhicule supprimé du parc par ${currentUser?.name || 'Direction'} : ${veh.brand} ${veh.model} [${veh.plate}]`
    );

    return { success: true };
  };

  const addVehicleExpense = (
    vehicleId: string,
    expenseData: Omit<VehicleExpense, 'id' | 'createdAt' | 'vehicleId'>,
    currentUser?: User | null
  ): VehicleExpense => {
    const newExpense: VehicleExpense = {
      ...expenseData,
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      vehicleId,
      createdAt: new Date().toISOString(),
      recordedBy: currentUser?.name || 'Collaborateur',
    };

    const targetVehicle = vehicles.find((v) => v.id === vehicleId);
    const existingExpenses = targetVehicle?.maintenanceExpenses || [];
    const updatedExpenses = [newExpense, ...existingExpenses];

    const updatedVehicles = vehicles.map((v) => {
      if (v.id === vehicleId) {
        const updated: Vehicle = {
          ...v,
          maintenanceExpenses: updatedExpenses,
        };
        // Si l'intervention met à jour la prochaine vidange
        if (expenseData.nextOilChangeTargetKm && expenseData.nextOilChangeTargetKm > 0) {
          updated.nextOilChangeKm = expenseData.nextOilChangeTargetKm;
        }
        // Si le kilométrage constaté lors de l'entretien est supérieur au compteur actuel, mettre à jour
        if (expenseData.kmAtExpense && expenseData.kmAtExpense > v.currentKm) {
          updated.currentKm = expenseData.kmAtExpense;
        }
        // Date dernière révision
        if (expenseData.date) {
          updated.lastInspectionDate = expenseData.date;
        }
        return updated;
      }
      return v;
    });

    setVehicles(updatedVehicles);
    syncCreateVehicleExpense(vehicleId, newExpense, currentUser).catch((err) =>
      console.warn('Record-level sync addVehicleExpense note:', err)
    );
    syncUpdateVehicle(vehicleId, {
      maintenanceExpenses: updatedExpenses,
      ...(expenseData.nextOilChangeTargetKm && expenseData.nextOilChangeTargetKm > 0 ? { nextOilChangeKm: expenseData.nextOilChangeTargetKm } : {}),
      ...(expenseData.kmAtExpense && targetVehicle && expenseData.kmAtExpense > targetVehicle.currentKm ? { currentKm: expenseData.kmAtExpense } : {}),
      ...(expenseData.date ? { lastInspectionDate: expenseData.date } : {}),
    }, undefined, currentUser).catch(() => {});

    logAction(
      'Enregistrement dépense entretien',
      'maintenance_expense' as any,
      vehicleId,
      `Dépense de ${expenseData.costMAD} MAD enregistrée pour ${targetVehicle?.brand} ${targetVehicle?.model} [${targetVehicle?.plate}] (${expenseData.title}) par ${currentUser?.name || 'Collaborateur'}`
    );

    return newExpense;
  };

  const deleteVehicleExpense = (
    vehicleId: string,
    expenseId: string,
    currentUser?: User | null
  ) => {
    const targetVehicle = vehicles.find((v) => v.id === vehicleId);
    const targetExpense = targetVehicle?.maintenanceExpenses?.find((e) => e.id === expenseId);

    const updatedVehicles = vehicles.map((v) => {
      if (v.id === vehicleId) {
        return {
          ...v,
          maintenanceExpenses: (v.maintenanceExpenses || []).filter((e) => e.id !== expenseId),
        };
      }
      return v;
    });

    setVehicles(updatedVehicles);
    syncDeleteVehicleExpense(vehicleId, expenseId, currentUser).catch((err) =>
      console.warn('Record-level sync deleteVehicleExpense note:', err)
    );

    logAction(
      'Suppression dépense entretien',
      'maintenance_expense' as any,
      vehicleId,
      `Dépense "${targetExpense?.title || expenseId}" (${targetExpense?.costMAD || 0} MAD) supprimée par ${currentUser?.name || 'Collaborateur'}`
    );
  };

  const releaseVehicle = (vehicleId: string, returnKm?: number) => {
    setVehicles((prev) => {
      const updated = prev.map((v) => {
        if (v.id === vehicleId) {
          return {
            ...v,
            status: 'available' as const,
            currentKm: returnKm !== undefined ? returnKm : v.currentKm,
          };
        }
        return v;
      });
      return updated;
    });
    syncUpdateVehicle(vehicleId, {
      status: 'available',
      ...(returnKm !== undefined ? { currentKm: returnKm } : {}),
    }).catch(() => {});
  };

  const setVehiclesList = (newVehicles: Vehicle[]) => {
    setVehicles(newVehicles);
  };

  const setVehiclesListByUpdater = (updater: (prev: Vehicle[]) => Vehicle[]) => {
    setVehicles((prev) => updater(prev));
  };

  return (
    <VehiclesContext.Provider
      value={{
        vehicles,
        selectedVehicle,
        setSelectedVehicle,
        addVehicle,
        updateVehicle,
        approveVehicle,
        rejectVehicle,
        assignVehicleManager,
        deleteVehicle,
        releaseVehicle,
        addVehicleExpense,
        deleteVehicleExpense,
        setVehiclesList,
        setVehiclesListByUpdater,
      }}
    >
      {children}
    </VehiclesContext.Provider>
  );
};

export const useVehicles = () => {
  const context = useContext(VehiclesContext);
  if (!context) {
    throw new Error('useVehicles must be used within a VehiclesProvider');
  }
  return context;
};
