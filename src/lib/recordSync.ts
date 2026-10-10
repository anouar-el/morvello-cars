import { supabase, isSupabaseConfigured } from './supabase';
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
import {
  resolveAssignedManagerForSupabase,
  reportSyncError,
  clearSyncError,
  requestRemoteRefresh,
} from './supabaseSync';
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

// ==============================================================================
// CRÉATIONS EN ATTENTE (« pending »)
// ==============================================================================
// Un enregistrement créé localement mais pas encore (ou pas) écrit en base reste visible
// jusqu'à ce que l'écriture réussisse. Tout le reste est remplacé par la base, qui fait foi.
const STORAGE_PENDING_KEY = 'morvello_pending_creates_v1';

function loadPendingCreates(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

const pendingCreates: Set<string> = loadPendingCreates();

function persistPendingCreates(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PENDING_KEY, JSON.stringify(Array.from(pendingCreates)));
  } catch {
    // Ignore storage error
  }
}

export function markPendingCreate(table: string, id: string): void {
  pendingCreates.add(`${table}:${id}`);
  persistPendingCreates();
}

export function clearPendingCreate(table: string, id: string): void {
  if (pendingCreates.delete(`${table}:${id}`)) persistPendingCreates();
}

export function isPendingCreate(table: string, id: string): boolean {
  return pendingCreates.has(`${table}:${id}`);
}

// ==============================================================================
// ÉCHEC D'ÉCRITURE : ANNULATION DE LA MODIFICATION OPTIMISTE + ALERTE
// ==============================================================================
// Les contextes appliquent la modification localement avant l'écriture. Si l'écriture échoue
// (conflit, refus RLS, enregistrement supprimé…), on alerte l'utilisateur et on recharge la base :
// comme la base fait foi, la modification locale est annulée sur tous les points d'appel.
function reportWriteFailure(
  table: string,
  entityId: string,
  res: { status: SyncStatus; error?: string; code?: string },
  timestamp: string
): void {
  let message: string;
  if (res.status === 'CONFLICT') {
    message =
      'Conflit : cet enregistrement a été modifié entre-temps par un autre utilisateur. ' +
      'Votre modification a été annulée et les données ont été rafraîchies — veuillez la refaire.';
  } else if (res.status === 'DENIED') {
    message = `${res.error || 'Permission refusée.'} Votre modification a été annulée.`;
  } else {
    message = `Modification non enregistrée : ${res.error || 'erreur de synchronisation.'}`;
  }
  reportSyncError({ table, entityId, code: res.code, message, timestamp });
  requestRemoteRefresh();
}

const CONFLICT_TOLERANCE_MS = 1500;

interface AtomicUpdateOutcome {
  success: boolean;
  status: SyncStatus;
  error: string;
  code?: string;
}

const OK_OUTCOME: AtomicUpdateOutcome = { success: true, status: 'SYNCED', error: '' };

/**
 * Mise à jour fusionnée ATOMIQUE d'une ligne (colonnes + document JSON `data`) :
 *  - refuse si la ligne a été modifiée par un autre utilisateur depuis `expectedUpdatedAt` (CONFLICT) ;
 *  - l'UPDATE est conditionné à `updated_at` lu juste avant : si quelqu'un écrit entre-temps, 0 ligne
 *    est modifiée, et on relit/fusionne à nouveau au lieu d'écraser (plus de « dernier écrit gagne »).
 */
