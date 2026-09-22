import { supabase, isSupabaseConfigured } from './supabase';
import { isAbortException } from '../initErrorHandling';
import { MorvelloCloudData } from './firestoreSync';

const AGENCY_RECORD_ID = 'morvello_main';

let hasWarnedMissingSchema = false;

export interface SupabaseSyncError {
  table: string;
  entityId?: string;
  code?: string;
  message: string;
  details?: string;
  timestamp: string;
}

type SyncErrorListener = (error: SupabaseSyncError | null) => void;
const syncErrorListeners = new Set<SyncErrorListener>();
let lastSyncErrorState: SupabaseSyncError | null = null;

export function getLastSyncError(): SupabaseSyncError | null {
  return lastSyncErrorState;
}

export function subscribeToSyncErrors(listener: SyncErrorListener): () => void {
  syncErrorListeners.add(listener);
  listener(lastSyncErrorState);
  return () => {
    syncErrorListeners.delete(listener);
  };
}

export function reportSyncError(err: SupabaseSyncError): void {
  lastSyncErrorState = err;
  syncErrorListeners.forEach((fn) => {
    try {
      fn(err);
    } catch (e) {
      console.warn('[Supabase Sync] Sync error listener exception:', e);
    }
  });
}

export function clearSyncError(): void {
  lastSyncErrorState = null;
  syncErrorListeners.forEach((fn) => {
    try {
      fn(null);
    } catch {}
  });
}

/**
 * Fetches the centralized Morvello Cars agency state from Supabase PostgreSQL
 */
export async function fetchRemoteAgencyDataFromSupabase(): Promise<MorvelloCloudData | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('agency_data')
      .select('data, updated_at, updated_by')
      .eq('id', AGENCY_RECORD_ID)
      .maybeSingle();

    if (error) {
      // PGRST205 / 42P01 means the table hasn't been created yet in the SQL editor
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        if (!hasWarnedMissingSchema) {
          console.info(
            '[Supabase] Table "agency_data" non trouvée. Veuillez exécuter le script restore_strict_supabase_rls.sql dans votre SQL Editor Supabase.'
          );
          hasWarnedMissingSchema = true;
        }
        return null;
      }
      console.warn('[Supabase Sync] Error fetching agency data:', error.message);
      return null;
    }

    if (data && data.data && typeof data.data === 'object') {
      return {
        ...(data.data as MorvelloCloudData),
        updatedAt: data.updated_at || (data.data as any).updatedAt,
        updatedBy: data.updated_by || (data.data as any).updatedBy,
      };
    }

    return null;
  } catch (err: any) {
    if (isAbortException(err)) return null;
    console.warn('[Supabase Sync] Exception during fetch:', err);
    return null;
  }
}

/**
 * Saves or updates the Morvello Cars agency state in Supabase PostgreSQL
 * Respects strict Row Level Security (no bypass RPC functions).
 */
export async function saveRemoteAgencyDataToSupabase(
  payload: Partial<MorvelloCloudData>,
  userId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  try {
    const nowIso = new Date().toISOString();
    const cleanPayload = {
      ...payload,
      updatedAt: nowIso,
      updatedBy: userId || 'morvello_user',
    };

    // Upsert direct sur agency_data (soumis aux règles strictes RLS)
    const { error } = await supabase
      .from('agency_data')
      .upsert(
        {
          id: AGENCY_RECORD_ID,
          data: cleanPayload,
          updated_at: nowIso,
          updated_by: userId || 'system',
        },
        { onConflict: 'id' }
      );

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        if (!hasWarnedMissingSchema) {
          console.warn(
            '[Supabase] Table "agency_data" introuvable. Exécutez restore_strict_supabase_rls.sql dans Supabase SQL Editor.'
          );
          hasWarnedMissingSchema = true;
        }
        return false;
      }

      console.error(
        `[Supabase Sync] Échec sauvegarde agency_data : Code ${error.code} - ${error.message} - ${error.details || ''}`
      );
      reportSyncError({
        table: 'agency_data',
        entityId: AGENCY_RECORD_ID,
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: nowIso,
      });
    }

    // Synchronisation granulaire dans les tables individuelles Supabase
    syncIndividualTables(cleanPayload).catch((err) => {
      console.warn('[Supabase Sync] Granular tables sync note:', err);
    });

    return !error;
  } catch (err: any) {
    if (isAbortException(err)) return false;
    console.error('[Supabase Sync] Exception during save:', err);
    return false;
  }
}

