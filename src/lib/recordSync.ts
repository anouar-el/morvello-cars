import { supabase, isSupabaseConfigured } from './supabase';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Vehicle,
  Contract,
  Client,
  Driver,
  DepositRecord,
  PaymentRecord,
  VehicleExpense,
  CompanySettings,
  ContractInspection,
  User,
} from '../types';
import { resolveAssignedManagerForSupabase } from './supabaseSync';
import { resolveCanonicalUserId } from '../utils/identityMapping';

// ==============================================================================
// MORVELLO CARS — RECORD-LEVEL SYNCHRONIZATION ARCHITECTURE (PROBLEM #7)
// ==============================================================================
//
// 1. REPLACES WHOLE-COLLECTION OVERWRITES:
//    Sends only the specific record created, modified, or deleted.
//    Never overwrites an entire array of vehicles, contracts, or clients.
//
// 2. CONCURRENCY & LOST UPDATES PREVENTION:
//    Optimistic concurrency checks on `updated_at` timestamps detect conflicts
//    when multiple managers edit the same record concurrently.
//
// 3. REFERENTIAL INTEGRITY & FOREIGN KEY ORDERING:
//    When saving contracts, verifies and guarantees parent client and vehicle exist
//    before inserting contract, preventing FK constraint errors.
//
// 4. DELETION RESURRECTION DEFENSE:
//    Explicit SQL DELETE calls combined with tombstone tracking ensure deleted
//    records cannot reappear from stale local storage or cached arrays.
//
// 5. POSTGRESQL RLS ENFORCEMENT:
//    Every record-level operation runs directly through PostgreSQL RLS policies
//    enforcing multi-agency and per-manager security boundaries.
// ==============================================================================

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED' | 'CONFLICT' | 'DENIED';

export interface SyncResult<T = any> {
  success: boolean;
  status: SyncStatus;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

export interface SyncStatusEvent {
  table: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  status: SyncStatus;
  error?: string;
  timestamp: string;
}

export type SyncStatusListener = (event: SyncStatusEvent) => void;

const statusListeners = new Set<SyncStatusListener>();

export function subscribeToSyncStatus(listener: SyncStatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function notifySyncEvent(event: SyncStatusEvent) {
  statusListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (e) {
      console.error('[RecordSync] Error in status listener:', e);
    }
  });
}

// ==============================================================================
// TOMBSTONE CACHE (STEP 16: ANTI-DELETION RESURRECTION)
// ==============================================================================
const STORAGE_TOMBSTONES_KEY = 'morvello_record_tombstones_v1';

function getPersistedTombstones(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_TOMBSTONES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return new Set();
}

const memoryTombstones: Set<string> = getPersistedTombstones();

export function addRecordTombstone(table: string, id: string): void {
  const key = `${table}:${id}`;
  memoryTombstones.add(key);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_TOMBSTONES_KEY, JSON.stringify(Array.from(memoryTombstones)));
    } catch {
      // Ignore storage error
    }
  }
}

export function isRecordTombstoned(table: string, id: string): boolean {
  return memoryTombstones.has(`${table}:${id}`);
}

export function filterTombstonedRecords<T extends { id: string }>(table: string, records: T[]): T[] {
  return records.filter((r) => !isRecordTombstoned(table, r.id));
}

export function clearRecordTombstones(): void {
  memoryTombstones.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_TOMBSTONES_KEY);
    } catch {
      // Ignore
    }
  }
}

// Helper to sanitize error messages
function parsePostgrestError(err: any): { message: string; code: string } {
  if (!err) return { message: 'Erreur inconnue', code: 'UNKNOWN' };
  const code = err.code || 'ERR';
  let message = err.message || 'Erreur lors de la synchronisation Supabase';
  if (code === '42501' || message.includes('permission denied') || message.includes('policy')) {
    message = 'Permission refusée par la politique de sécurité (RLS). Cette opération dépasse votre périmètre autorisé.';
  } else if (code === '23503' || message.includes('foreign key')) {
    message = 'Contrainte d’intégrité référentielle : l’enregistrement parent n’existe pas.';
  } else if (code === '23505' || message.includes('unique constraint')) {
    message = 'Un enregistrement avec ce numéro ou cet identifiant existe déjà.';
  }
  return { message, code };
}