async function atomicMergeUpdate(opts: {
  table: 'vehicles' | 'clients' | 'contracts' | 'deposits';
  id: string;
  expectedUpdatedAt?: string;
  timestamp: string;
  buildFields: (currentData: Record<string, any>) => Record<string, any>;
}): Promise<AtomicUpdateOutcome> {
  const { table, id, expectedUpdatedAt, timestamp, buildFields } = opts;
  const MAX_ATTEMPTS = 4;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: row, error: readErr } = await supabase
      .from(table)
      .select('updated_at, data')
      .eq('id', id)
      .maybeSingle();

    if (readErr) {
      const parsed = parsePostgrestError(readErr);
      return { success: false, status: parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED', error: parsed.message, code: parsed.code };
    }
    if (!row) {
      return {
        success: false,
        status: 'SYNC_FAILED',
        error: 'Enregistrement introuvable : il a peut-être été supprimé par un autre utilisateur.',
        code: 'NOT_FOUND',
      };
    }

    if (attempt === 0 && expectedUpdatedAt && row.updated_at) {
      const dbTime = new Date(row.updated_at).getTime();
      const expectedTime = new Date(expectedUpdatedAt).getTime();
      if (!Number.isNaN(dbTime) && !Number.isNaN(expectedTime) && dbTime - expectedTime > CONFLICT_TOLERANCE_MS) {
        return {
          success: false,
          status: 'CONFLICT',
          error: `Conflit de modification simultanée (dernière modification à ${row.updated_at}).`,
          code: 'CONCURRENCY_CONFLICT',
        };
      }
    }

    const fields = buildFields(row.data && typeof row.data === 'object' ? row.data : {});
    let query = supabase.from(table).update(fields).eq('id', id);
    query = row.updated_at ? query.eq('updated_at', row.updated_at) : query.is('updated_at', null);
    const { data: updatedRows, error } = await query.select('id');

    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED', error: parsed.message, code: parsed.code };
    }
    if (updatedRows && updatedRows.length > 0) {
      return OK_OUTCOME;
    }

    // 0 ligne modifiée : soit une écriture concurrente (on recommence), soit un refus RLS silencieux.
    const { data: again } = await supabase.from(table).select('updated_at').eq('id', id).maybeSingle();
    if (!again || (again.updated_at ?? null) === (row.updated_at ?? null)) {
      return {
        success: false,
        status: 'DENIED',
        error: 'Permission refusée par la politique de sécurité (RLS). Cette opération dépasse votre périmètre autorisé.',
        code: '42501',
      };
    }
  }

  return {
    success: false,
    status: 'CONFLICT',
    error: 'Conflit de modification simultanée : trop de modifications concurrentes sur cet enregistrement.',
    code: 'CONCURRENCY_CONFLICT',
  };
}

/**
 * Suppression avec vérification réelle : un DELETE bloqué par la RLS ne renvoie aucune erreur
 * mais supprime 0 ligne. Si la ligne existe encore, c'est un refus ; si elle a déjà disparu
 * (supprimée par un autre utilisateur), la suppression est considérée comme réussie.
 */
