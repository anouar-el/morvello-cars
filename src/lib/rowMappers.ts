import type { Vehicle, Client, Driver, Contract, DepositRecord } from '../types';

// Convertisseurs ligne SQL -> entité applicative.
// Module pur (aucune dépendance navigateur) : utilisé par le client (synchro, temps réel) ET par le serveur
// (assistant IA), pour qu'une même ligne soit toujours lue de la même façon.

const asData = (row: any) => (row?.data && typeof row.data === 'object' ? row.data : {});

export function mapVehicleRow(row: any): Vehicle {
  const d = asData(row);
  return {
    ...d,
    id: row.id,
    brand: row.brand || d.brand || '',
    model: row.model || d.model || '',
    plate: row.plate || d.plate || '',
    fuelType: row.fuel_type || d.fuelType || 'Essence',
    status: row.status || d.status || 'available',
    currentKm: Number(row.current_km ?? d.currentKm ?? 0),
    dailyRate: Number(row.daily_rate ?? d.dailyRate ?? 0),
    assignedManagerId: row.assigned_manager_id || d.assignedManagerId,
    createdBy: row.created_by || d.createdBy,
    approvalStatus: row.approval_status || d.approvalStatus || 'approved',
    updatedAt: row.updated_at || d.updatedAt,
  };
}

export function mapClientRow(row: any): Client {
  const d = asData(row);
  return {
    ...d,
    id: row.id,
    firstName: row.first_name || d.firstName || '',
    lastName: row.last_name || d.lastName || '',
    docType: row.doc_type || d.docType || 'CIN',
    docNumber: row.doc_number || d.docNumber || '',
    phone: row.phone || d.phone || '',
    email: row.email || d.email || '',
    contractCount: Number(row.contract_count ?? d.contractCount ?? 0),
    assignedManagerId: row.assigned_manager_id || d.assignedManagerId,
    createdBy: row.created_by || d.createdBy,
    updatedAt: row.updated_at || d.updatedAt,
  };
}

export function mapDriverRow(row: any): Driver {
  const d = asData(row);
  return {
    ...d,
    id: row.id,
    name: row.name || d.name || '',
    licenseNumber: row.driving_license || d.licenseNumber || '',
    phone: row.phone || d.phone || '',
    email: row.email || d.email || '',
    assignedManagerId: row.assigned_manager_id || d.assignedManagerId,
    createdBy: row.created_by || d.createdBy,
  };
}

export function mapContractRow(row: any): Contract {
  const d = asData(row);
  return {
    ...d,
    id: row.id,
    contractNumber: row.contract_number || d.contractNumber || '',
    status: row.status || d.status || 'draft',
    // La colonne fait foi : elle passe à NULL quand le client est supprimé (ON DELETE SET NULL). Retomber
    // sur le JSON ferait réapparaître le client supprimé via la copie figée dans le contrat.
    clientId: ('client_id' in row ? row.client_id : d.clientId) || '',
    vehicleId: row.vehicle_id || d.vehicleId || '',
    startDate: row.start_date || d.startDate || '',
    endDate: row.end_date || d.endDate || '',
    totalAmount: Number(row.total_amount ?? d.totalAmount ?? 0),
    depositAmount: Number(row.deposit_amount ?? d.depositAmount ?? 0),
    assignedManagerId: row.assigned_manager_id || d.assignedManagerId,
    assignedManagerName: row.assigned_manager_name || d.assignedManagerName,
    managerDisplayName: row.manager_display_name || d.managerDisplayName,
    managerPhone: row.manager_phone || d.managerPhone,
    createdBy: row.created_by || d.createdBy,
    updatedAt: row.updated_at || d.updatedAt,
  };
}

export function mapDepositRow(row: any): DepositRecord {
  const d = asData(row);
  return {
    ...d,
    id: row.id,
    contractId: row.contract_id || d.contractId || '',
    clientName: row.client_name || d.clientName || '',
    amount: Number(row.amount ?? d.amount ?? 0),
    status: row.status || d.status || 'pending',
    assignedManagerId: row.assigned_manager_id || d.assignedManagerId,
    createdBy: row.created_by || d.createdBy,
    updatedAt: row.updated_at || d.updatedAt,
  };
}