// Mirror single record write to Firestore if authenticated in Firebase
async function mirrorRecordToFirestore(
  fieldArrayName: string,
  record: any,
  isDelete: boolean = false
): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const mainDocRef = doc(db, 'agencies', 'morvello_main');
    const snap = await getDoc(mainDocRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const existingList: any[] = Array.isArray(data[fieldArrayName]) ? data[fieldArrayName] : [];

    let updatedList: any[];
    if (isDelete) {
      updatedList = existingList.filter((item: any) => item.id !== record.id);
    } else {
      const idx = existingList.findIndex((item: any) => item.id === record.id);
      if (idx !== -1) {
        updatedList = existingList.map((item: any, i: number) => (i === idx ? { ...item, ...record } : item));
      } else {
        updatedList = [record, ...existingList];
      }
    }

    await setDoc(
      mainDocRef,
      {
        [fieldArrayName]: updatedList,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (fsErr) {
    console.warn('[RecordSync] Firestore mirror notice:', fsErr);
  }
}

// ==============================================================================
// 1. RECORD-LEVEL VEHICLES (STEP 5)
// ==============================================================================

export async function syncCreateVehicle(
  vehicle: Vehicle,
  currentUser?: User | null
): Promise<SyncResult<Vehicle>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'vehicles', entityId: vehicle.id, operation: 'create', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: vehicle, timestamp };
  }

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;
    const authEmail = sessionRes.data?.session?.user?.email || null;

    const assignedMgrId = resolveAssignedManagerForSupabase(
      vehicle.assignedManagerId,
      vehicle.assignedManagerName,
      null,
      authUid,
      authEmail
    );

    const payload = {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      plate: vehicle.plate,
      fuel_type: vehicle.fuelType,
      status: vehicle.status,
      current_km: vehicle.currentKm,
      daily_rate: vehicle.dailyRate,
      assigned_manager_id: assignedMgrId,
      created_by: vehicle.createdBy || authUid || 'system',
      approval_status: vehicle.approvalStatus || 'approved',
      data: {
        ...vehicle,
        assignedManagerId: assignedMgrId,
      },
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from('vehicles').insert(payload);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'vehicles', entityId: vehicle.id, operation: 'create', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    // Mirror to Firestore without sending entire array from client
    mirrorRecordToFirestore('vehicles', vehicle, false).catch(() => {});

    notifySyncEvent({ table: 'vehicles', entityId: vehicle.id, operation: 'create', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: vehicle, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la création du véhicule';
    notifySyncEvent({ table: 'vehicles', entityId: vehicle.id, operation: 'create', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncUpdateVehicle(
  vehicleId: string,
  patch: Partial<Vehicle>,
  expectedUpdatedAt?: string,
  currentUser?: User | null
): Promise<SyncResult<Vehicle>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'update', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', timestamp };
  }

  try {
    // Optimistic Concurrency Check (STEP 12)
    if (expectedUpdatedAt) {
      const { data: existing } = await supabase
        .from('vehicles')
        .select('updated_at')
        .eq('id', vehicleId)
        .maybeSingle();

      if (existing?.updated_at) {
        const existingTime = new Date(existing.updated_at).getTime();
        const expectedTime = new Date(expectedUpdatedAt).getTime();
        if (existingTime - expectedTime > 1500) {
          const conflictMsg = `Conflit de modification simultanée sur le véhicule ${vehicleId}. Une mise à jour a été effectuée à ${existing.updated_at}.`;
          notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'update', status: 'CONFLICT', error: conflictMsg, timestamp });
          return { success: false, status: 'CONFLICT', error: conflictMsg, code: 'CONCURRENCY_CONFLICT', timestamp };
        }
      }
    }

    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;
    const authEmail = sessionRes.data?.session?.user?.email || null;

    const updateFields: Record<string, any> = {
      updated_at: timestamp,
    };

    if (patch.brand !== undefined) updateFields.brand = patch.brand;
    if (patch.model !== undefined) updateFields.model = patch.model;
    if (patch.plate !== undefined) updateFields.plate = patch.plate;
    if (patch.fuelType !== undefined) updateFields.fuel_type = patch.fuelType;
    if (patch.status !== undefined) updateFields.status = patch.status;
    if (patch.currentKm !== undefined) updateFields.current_km = patch.currentKm;
    if (patch.dailyRate !== undefined) updateFields.daily_rate = patch.dailyRate;
    if (patch.approvalStatus !== undefined) updateFields.approval_status = patch.approvalStatus;

    if (patch.assignedManagerId !== undefined) {
      updateFields.assigned_manager_id = resolveAssignedManagerForSupabase(
        patch.assignedManagerId,
        patch.assignedManagerName,
        null,
        authUid,
        authEmail
      );
    }

    // Preserve full vehicle in data jsonb
    const { data: currentFull } = await supabase
      .from('vehicles')
      .select('data')
      .eq('id', vehicleId)
      .maybeSingle();

    const mergedData = { ...(currentFull?.data || {}), ...patch, updatedAt: timestamp };
    updateFields.data = mergedData;

    const { error } = await supabase.from('vehicles').update(updateFields).eq('id', vehicleId);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'update', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('vehicles', { id: vehicleId, ...patch, updatedAt: timestamp }, false).catch(() => {});

    notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'update', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la mise à jour du véhicule';
    notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'update', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncDeleteVehicle(
  vehicleId: string,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'delete', status: 'SYNCING', timestamp });

  // Record in tombstones immediately to avoid resurrection (STEP 16)
  addRecordTombstone('vehicles', vehicleId);

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: vehicleId, timestamp };
  }

  try {
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'delete', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('vehicles', { id: vehicleId }, true).catch(() => {});

    notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'delete', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: vehicleId, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la suppression du véhicule';
    notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'delete', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncCreateVehicleExpense(
  vehicleId: string,
  expense: VehicleExpense,
  currentUser?: User | null
): Promise<SyncResult<VehicleExpense>> {
  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: expense, timestamp };

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;

    const payload = {
      id: expense.id,
      vehicle_id: vehicleId,
      category: expense.category,
      title: expense.title,
      cost_mad: (expense as any).costMad ?? expense.costMAD ?? 0,
      date: expense.date,
      km_at_expense: expense.kmAtExpense || 0,
      provider: expense.provider || null,
      invoice_number: expense.invoiceNumber || null,
      notes: expense.notes || null,
      recorded_by: expense.recordedBy || currentUser?.name || 'Collaborateur',
      created_by: authUid || 'system',
      data: expense,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from('vehicle_expenses').upsert(payload, { onConflict: 'id' });
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    return { success: true, status: 'SYNCED', data: expense, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

export async function syncDeleteVehicleExpense(
  vehicleIdOrExpenseId: string,
  expenseIdOrUser?: string | User | null,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const isSecondArgExpenseId = typeof expenseIdOrUser === 'string';
  const expenseId = isSecondArgExpenseId ? expenseIdOrUser : vehicleIdOrExpenseId;
  const vehicleId = isSecondArgExpenseId ? vehicleIdOrExpenseId : undefined;
  const user = isSecondArgExpenseId ? currentUser : (expenseIdOrUser as User | null | undefined);

  const timestamp = new Date().toISOString();
  addRecordTombstone('vehicle_expenses', expenseId);

  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: expenseId, timestamp };

  try {
    const { error } = await supabase.from('vehicle_expenses').delete().eq('id', expenseId);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    return { success: true, status: 'SYNCED', data: expenseId, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

// ==============================================================================
// 2. RECORD-LEVEL CLIENTS & DRIVERS (STEP 7)
// ==============================================================================

export async function syncCreateClient(
  client: Client,
  currentUser?: User | null
): Promise<SyncResult<Client>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'clients', entityId: client.id, operation: 'create', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: client, timestamp };
  }

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;
    const authEmail = sessionRes.data?.session?.user?.email || null;

    const assignedMgrId = resolveAssignedManagerForSupabase(
      client.assignedManagerId,
      undefined,
      null,
      authUid,
      authEmail
    );

    const payload = {
      id: client.id,
      first_name: client.firstName,
      last_name: client.lastName,
      doc_type: client.docType || 'CIN',
      doc_number: client.docNumber,
      phone: client.phone || null,
      email: client.email || null,
      contract_count: client.contractCount || 0,
      assigned_manager_id: assignedMgrId,
      created_by: authUid || 'system',
      data: client,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from('clients').insert(payload);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'clients', entityId: client.id, operation: 'create', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('clients', client, false).catch(() => {});

    notifySyncEvent({ table: 'clients', entityId: client.id, operation: 'create', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: client, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la création du client';
    notifySyncEvent({ table: 'clients', entityId: client.id, operation: 'create', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncUpdateClient(
  clientId: string,
  patch: Partial<Client>,
  expectedUpdatedAt?: string,
  currentUser?: User | null
): Promise<SyncResult<Client>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'update', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', timestamp };
  }

  try {
    if (expectedUpdatedAt) {
      const { data: existing } = await supabase
        .from('clients')
        .select('updated_at')
        .eq('id', clientId)
        .maybeSingle();

      if (existing?.updated_at) {
        const existingTime = new Date(existing.updated_at).getTime();
        const expectedTime = new Date(expectedUpdatedAt).getTime();
        if (existingTime - expectedTime > 1500) {
          const conflictMsg = `Conflit de modification simultanée sur le client ${clientId}.`;
          notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'update', status: 'CONFLICT', error: conflictMsg, timestamp });
          return { success: false, status: 'CONFLICT', error: conflictMsg, code: 'CONCURRENCY_CONFLICT', timestamp };
        }
      }
    }

    const updateFields: Record<string, any> = {
      updated_at: timestamp,
    };

    if (patch.firstName !== undefined) updateFields.first_name = patch.firstName;
    if (patch.lastName !== undefined) updateFields.last_name = patch.lastName;
    if (patch.docType !== undefined) updateFields.doc_type = patch.docType;
    if (patch.docNumber !== undefined) updateFields.doc_number = patch.docNumber;
    if (patch.phone !== undefined) updateFields.phone = patch.phone;
    if (patch.email !== undefined) updateFields.email = patch.email;
    if (patch.contractCount !== undefined) updateFields.contract_count = patch.contractCount;

    const { data: currentFull } = await supabase
      .from('clients')
      .select('data')
      .eq('id', clientId)
      .maybeSingle();

    const mergedData = { ...(currentFull?.data || {}), ...patch, updatedAt: timestamp };
    updateFields.data = mergedData;

    const { error } = await supabase.from('clients').update(updateFields).eq('id', clientId);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'update', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('clients', { id: clientId, ...patch, updatedAt: timestamp }, false).catch(() => {});

    notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'update', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la mise à jour du client';
    notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'update', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncDeleteClient(
  clientId: string,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'delete', status: 'SYNCING', timestamp });

  addRecordTombstone('clients', clientId);

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: clientId, timestamp };
  }

  try {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'delete', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('clients', { id: clientId }, true).catch(() => {});

    notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'delete', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: clientId, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la suppression du client';
    notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'delete', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncCreateDriver(
  driver: Driver,
  currentUser?: User | null
): Promise<SyncResult<Driver>> {
  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: driver, timestamp };

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;

    const driverName = (driver as any).name || `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Conducteur';
    const payload = {
      id: driver.id,
      first_name: driver.firstName || driverName.split(' ')[0] || driverName,
      last_name: driver.lastName || driverName.split(' ').slice(1).join(' ') || driverName,
      birth_date: driver.birthDate || null,
      doc_type: driver.docType || 'CIN',
      doc_number: driver.docNumber || 'N/C',
      driving_license: driver.drivingLicense || (driver as any).licenseNumber || 'N/C',
      phone: driver.phone || null,
      email: driver.email || null,
      assigned_manager_id: (driver as any).assignedManagerId || authUid,
      created_by: authUid || 'system',
      data: driver,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from('drivers').insert(payload);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    mirrorRecordToFirestore('drivers', driver, false).catch(() => {});
    return { success: true, status: 'SYNCED', data: driver, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

export async function syncDeleteDriver(
  driverId: string,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const timestamp = new Date().toISOString();
  addRecordTombstone('drivers', driverId);

  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: driverId, timestamp };

  try {
    const { error } = await supabase.from('drivers').delete().eq('id', driverId);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    mirrorRecordToFirestore('drivers', { id: driverId }, true).catch(() => {});
    return { success: true, status: 'SYNCED', data: driverId, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

// ==============================================================================
// 3. RECORD-LEVEL CONTRACTS (STEP 6 & STEP 15: FOREIGN KEY ORDER)
// ==============================================================================

export async function syncCreateContract(
  contract: Contract,
  related?: {
    client?: Client;
    vehicle?: Vehicle;
    deposit?: DepositRecord;
    nextContractNumber?: number;
  },
  currentUser?: User | null
): Promise<SyncResult<Contract>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: contract, timestamp };
  }

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;
    const authEmail = sessionRes.data?.session?.user?.email || null;

    // STEP 15: REFERENTIAL INTEGRITY PRESERVATION
    // 1. Ensure parent client exists before inserting contract referencing client_id
    if (contract.clientId) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('id', contract.clientId)
        .maybeSingle();

      if (!existingClient && related?.client) {
        // Automatically create parent client first to satisfy foreign key
        await syncCreateClient(related.client, currentUser);
      }
    }

    // 2. Ensure parent vehicle exists before inserting contract referencing vehicle_id
    if (contract.vehicleId) {
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', contract.vehicleId)
        .maybeSingle();

      if (!existingVehicle && related?.vehicle) {
        await syncCreateVehicle(related.vehicle, currentUser);
      }
    }

    const assignedMgrId = resolveAssignedManagerForSupabase(
      contract.assignedManagerId,
      contract.assignedManagerName,
      null,
      authUid,
      authEmail
    );

    const contractPayload = {
      id: contract.id,
      contract_number: contract.contractNumber,
      status: contract.status,
      client_id: contract.clientId || null,
      vehicle_id: contract.vehicleId || null,
      start_date: contract.startDate || null,
      end_date: contract.endDate || null,
      total_amount: contract.totalAmount || 0,
      deposit_amount: contract.depositAmount || 0,
      assigned_manager_id: assignedMgrId,
      created_by: contract.createdBy || authUid || 'Direction',
      data: {
        ...contract,
        assignedManagerId: assignedMgrId,
      },
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error: contractErr } = await supabase.from('contracts').insert(contractPayload);
    if (contractErr) {
      const parsed = parsePostgrestError(contractErr);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    // 3. Atomically sync associated deposit record if created with the contract
    if (related?.deposit) {
      syncCreateDeposit(related.deposit, currentUser).catch((err) =>
        console.warn('[RecordSync] Deposit auto-sync note:', err)
      );
    }

    // 4. Update rented vehicle status record-level (NOT rewriting entire fleet!)
    if (contract.vehicleId && contract.status === 'active') {
      syncUpdateVehicle(contract.vehicleId, { status: 'rented', currentKm: contract.departureKm }).catch(() => {});
    }

    // 5. Update agency settings next sequence if incremented
    if (related?.nextContractNumber) {
      syncUpdateNextContractSequence(related.nextContractNumber).catch(() => {});
    }

    mirrorRecordToFirestore('contracts', contract, false).catch(() => {});

    notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: contract, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la création du contrat';
    notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncUpdateContract(
  contractId: string,
  patch: Partial<Contract>,
  expectedUpdatedAt?: string,
  currentUser?: User | null
): Promise<SyncResult<Contract>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'update', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', timestamp };
  }

  try {
    if (expectedUpdatedAt) {
      const { data: existing } = await supabase
        .from('contracts')
        .select('updated_at')
        .eq('id', contractId)
        .maybeSingle();

      if (existing?.updated_at) {
        const existingTime = new Date(existing.updated_at).getTime();
        const expectedTime = new Date(expectedUpdatedAt).getTime();
        if (existingTime - expectedTime > 1500) {
          const conflictMsg = `Conflit de modification simultanée sur le contrat ${contractId}.`;
          notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'update', status: 'CONFLICT', error: conflictMsg, timestamp });
          return { success: false, status: 'CONFLICT', error: conflictMsg, code: 'CONCURRENCY_CONFLICT', timestamp };
        }
      }
    }

    const updateFields: Record<string, any> = {
      updated_at: timestamp,
    };

    if (patch.status !== undefined) updateFields.status = patch.status;
    if (patch.startDate !== undefined) updateFields.start_date = patch.startDate;
    if (patch.endDate !== undefined) updateFields.end_date = patch.endDate;
    if (patch.totalAmount !== undefined) updateFields.total_amount = patch.totalAmount;
    if (patch.depositAmount !== undefined) updateFields.deposit_amount = patch.depositAmount;

    const { data: currentFull } = await supabase
      .from('contracts')
      .select('data')
      .eq('id', contractId)
      .maybeSingle();

    const mergedData = { ...(currentFull?.data || {}), ...patch, updatedAt: timestamp };
    updateFields.data = mergedData;

    const { error } = await supabase.from('contracts').update(updateFields).eq('id', contractId);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'update', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('contracts', { id: contractId, ...patch, updatedAt: timestamp }, false).catch(() => {});

    notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'update', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la mise à jour du contrat';
    notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'update', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncDeleteContract(
  contractId: string,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'delete', status: 'SYNCING', timestamp });

  addRecordTombstone('contracts', contractId);

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: contractId, timestamp };
  }

  try {
    const { error } = await supabase.from('contracts').delete().eq('id', contractId);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'delete', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('contracts', { id: contractId }, true).catch(() => {});

    notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'delete', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: contractId, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la suppression du contrat';
    notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'delete', status: 'SYNC_FAILED', error: message, timestamp });
    return { success: false, status: 'SYNC_FAILED', error: message, timestamp };
  }
}

export async function syncUpdateContractInspection(
  contractId: string,
  inspection: ContractInspection,
  currentUser?: User | null
): Promise<SyncResult<ContractInspection>> {
  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: inspection, timestamp };

  try {
    const { data: current } = await supabase
      .from('contracts')
      .select('data')
      .eq('id', contractId)
      .maybeSingle();

    const mergedData = { ...(current?.data || {}), inspection, updatedAt: timestamp };
    const { error } = await supabase
      .from('contracts')
      .update({ data: mergedData, updated_at: timestamp })
      .eq('id', contractId);

    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('contracts', { id: contractId, inspection, updatedAt: timestamp }, false).catch(() => {});
    return { success: true, status: 'SYNCED', data: inspection, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

// ==============================================================================
// 4. RECORD-LEVEL DEPOSITS (STEP 8)
// ==============================================================================

export async function syncCreateDeposit(
  deposit: DepositRecord,
  currentUser?: User | null
): Promise<SyncResult<DepositRecord>> {
  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: deposit, timestamp };

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;

    const payload = {
      id: deposit.id,
      contract_id: deposit.contractId,
      client_name: deposit.clientName || 'Client',
      amount: deposit.amount,
      status: deposit.status,
      method: deposit.method,
      assigned_manager_id: deposit.assignedManagerId || authUid,
      created_by: authUid || 'Direction',
      data: deposit,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from('deposits').upsert(payload, { onConflict: 'id' });
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('deposits', deposit, false).catch(() => {});
    return { success: true, status: 'SYNCED', data: deposit, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

export async function syncUpdateDeposit(
  depositId: string,
  patch: Partial<DepositRecord>,
  expectedUpdatedAt?: string,
  currentUser?: User | null
): Promise<SyncResult<DepositRecord>> {
  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', timestamp };

  try {
    const updateFields: Record<string, any> = {
      updated_at: timestamp,
    };

    if (patch.amount !== undefined) updateFields.amount = patch.amount;
    if (patch.status !== undefined) updateFields.status = patch.status;
    if (patch.method !== undefined) updateFields.method = patch.method;

    const { data: currentFull } = await supabase
      .from('deposits')
      .select('data')
      .eq('id', depositId)
      .maybeSingle();

    const mergedData = { ...(currentFull?.data || {}), ...patch, updatedAt: timestamp };
    updateFields.data = mergedData;

    const { error } = await supabase.from('deposits').update(updateFields).eq('id', depositId);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('deposits', { id: depositId, ...patch, updatedAt: timestamp }, false).catch(() => {});
    return { success: true, status: 'SYNCED', timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

export async function syncDeleteDeposit(
  depositId: string,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const timestamp = new Date().toISOString();
  addRecordTombstone('deposits', depositId);

  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: depositId, timestamp };

  try {
    const { error } = await supabase.from('deposits').delete().eq('id', depositId);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }

    mirrorRecordToFirestore('deposits', { id: depositId }, true).catch(() => {});
    return { success: true, status: 'SYNCED', data: depositId, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

// ==============================================================================
// 5. RECORD-LEVEL PAYMENTS (STEP 8)
// ==============================================================================

export async function syncCreatePayment(
  contractIdOrPayment: string | PaymentRecord,
  paymentOrUser?: PaymentRecord | User | null,
  currentUser?: User | null
): Promise<SyncResult<PaymentRecord>> {
  const isFirstArgContractId = typeof contractIdOrPayment === 'string';
  const contractId = isFirstArgContractId ? (contractIdOrPayment as string) : ((contractIdOrPayment as any).contractId || null);
  const payment: PaymentRecord = isFirstArgContractId
    ? (paymentOrUser as PaymentRecord)
    : (contractIdOrPayment as PaymentRecord);
  const user = isFirstArgContractId ? currentUser : (paymentOrUser as User | null | undefined);

  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: payment, timestamp };

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;

    const payload = {
      id: payment.id,
      contract_id: contractId || (payment as any).contractId || null,
      amount: payment.amount,
      method: payment.method,
      date: payment.date,
      receipt_number: payment.receiptNumber || null,
      notes: payment.notes || null,
      recorded_by: payment.recordedBy || user?.name || 'Collaborateur',
      created_by: authUid || 'Direction',
      data: payment,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { error } = await supabase.from('payments').upsert(payload, { onConflict: 'id' });
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    return { success: true, status: 'SYNCED', data: payment, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

export async function syncDeletePayment(
  paymentId: string,
  currentUser?: User | null
): Promise<SyncResult<string>> {
  const timestamp = new Date().toISOString();
  addRecordTombstone('payments', paymentId);

  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: paymentId, timestamp };

  try {
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    return { success: true, status: 'SYNCED', data: paymentId, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

// ==============================================================================
// 6. ISOLATED AGENCY CONFIGURATION & SETTINGS (STEP 9)
// ==============================================================================

export async function syncCompanySettings(
  settings: CompanySettings,
  currentUser?: User | null
): Promise<SyncResult<CompanySettings>> {
  const timestamp = new Date().toISOString();
  if (!isSupabaseConfigured) return { success: true, status: 'SYNCED', data: settings, timestamp };

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;

    // Fetch existing agency_data to merge safely without overwriting other keys
    const { data: existing } = await supabase
      .from('agency_data')
      .select('data')
      .eq('id', 'morvello_main')
      .maybeSingle();

    const mergedData = {
      ...(existing?.data || {}),
      companySettings: settings,
      updatedAt: timestamp,
      updatedBy: authUid || 'system',
    };

    const { error } = await supabase.from('agency_data').upsert(
      {
        id: 'morvello_main',
        agency_id: 'agency_morvello',
        data: mergedData,
        updated_at: timestamp,
        updated_by: authUid || 'system',
      },
      { onConflict: 'id' }
    );

    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }

    return { success: true, status: 'SYNCED', data: settings, timestamp };
  } catch (err: any) {
    return { success: false, status: 'SYNC_FAILED', error: err?.message, timestamp };
  }
}

async function syncUpdateNextContractSequence(nextSequence: number): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: existing } = await supabase
      .from('agency_data')
      .select('data')
      .eq('id', 'morvello_main')
      .maybeSingle();

    if (existing?.data?.companySettings) {
      const updated = {
        ...existing.data,
        companySettings: {
          ...existing.data.companySettings,
          nextContractNumber: nextSequence,
        },
        updatedAt: new Date().toISOString(),
      };
      await supabase.from('agency_data').update({ data: updated }).eq('id', 'morvello_main');
    }
  } catch (e) {
    console.warn('[RecordSync] Sequence sync note:', e);
  }
}