/**
 * Real-time listener using Supabase Realtime Channels
 */
export function subscribeToRemoteAgencyDataFromSupabase(
  onData: (data: MorvelloCloudData) => void,
  onError?: (err: any) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {};
  }

  try {
    const channel = supabase
      .channel('public:agency_data:morvello_main')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agency_data',
          filter: `id=eq.${AGENCY_RECORD_ID}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).data) {
            const rawData = (payload.new as any).data;
            if (typeof rawData === 'object') {
              onData({
                ...rawData,
                updatedAt: (payload.new as any).updated_at || rawData.updatedAt,
                updatedBy: (payload.new as any).updated_by || rawData.updatedBy,
              });
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Channel connected
        }
        if (err && onError) {
          onError(err);
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (unsubErr) {
        console.warn('[Supabase Realtime] Error on unsubscribe:', unsubErr);
      }
    };
  } catch (subErr) {
    console.warn('[Supabase Realtime] Exception subscribing to agency_data:', subErr);
    return () => {};
  }
}

/**
 * Enregistre le profil d'un utilisateur / collaborateur dans la table `profiles`
 */
export async function saveUserProfileToSupabase(
  userId: string,
  profile: {
    role: string;
    email: string;
    name?: string;
    phone?: string;
    permissions?: any;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        role: profile.role,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        phone: profile.phone || null,
        permissions: profile.permissions || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      if (error.code !== 'PGRST205' && !error.message?.includes('does not exist')) {
        console.error(
          `[Supabase Profile] Erreur sauvegarde profil (${userId}): Code ${error.code} - ${error.message}`
        );
        reportSyncError({
          table: 'profiles',
          entityId: userId,
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
        });
      }
      return false;
    }
    return true;
  } catch (err: any) {
    if (isAbortException(err)) return false;
    console.warn('[Supabase Profile] Exception saving profile:', err);
    return false;
  }
}

// Cache set of known missing columns per table: e.g. "contracts:assigned_manager_id"
const knownMissingColumns = new Set<string>();

export function isColumnMissing(table: string, column: string): boolean {
  return knownMissingColumns.has(`${table}:${column}`);
}

export function markColumnMissing(table: string, column: string): void {
  knownMissingColumns.add(`${table}:${column}`);
}

export function clearMissingColumnsCache(): void {
  knownMissingColumns.clear();
}

export function extractMissingColumnFromError(error: any): string | null {
  if (!error) return null;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  const match = msg.match(/Could not find the '([^']+)' column/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Lit les identifiants et métadonnées existants de façon résiliente aux colonnes manquantes
 */
async function fetchExistingRows(
  table: string,
  ids: string[]
): Promise<Map<string, { id: string; assigned_manager_id?: string | null; created_by?: string | null }>> {
  const map = new Map<string, { id: string; assigned_manager_id?: string | null; created_by?: string | null }>();
  if (!ids.length) return map;

  const requestWithManagerCol = !isColumnMissing(table, 'assigned_manager_id');
  const cols = requestWithManagerCol ? 'id, assigned_manager_id, created_by' : 'id, created_by';

  try {
    let res = await supabase.from(table).select(cols).in('id', ids);
    if (res.error) {
      if (res.error.code === 'PGRST204' || res.error.message?.includes('schema cache')) {
        const missing = extractMissingColumnFromError(res.error) || 'assigned_manager_id';
        markColumnMissing(table, missing);
        const retryRes = await supabase.from(table).select('id, created_by').in('id', ids);
        if (retryRes.data) {
          retryRes.data.forEach((r: any) => map.set(r.id, r));
        }
      } else {
        console.warn(`[Supabase Sync] Note lecture ${table} existants:`, res.error);
      }
    } else if (res.data) {
      res.data.forEach((r: any) => map.set(r.id, r));
    }
  } catch (err) {
    console.warn(`[Supabase Sync] Exception lecture ${table} existants:`, err);
  }

  return map;
}

/**
 * Upsert résilient aux colonnes manquantes dans le cache de schéma Supabase (PGRST204).
 * Si une colonne n'existe pas encore en base, elle est retirée du payload SQL
 * tout en restant 100% persistée dans la colonne data (JSONB), puis réessayée immédiatement.
 */
async function resilientUpsert(
  table: string,
  payload: Record<string, any>,
  conflictCol: string = 'id'
): Promise<{ error: any }> {
  const cleanPayload = { ...payload };
  for (const key of Object.keys(cleanPayload)) {
    if (isColumnMissing(table, key)) {
      delete cleanPayload[key];
    }
  }

  let { error } = await supabase.from(table).upsert(cleanPayload, { onConflict: conflictCol });

  let retries = 0;
  while (error && (error.code === 'PGRST204' || error.message?.includes('schema cache')) && retries < 3) {
    retries++;
    const missingCol = extractMissingColumnFromError(error);
    if (missingCol && missingCol in cleanPayload) {
      console.warn(
        `[Supabase Sync] Colonne '${missingCol}' absente de '${table}' dans le cache PostgREST. Repli automatique sans cette colonne.`
      );
      markColumnMissing(table, missingCol);
      delete cleanPayload[missingCol];
      const retryRes = await supabase.from(table).upsert(cleanPayload, { onConflict: conflictCol });
      error = retryRes.error;
    } else {
      break;
    }
  }

  return { error };
}

/**
 * Synchronise les entités individuelles dans leurs tables PostgreSQL dédiées
 * en respectant scrupuleusement les règles RLS sans aucun contournement.
 */
export async function syncIndividualTables(payload: Partial<MorvelloCloudData>): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    // Obtenir la session Supabase actuelle pour la valeur de repli d'attribution
    const { data: authSessionData } = await supabase.auth.getSession();
    const currentAuthUid =
      authSessionData?.session?.user?.id ||
      (payload.updatedBy && payload.updatedBy !== 'system' && payload.updatedBy !== 'morvello_user'
        ? String(payload.updatedBy)
        : null);

    // 1. Véhicules
    if (payload.vehicles && Array.isArray(payload.vehicles) && payload.vehicles.length > 0) {
      const vehicleIds = payload.vehicles.map((v) => v.id).filter(Boolean);
      const existingVehicleMap = await fetchExistingRows('vehicles', vehicleIds);
      let vehicleHadError = false;

      for (const v of payload.vehicles) {
        const existing = existingVehicleMap.get(v.id);
        const assignedMgrId =
          existing?.assigned_manager_id ||
          (v.assignedManagerId && v.assignedManagerId.trim() !== '' ? v.assignedManagerId : null);
        const createdBy =
          existing?.created_by ||
          (v as any).createdBy ||
          (v as any).proposedBy ||
          currentAuthUid ||
          'system';

        const { error: vehicleErr } = await resilientUpsert('vehicles', {
          id: v.id,
          brand: v.brand,
          model: v.model,
          plate: v.plate,
          fuel_type: v.fuelType,
          status: v.status,
          current_km: v.currentKm,
          daily_rate: v.dailyRate,
          assigned_manager_id: assignedMgrId,
          created_by: createdBy,
          approval_status: v.approvalStatus || 'approved',
          data: {
            ...v,
            assignedManagerId: assignedMgrId,
            createdBy: createdBy,
          },
          updated_at: new Date().toISOString(),
        });

        if (vehicleErr) {
          vehicleHadError = true;
          console.error(
            `[Supabase Sync] Erreur upsert véhicule ${v.plate || v.id}:`,
            `Code: ${vehicleErr.code}`,
            `Message: ${vehicleErr.message}`,
            `Détails: ${vehicleErr.details || ''}`
          );
          reportSyncError({
            table: 'vehicles',
            entityId: v.plate || v.id,
            code: vehicleErr.code,
            message: vehicleErr.message,
            details: vehicleErr.details,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (!vehicleHadError && lastSyncErrorState?.table === 'vehicles') {
        clearSyncError();
      }
    }

    // 2. Clients (soumis aux règles strictes RLS, sans aucune fonction RPC contournante)
    if (payload.clients && Array.isArray(payload.clients) && payload.clients.length > 0) {
      const clientIds = payload.clients.map((c) => c.id).filter(Boolean);
      const existingClientMap = await fetchExistingRows('clients', clientIds);
      let clientHadError = false;

      for (const c of payload.clients) {
        const existing = existingClientMap.get(c.id);

        let assignedMgrId: string | null;
        if (existing && existing.assigned_manager_id) {
          // Si le client existe déjà en base, conserver son assignation sans l'écraser
          assignedMgrId = existing.assigned_manager_id;
        } else if (c.assignedManagerId && c.assignedManagerId.trim() !== '') {
          assignedMgrId = c.assignedManagerId;
        } else {
          // Repli : utilisateur actuellement authentifié
          assignedMgrId = currentAuthUid || null;
        }

        const createdBy = existing?.created_by || (c as any).createdBy || currentAuthUid || 'system';

        const clientPayload = {
          ...c,
          assignedManagerId: assignedMgrId,
          createdBy: createdBy,
        };

        const { error: clientUpsertErr } = await resilientUpsert('clients', {
          id: c.id,
          first_name: c.firstName,
          last_name: c.lastName,
          doc_type: c.docType,
          doc_number: c.docNumber,
          phone: c.phone,
          email: c.email,
          contract_count: c.contractCount || 0,
          assigned_manager_id: assignedMgrId,
          created_by: createdBy,
          data: clientPayload,
          updated_at: new Date().toISOString(),
        });

        if (clientUpsertErr) {
          clientHadError = true;
          console.error(
            `[Supabase Sync] Erreur upsert client "${c.firstName} ${c.lastName}" (${c.id}):`,
            `Code: ${clientUpsertErr.code}`,
            `Message: ${clientUpsertErr.message}`,
            `Détails: ${clientUpsertErr.details || ''}`
          );
          reportSyncError({
            table: 'clients',
            entityId: `${c.firstName} ${c.lastName}`.trim() || c.id,
            code: clientUpsertErr.code,
            message: clientUpsertErr.message,
            details: clientUpsertErr.details,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (!clientHadError && lastSyncErrorState?.table === 'clients') {
        clearSyncError();
      }
    }

    // 3. Contrats
    // Si le contrat existe déjà avec un assigned_manager_id, le conserver sans le recalculer
    // afin de ne pas déclencher de rejet par la policy RLS can_assign_manager.
    if (payload.contracts && Array.isArray(payload.contracts) && payload.contracts.length > 0) {
      const contractIds = payload.contracts.map((c) => c.id).filter(Boolean);
      const existingContractMap = await fetchExistingRows('contracts', contractIds);
      let contractHadError = false;

      for (const cnt of payload.contracts) {
        const existing = existingContractMap.get(cnt.id);

        let assignedMgrId: string | null;
        if (existing && existing.assigned_manager_id) {
          // Si le contrat existe déjà en base, NE PAS l'écraser avec une valeur recalculée
          assignedMgrId = existing.assigned_manager_id;
        } else if (cnt.assignedManagerId && cnt.assignedManagerId.trim() !== '') {
          // Valeur explicitement assignée
          assignedMgrId = cnt.assignedManagerId;
        } else {
          // Priorise TOUJOURS l'utilisateur actuellement authentifié comme valeur de repli finale
          assignedMgrId = currentAuthUid || null;
        }

        const createdBy = existing?.created_by || cnt.createdBy || currentAuthUid || 'system';

        const contractPayload = {
          id: cnt.id,
          contract_number: cnt.contractNumber,
          status: cnt.status,
          client_id: cnt.clientId || null,
          vehicle_id: cnt.vehicleId || null,
          start_date: cnt.startDate,
          end_date: cnt.endDate,
          total_amount: cnt.totalAmount,
          deposit_amount: cnt.depositAmount,
          assigned_manager_id: assignedMgrId,
          created_by: createdBy,
          data: {
            ...cnt,
            assignedManagerId: assignedMgrId,
            createdBy: createdBy,
          },
          updated_at: new Date().toISOString(),
        };

        let { error: contractErr } = await resilientUpsert('contracts', contractPayload);

        // Gestion résiliente des violations de clés étrangères (PostgreSQL code 23503)
        // Cas 1 : contracts_client_id_fkey - Le client n'existe pas encore dans public.clients
        if (
          contractErr &&
          contractErr.code === '23503' &&
          (contractErr.message?.includes('contracts_client_id_fkey') ||
            contractErr.details?.includes('clients') ||
            contractErr.message?.includes('clients'))
        ) {
          console.warn(
            `[Supabase Sync] Clé étrangère client_id (${cnt.clientId}) non trouvée dans 'clients' pour ${cnt.contractNumber}. Auto-création du client...`
          );

          if (cnt.clientId && cnt.clientSnapshot) {
            const snap = cnt.clientSnapshot;
            const autoClientPayload = {
              id: cnt.clientId,
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
              contractCount: 1,
              assignedManagerId: assignedMgrId,
              createdBy: createdBy,
            };

            await resilientUpsert('clients', {
              id: cnt.clientId,
              first_name: autoClientPayload.firstName,
              last_name: autoClientPayload.lastName,
              doc_type: autoClientPayload.docType,
              doc_number: autoClientPayload.docNumber,
              phone: autoClientPayload.phone,
              email: autoClientPayload.email,
              contract_count: 1,
              assigned_manager_id: assignedMgrId,
              created_by: createdBy,
              data: autoClientPayload,
              updated_at: new Date().toISOString(),
            });

            const retryWithClient = await resilientUpsert('contracts', contractPayload);
            contractErr = retryWithClient.error;
          }

          // Si la contrainte de clé étrangère persiste (client non trouvable ou RLS restrictif),
          // insérer avec client_id: null pour ne jamais bloquer la synchronisation
          // (l'intégralité des données du client reste préservée dans la colonne JSONB data).
          if (
            contractErr &&
            contractErr.code === '23503' &&
            (contractErr.message?.includes('contracts_client_id_fkey') ||
              contractErr.details?.includes('clients') ||
              contractErr.message?.includes('clients'))
          ) {
            console.warn(
              `[Supabase Sync] Repli résilient : enregistrement de ${cnt.contractNumber} avec client_id=null pour satisfaire PostgreSQL (données 100% préservées dans JSONB).`
            );
            const fallbackNullClient = await resilientUpsert('contracts', {
              ...contractPayload,
              client_id: null,
            });
            contractErr = fallbackNullClient.error;
          }
        }

        // Cas 2 : contracts_vehicle_id_fkey - Le véhicule n'existe pas encore dans public.vehicles
        if (
          contractErr &&
          contractErr.code === '23503' &&
          (contractErr.message?.includes('contracts_vehicle_id_fkey') ||
            contractErr.details?.includes('vehicles') ||
            contractErr.message?.includes('vehicles'))
        ) {
          console.warn(
            `[Supabase Sync] Clé étrangère vehicle_id (${cnt.vehicleId}) non trouvée dans 'vehicles' pour ${cnt.contractNumber}. Repli avec vehicle_id=null.`
          );
          const fallbackVehicleRes = await resilientUpsert('contracts', {
            ...contractPayload,
            client_id: contractErr.message?.includes('clients') ? null : contractPayload.client_id,
            vehicle_id: null,
          });
          contractErr = fallbackVehicleRes.error;
        }

        if (contractErr) {
          contractHadError = true;
          console.error(
            `[Supabase Sync] Erreur upsert contrat ${cnt.contractNumber || cnt.id}:`,
            `Code: ${contractErr.code}`,
            `Message: ${contractErr.message}`,
            `Détails: ${contractErr.details || ''}`
          );
          reportSyncError({
            table: 'contracts',
            entityId: cnt.contractNumber || cnt.id,
            code: contractErr.code,
            message: contractErr.message,
            details: contractErr.details,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (!contractHadError && lastSyncErrorState?.table === 'contracts') {
        clearSyncError();
      }
    }

    // 4. Cautions
    // Même principe : préserver l'existant en base et prioriser l'utilisateur connecté comme repli
    if (payload.deposits && Array.isArray(payload.deposits) && payload.deposits.length > 0) {
      const depositIds = payload.deposits.map((d) => d.id).filter(Boolean);
      const existingDepositMap = await fetchExistingRows('deposits', depositIds);
      let depositHadError = false;

      for (const dep of payload.deposits) {
        const existing = existingDepositMap.get(dep.id);

        let assignedMgrId: string | null;
        if (existing && existing.assigned_manager_id) {
          assignedMgrId = existing.assigned_manager_id;
        } else if (dep.assignedManagerId && dep.assignedManagerId.trim() !== '') {
          assignedMgrId = dep.assignedManagerId;
        } else {
          // Repli : contrat associé si déjà affecté, sinon utilisateur actuellement authentifié
          const matchedContract = payload.contracts?.find(
            (cnt) => cnt.id === dep.contractId || cnt.contractNumber === dep.contractNumber
          );
          assignedMgrId = matchedContract?.assignedManagerId || currentAuthUid || null;
        }

        const createdBy =
          existing?.created_by ||
          dep.createdBy ||
          dep.receivedBy ||
          currentAuthUid ||
          'system';

        const { error: depositErr } = await resilientUpsert('deposits', {
          id: dep.id,
          contract_id: dep.contractId,
          client_name: dep.clientName,
          amount: dep.amount,
          status: dep.status === 'held' ? 'pending' : dep.status,
          method: dep.method,
          assigned_manager_id: assignedMgrId,
          created_by: createdBy,
          data: {
            ...dep,
            assignedManagerId: assignedMgrId,
            createdBy: createdBy,
          },
          updated_at: new Date().toISOString(),
        });

        if (depositErr) {
          depositHadError = true;
          console.error(
            `[Supabase Sync] Erreur upsert caution ${dep.id}:`,
            `Code: ${depositErr.code}`,
            `Message: ${depositErr.message}`,
            `Détails: ${depositErr.details || ''}`
          );
          reportSyncError({
            table: 'deposits',
            entityId: dep.id,
            code: depositErr.code,
            message: depositErr.message,
            details: depositErr.details,
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (!depositHadError && lastSyncErrorState?.table === 'deposits') {
        clearSyncError();
      }
    }

    // 5. Profils Collaborateurs & Managers
    if (payload.users && Array.isArray(payload.users) && payload.users.length > 0) {
      for (const u of payload.users) {
        const { error: profileErr } = await supabase.from('profiles').upsert(
          {
            id: u.firebaseUid || u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            phone: u.phone || null,
            agency: u.agency || 'Nouaceur Casablanca',
            assigned_fleet_name: u.assignedFleetName || null,
            permissions: u.permissions || {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (profileErr) {
          console.error(
            `[Supabase Sync] Erreur upsert profil (${u.name || u.email || u.id}):`,
            `Code: ${profileErr.code}`,
            `Message: ${profileErr.message}`,
            `Détails: ${profileErr.details || ''}`
          );
          reportSyncError({
            table: 'profiles',
            entityId: u.name || u.email || u.id,
            code: profileErr.code,
            message: profileErr.message,
            details: profileErr.details,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  } catch (syncErr) {
    console.warn('[Supabase Sync] syncIndividualTables caught:', syncErr);
  }
}

/**
 * Synchronise explicitement l'ensemble des clients enregistrés vers Supabase
 * avec diagnostic détaillé des succès et erreurs de politiques RLS.
 */
export async function syncAllClientsToSupabase(clients: any[]): Promise<{
  success: boolean;
  syncedCount: number;
  totalCount: number;
  hasRlsError: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      syncedCount: 0,
      totalCount: clients?.length || 0,
      hasRlsError: false,
      error: 'Supabase n’est pas configuré.',
    };
  }

  if (!clients || !Array.isArray(clients) || clients.length === 0) {
    return {
      success: true,
      syncedCount: 0,
      totalCount: 0,
      hasRlsError: false,
    };
  }

  const { data: authSessionData } = await supabase.auth.getSession();
  const currentAuthUid = authSessionData?.session?.user?.id || null;

  let syncedCount = 0;
  let hasRlsError = false;
  let lastErrorMessage = '';

  for (const c of clients) {
    try {
      const assignedMgrId = c.assignedManagerId || currentAuthUid || null;
      const createdBy = c.createdBy || currentAuthUid || 'system';

      const { error: upsertErr } = await resilientUpsert('clients', {
        id: c.id,
        first_name: c.firstName || '',
        last_name: c.lastName || '',
        doc_type: c.docType || 'CIN',
        doc_number: c.docNumber || '',
        phone: c.phone || '',
        email: c.email || '',
        contract_count: c.contractCount || 0,
        assigned_manager_id: assignedMgrId,
        created_by: createdBy,
        data: { ...c, assignedManagerId: assignedMgrId, createdBy },
        updated_at: new Date().toISOString(),
      });

      if (!upsertErr) {
        syncedCount++;
      } else {
        console.error(
          `[Supabase Sync] Erreur synchronisation client "${c.firstName} ${c.lastName}" (${c.id}):`,
          `Code: ${upsertErr.code}`,
          `Message: ${upsertErr.message}`,
          `Détails: ${upsertErr.details || ''}`
        );
        lastErrorMessage = `${upsertErr.code || ''}: ${upsertErr.message}`;
        if (upsertErr.code === '42501' || upsertErr.message?.includes('row-level security')) {
          hasRlsError = true;
        }
        reportSyncError({
          table: 'clients',
          entityId: `${c.firstName} ${c.lastName}`.trim() || c.id,
          code: upsertErr.code,
          message: upsertErr.message,
          details: upsertErr.details,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      lastErrorMessage = err?.message || String(err);
    }
  }

  return {
    success: syncedCount === clients.length,
    syncedCount,
    totalCount: clients.length,
    hasRlsError,
    error: hasRlsError
      ? 'Erreur 42501 (RLS Supabase) : La politique de sécurité RLS stricte bloque cette écriture. Assurez-vous d’être authentifié et assigné à ces ressources.'
      : lastErrorMessage || undefined,
  };
}