async function deleteRowChecked(
  table: 'vehicles' | 'clients' | 'contracts' | 'deposits',
  id: string
): Promise<AtomicUpdateOutcome> {
  const { data: deleted, error } = await supabase.from(table).delete().eq('id', id).select('id');
  if (error) {
    const parsed = parsePostgrestError(error);
    return { success: false, status: parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED', error: parsed.message, code: parsed.code };
  }
  if (deleted && deleted.length > 0) return OK_OUTCOME;

  const { data: stillThere } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  if (!stillThere) return OK_OUTCOME;
  return {
    success: false,
    status: 'DENIED',
    error: 'Suppression refusée par la politique de sécurité (RLS). Cet enregistrement dépasse votre périmètre autorisé.',
    code: '42501',
  };
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

    markPendingCreate('vehicles', vehicle.id);
    const { error } = await supabase.from('vehicles').insert(payload);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'vehicles', entityId: vehicle.id, operation: 'create', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    clearPendingCreate('vehicles', vehicle.id);

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

    // Fusion atomique du document JSON complet du véhicule + contrôle de conflit
    const outcome = await atomicMergeUpdate({
      table: 'vehicles',
      id: vehicleId,
      expectedUpdatedAt,
      timestamp,
      buildFields: (current) => ({
        ...updateFields,
        data: { ...current, ...patch, updatedAt: timestamp },
      }),
    });
    if (!outcome.success) {
      notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'update', status: outcome.status, error: outcome.error, timestamp });
      reportWriteFailure('vehicles', vehicleId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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
    const outcome = await deleteRowChecked('vehicles', vehicleId);
    if (!outcome.success) {
      notifySyncEvent({ table: 'vehicles', entityId: vehicleId, operation: 'delete', status: outcome.status, error: outcome.error, timestamp });
      reportWriteFailure('vehicles', vehicleId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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

    markPendingCreate('clients', client.id);
    const { error } = await supabase.from('clients').insert(payload);
    if (error) {
      const parsed = parsePostgrestError(error);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'clients', entityId: client.id, operation: 'create', status, error: parsed.message, timestamp });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    clearPendingCreate('clients', client.id);
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

    const outcome = await atomicMergeUpdate({
      table: 'clients',
      id: clientId,
      expectedUpdatedAt,
      timestamp,
      buildFields: (current) => ({
        ...updateFields,
        data: { ...current, ...patch, updatedAt: timestamp },
      }),
    });
    if (!outcome.success) {
      notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'update', status: outcome.status, error: outcome.error, timestamp });
      reportWriteFailure('clients', clientId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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
    const outcome = await deleteRowChecked('clients', clientId);
    if (!outcome.success) {
      notifySyncEvent({ table: 'clients', entityId: clientId, operation: 'delete', status: outcome.status, error: outcome.error, timestamp });
      reportWriteFailure('clients', clientId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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

    markPendingCreate('drivers', driver.id);
    const { error } = await supabase.from('drivers').insert(payload);
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    clearPendingCreate('drivers', driver.id);
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
    payments?: PaymentRecord[];
  },
  currentUser?: User | null
): Promise<SyncResult<Contract>> {
  const timestamp = new Date().toISOString();
  notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNCING', timestamp });

  if (!isSupabaseConfigured) {
    return { success: true, status: 'SYNCED', data: contract, timestamp };
  }
  markPendingCreate('contracts', contract.id);

  try {
    const sessionRes = await supabase.auth.getSession();
    const authUid = sessionRes.data?.session?.user?.id || null;
    const authEmail = sessionRes.data?.session?.user?.email || null;

    // STEP 7: ATOMIC POSTGRESQL TRANSACTION (create_contract_transactional RPC)
    let rpcSuccessful = false;
    let rpcHardError: any = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_contract_transactional',
        {
          p_contract: contract,
          p_client: related?.client || contract.clientSnapshot || null,
          p_vehicle_id: contract.vehicleId || null,
          p_deposit: related?.deposit || contract.depositRecord || null,
          p_payments: (related?.payments || contract.payments || []) as any,
          p_company_settings: related?.nextContractNumber ? { nextContractNumber: related.nextContractNumber } : null,
        }
      );

      if (!rpcError && rpcData?.success) {
        rpcSuccessful = true;
      } else if (rpcError) {
        const isRpcMissing =
          rpcError.code === 'PGRST202' ||
          rpcError.message?.toLowerCase().includes('could not find the function') ||
          rpcError.message?.toLowerCase().includes('create_contract_transactional') ||
          rpcError.message?.includes('schema cache');
        if (!isRpcMissing) {
          rpcHardError = rpcError;
        }
      }
    } catch (rpcExc: any) {
      console.warn('[RecordSync] Exception RPC create_contract_transactional:', rpcExc);
    }

    if (rpcHardError) {
      const parsed = parsePostgrestError(rpcHardError);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({
        table: 'contracts',
        entityId: contract.contractNumber || contract.id,
        operation: 'create',
        status,
        error: parsed.message,
        timestamp,
      });
      reportSyncError({
        table: 'contracts',
        entityId: contract.contractNumber || contract.id,
        code: parsed.code,
        message: parsed.message,
        details: rpcHardError.details,
        timestamp,
      });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    // Si la fonction RPC transactionnelle a réussi
    if (rpcSuccessful) {
      if (related?.nextContractNumber) {
        syncUpdateNextContractSequence(related.nextContractNumber).catch(() => {});
      }
      clearPendingCreate('contracts', contract.id);
      clearSyncError();
      notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNCED', timestamp });
      return { success: true, status: 'SYNCED', data: contract, timestamp };
    }

    // STEP 5: SÉQUENCE D'ORDONNANCEMENT ET VÉRIFICATION D'INTÉGRITÉ RÉFÉRENTIELLE (FALLBACK CLIENT-SIDE)
    // 1. VÉRIFICATION ET SÉCURISATION DU VÉHICULE (PARENT FK)
    if (contract.vehicleId) {
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id, plate, status, current_km')
        .eq('id', contract.vehicleId)
        .maybeSingle();

      if (!existingVehicle) {
        if (related?.vehicle) {
          const vehRes = await syncCreateVehicle(related.vehicle, currentUser);
          if (!vehRes.success) {
            const msg = `Véhicule parent introuvable et échec de création : ${vehRes.error || 'Erreur intégrité référentielle'}`;
            notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
            return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
          }
        } else {
          const msg = `Véhicule introuvable en base de données (${contract.vehicleId}). Un contrat ne peut pas référencer un véhicule inexistant.`;
          notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
          return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
        }
      } else {
        if (existingVehicle.status === 'maintenance' || existingVehicle.status === 'inactive') {
          const msg = `Véhicule indisponible : le véhicule est actuellement en statut "${existingVehicle.status}".`;
          notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
          return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
        }

        // STEP 10 & 11: Détection des chevauchements de dates (Anti Double Booking)
        if (contract.startDate && contract.endDate && (contract.status === 'active' || contract.status === 'draft')) {
          const { data: overlapping } = await supabase
            .from('contracts')
            .select('id, contract_number, start_date, end_date')
            .eq('vehicle_id', contract.vehicleId)
            .in('status', ['active', 'draft'])
            .lte('start_date', contract.endDate)
            .gte('end_date', contract.startDate)
            .neq('id', contract.id)
            .limit(1);

          if (overlapping && overlapping.length > 0) {
            const msg = `Double réservation rejetée : le véhicule est déjà engagé dans le contrat actif ${overlapping[0].contract_number} du ${overlapping[0].start_date} au ${overlapping[0].end_date}.`;
            notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
            reportSyncError({
              table: 'contracts',
              entityId: contract.contractNumber || contract.id,
              code: 'DOUBLE_BOOKING',
              message: msg,
              timestamp,
            });
            return { success: false, status: 'SYNC_FAILED', error: msg, code: 'DOUBLE_BOOKING', timestamp };
          }
        }
      }
    } else {
      const msg = 'Véhicule obligatoire : un contrat doit obligatoirement être rattaché à un véhicule.';
      notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
      return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
    }

    // 2. VÉRIFICATION ET CRÉATION ATOMIQUE DU CLIENT (PARENT FK)
    if (contract.clientId) {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('id', contract.clientId)
        .maybeSingle();

      if (!existingClient) {
        if (related?.client) {
          const clientRes = await syncCreateClient(related.client, currentUser);
          if (!clientRes.success) {
            const msg = `Échec de création du client parent : ${clientRes.error || 'Erreur intégrité référentielle'}`;
            notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
            return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
          }
        } else {
          const msg = `Client introuvable en base de données (${contract.clientId}). Un contrat ne peut pas référencer un client inexistant.`;
          notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
          return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
        }
      }
    } else {
      const msg = 'Client obligatoire : un contrat doit obligatoirement être rattaché à un client.';
      notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: msg, timestamp });
      return { success: false, status: 'SYNC_FAILED', error: msg, timestamp };
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
      manager_display_name: contract.managerDisplayName?.trim() || null,
      manager_phone: contract.managerPhone?.trim() || null,
      created_by: contract.createdBy || authUid || 'Direction',
      data: {
        ...contract,
        assignedManagerId: assignedMgrId,
        managerDisplayName: contract.managerDisplayName?.trim() || undefined,
        managerPhone: contract.managerPhone?.trim() || undefined,
      },
      created_at: timestamp,
      updated_at: timestamp,
    };

    // 3. INSERTION DU CONTRAT EN BASE DE DONNÉES
    const { error: contractErr } = await supabase.from('contracts').insert(contractPayload);
    if (contractErr) {
      const parsed = parsePostgrestError(contractErr);
      const status: SyncStatus = parsed.code === '42501' ? 'DENIED' : 'SYNC_FAILED';
      notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status, error: parsed.message, timestamp });
      reportSyncError({
        table: 'contracts',
        entityId: contract.contractNumber || contract.id,
        code: parsed.code,
        message: parsed.message,
        details: contractErr.details,
        timestamp,
      });
      return { success: false, status, error: parsed.message, code: parsed.code, timestamp };
    }

    // 4. INSERTION DE LA CAUTION ASSOCIÉE (SI PRÉSENTE)
    if (related?.deposit) {
      await syncCreateDeposit(related.deposit, currentUser);
    }

    // 5. INSERTION DES PAIEMENTS INITIAUX (SI FOURNIS)
    if (related?.payments || (contract.payments && contract.payments.length > 0)) {
      const payList = related?.payments || contract.payments || [];
      for (const p of payList) {
        await syncCreatePayment(contract.id, p, currentUser);
      }
    }

    // 6. MISE À JOUR DU STATUT DU VÉHICULE EN 'RENTED'
    if (contract.vehicleId && contract.status === 'active') {
      await syncUpdateVehicle(contract.vehicleId, { status: 'rented', currentKm: contract.departureKm });
    }

    // 7. INCRÉMENTATION DU COMPTEUR DE SÉQUENCE D'AGENCE
    if (related?.nextContractNumber) {
      await syncUpdateNextContractSequence(related.nextContractNumber);
    }

    clearPendingCreate('contracts', contract.id);
    clearSyncError();
    notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNCED', timestamp });
    return { success: true, status: 'SYNCED', data: contract, timestamp };
  } catch (err: any) {
    const message = err?.message || 'Erreur réseau lors de la création du contrat';
    notifySyncEvent({ table: 'contracts', entityId: contract.id, operation: 'create', status: 'SYNC_FAILED', error: message, timestamp });
    reportSyncError({
      table: 'contracts',
      entityId: contract.contractNumber || contract.id,
      message,
      timestamp,
    });
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
    const updateFields: Record<string, any> = {
      updated_at: timestamp,
    };

    if (patch.status !== undefined) updateFields.status = patch.status;
    if (patch.startDate !== undefined) updateFields.start_date = patch.startDate;
    if (patch.endDate !== undefined) updateFields.end_date = patch.endDate;
    if (patch.totalAmount !== undefined) updateFields.total_amount = patch.totalAmount;
    if (patch.depositAmount !== undefined) updateFields.deposit_amount = patch.depositAmount;
    if (patch.managerDisplayName !== undefined) updateFields.manager_display_name = patch.managerDisplayName?.trim() || null;
    if (patch.managerPhone !== undefined) updateFields.manager_phone = patch.managerPhone?.trim() || null;

    const outcome = await atomicMergeUpdate({
      table: 'contracts',
      id: contractId,
      expectedUpdatedAt,
      timestamp,
      buildFields: (current) => ({
        ...updateFields,
        data: { ...current, ...patch, updatedAt: timestamp },
      }),
    });
    if (!outcome.success) {
      notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'update', status: outcome.status, error: outcome.error, timestamp });
      reportWriteFailure('contracts', contractId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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
    const outcome = await deleteRowChecked('contracts', contractId);
    if (!outcome.success) {
      notifySyncEvent({ table: 'contracts', entityId: contractId, operation: 'delete', status: outcome.status, error: outcome.error, timestamp });
      reportWriteFailure('contracts', contractId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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

    markPendingCreate('deposits', deposit.id);
    const { error } = await supabase.from('deposits').upsert(payload, { onConflict: 'id' });
    if (error) {
      const parsed = parsePostgrestError(error);
      return { success: false, status: 'SYNC_FAILED', error: parsed.message, code: parsed.code, timestamp };
    }
    clearPendingCreate('deposits', deposit.id);

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

    const outcome = await atomicMergeUpdate({
      table: 'deposits',
      id: depositId,
      expectedUpdatedAt,
      timestamp,
      buildFields: (current) => ({
        ...updateFields,
        data: { ...current, ...patch, updatedAt: timestamp },
      }),
    });
    if (!outcome.success) {
      reportWriteFailure('deposits', depositId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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
    const outcome = await deleteRowChecked('deposits', depositId);
    if (!outcome.success) {
      reportWriteFailure('deposits', depositId, outcome, timestamp);
      return { success: false, status: outcome.status, error: outcome.error, code: outcome.code, timestamp };
    }

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
