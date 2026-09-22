import { supabase, isSupabaseConfigured } from './supabase';
import { isAbortException } from '../initErrorHandling';
import { MorvelloCloudData } from './firestoreSync';

const AGENCY_RECORD_ID = 'morvello_main';

let hasWarnedMissingSchema = false;

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
            '[Supabase] Table "agency_data" non trouvée. Veuillez exécuter le script supabase_schema.sql dans votre SQL Editor Supabase.'
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

    // 1. Tenter la synchronisation via la fonction RPC SECURITY DEFINER (bypass RLS propre)
    try {
      const { error: rpcErr } = await supabase.rpc('sync_agency_state', {
        payload: cleanPayload,
        updater_id: userId || 'system',
      });
      if (!rpcErr) {
        return true;
      }
    } catch {
      // Ignorer si la fonction RPC n'est pas encore déployée dans la base
    }

    // 2. Repli vers l'upsert direct sur agency_data
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
            '[Supabase] Exécutez le script fix_supabase_sync_rls.sql dans Supabase pour activer la sauvegarde PostgreSQL.'
          );
          hasWarnedMissingSchema = true;
        }
        return false;
      }
      if (error.code === '42501' || error.message?.includes('row-level security')) {
        console.warn(
          '[Supabase Sync] Blocage RLS (42501) détecté. Veuillez exécuter le script fix_supabase_sync_rls.sql dans votre SQL Editor Supabase.'
        );
      } else {
        console.error('[Supabase Sync] Failed to save agency data:', error.message);
      }
      // Poursuivre tout de même la synchronisation granulaire individuelle (avec repli RPC)
    }

    // Synchronisation granulaire dans les tables individuelles Supabase (en tâche de fond sécurisée)
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

  let isDisposed = false;

  const channel = supabase
    .channel('agency_data_realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'agency_data',
        filter: `id=eq.${AGENCY_RECORD_ID}`,
      },
      (payload) => {
        if (isDisposed) return;
        try {
          const newRecord = payload.new as any;
          if (newRecord && newRecord.data && typeof newRecord.data === 'object') {
            onData({
              ...(newRecord.data as MorvelloCloudData),
              updatedAt: newRecord.updated_at,
              updatedBy: newRecord.updated_by,
            });
          }
        } catch (err) {
          console.warn('[Supabase Realtime] Error processing record:', err);
        }
      }
    )
    .subscribe((status, err) => {
      if (isDisposed) return;
      if (status === 'CHANNEL_ERROR' || err) {
        if (onError && !isAbortException(err)) {
          onError(err || new Error('Supabase Realtime Channel Error'));
        }
      }
    });

  return () => {
    isDisposed = true;
    supabase.removeChannel(channel);
  };
}

/**
 * Save user profile in Supabase profiles table
 */
export async function saveUserProfileToSupabase(
  uid: string,
  profile: { role: string; email: string; name?: string; phone?: string; permissions?: any }
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: uid,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        role: profile.role,
        permissions: profile.permissions || {},
        phone: profile.phone || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      if (error.code !== 'PGRST205') {
        console.warn('[Supabase] Could not update profile:', error.message);
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronise les entités individuelles dans leurs tables PostgreSQL dédiées
 */
export async function syncIndividualTables(payload: Partial<MorvelloCloudData>): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    // 1. Véhicules
    if (payload.vehicles && Array.isArray(payload.vehicles) && payload.vehicles.length > 0) {
      for (const v of payload.vehicles) {
        const assignedMgrId =
          v.assignedManagerId ||
          (v.assignedManagerName && payload.users?.find((u) => u.name.toLowerCase() === v.assignedManagerName?.toLowerCase())?.id) ||
          null;
        const createdBy = (v as any).createdBy || (v as any).proposedBy || (payload.updatedBy ? String(payload.updatedBy) : null);

        await supabase.from('vehicles').upsert(
          {
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
              assignedManagerId: assignedMgrId || v.assignedManagerId,
              createdBy: createdBy || (v as any).createdBy,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // 2. Clients
    if (payload.clients && Array.isArray(payload.clients) && payload.clients.length > 0) {
      for (const c of payload.clients) {
        const assignedMgrId =
          c.assignedManagerId ||
          payload.contracts?.find(
            (cnt) => cnt.clientId === c.id || (cnt.clientSnapshot && cnt.clientSnapshot.id === c.id)
          )?.assignedManagerId ||
          (c.assignedManagerName && payload.users?.find((u) => u.name.toLowerCase() === c.assignedManagerName?.toLowerCase())?.id) ||
          null;
        const createdBy = (c as any).createdBy || (payload.updatedBy ? String(payload.updatedBy) : null);

        const clientPayload = {
          ...c,
          assignedManagerId: assignedMgrId || c.assignedManagerId,
          createdBy: createdBy || (c as any).createdBy,
        };

        // 2a. Tenter d'abord la RPC SECURITY DEFINER (résout immédiatement les blocages RLS 42501)
        let rpcSuccess = false;
        try {
          const { error: rpcErr } = await supabase.rpc('sync_client_record', {
            client_data: clientPayload,
          });
          if (!rpcErr) {
            rpcSuccess = true;
          }
        } catch {
          // RPC pas encore créée
        }

        // 2b. Repli vers l'upsert standard si la RPC n'a pas répondu
        if (!rpcSuccess) {
          const { error: clientUpsertErr } = await supabase.from('clients').upsert(
            {
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
            },
            { onConflict: 'id' }
          );

          if (clientUpsertErr) {
            if (clientUpsertErr.code === '42501') {
              console.warn(
                `[Supabase Sync] Blocage RLS (42501) sur le client "${c.firstName} ${c.lastName}". Exécutez fix_supabase_sync_rls.sql dans Supabase SQL Editor.`
              );
            } else {
              console.warn(
                `[Supabase Sync] Note upsert client "${c.firstName} ${c.lastName}":`,
                clientUpsertErr.message
              );
            }
          }
        }
      }
    }

    // 3. Contrats
    if (payload.contracts && Array.isArray(payload.contracts) && payload.contracts.length > 0) {
      for (const cnt of payload.contracts) {
        const assignedMgrId =
          cnt.assignedManagerId ||
          payload.vehicles?.find(
            (v) =>
              v.id === cnt.vehicleId ||
              (cnt.vehicleSnapshot?.plate && v.plate.trim() === cnt.vehicleSnapshot.plate.trim())
          )?.assignedManagerId ||
          (cnt.assignedManagerName && payload.users?.find((u) => u.name.toLowerCase() === cnt.assignedManagerName?.toLowerCase())?.id) ||
          null;
        const createdBy = cnt.createdBy || (payload.updatedBy ? String(payload.updatedBy) : null);

        await supabase.from('contracts').upsert(
          {
            id: cnt.id,
            contract_number: cnt.contractNumber,
            status: cnt.status,
            client_id: cnt.clientId,
            vehicle_id: cnt.vehicleId,
            start_date: cnt.startDate,
            end_date: cnt.endDate,
            total_amount: cnt.totalAmount,
            deposit_amount: cnt.depositAmount,
            assigned_manager_id: assignedMgrId,
            created_by: createdBy,
            data: {
              ...cnt,
              assignedManagerId: assignedMgrId || cnt.assignedManagerId,
              createdBy: createdBy || cnt.createdBy,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // 4. Cautions
    if (payload.deposits && Array.isArray(payload.deposits) && payload.deposits.length > 0) {
      for (const dep of payload.deposits) {
        const matchedContract = payload.contracts?.find(
          (cnt) => cnt.id === dep.contractId || cnt.contractNumber === dep.contractNumber
        );
        const matchedVehicle = payload.vehicles?.find(
          (v) => dep.vehiclePlate && v.plate.trim() === dep.vehiclePlate.trim()
        );
        const assignedMgrId =
          dep.assignedManagerId ||
          matchedContract?.assignedManagerId ||
          matchedVehicle?.assignedManagerId ||
          (dep.assignedManagerName && payload.users?.find((u) => u.name.toLowerCase() === dep.assignedManagerName?.toLowerCase())?.id) ||
          null;
        const createdBy =
          dep.createdBy ||
          dep.receivedBy ||
          (payload.updatedBy ? String(payload.updatedBy) : null);

        await supabase.from('deposits').upsert(
          {
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
              assignedManagerId: assignedMgrId || dep.assignedManagerId,
              createdBy: createdBy || dep.createdBy,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // 5. Profils Collaborateurs & Managers (incluant Ouahib, etc.)
    if (payload.users && Array.isArray(payload.users) && payload.users.length > 0) {
      for (const u of payload.users) {
        await supabase.from('profiles').upsert(
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

  let syncedCount = 0;
  let hasRlsError = false;
  let lastErrorMessage = '';

  for (const c of clients) {
    // 1. Tenter la RPC SECURITY DEFINER en priorité
    let succeeded = false;
    try {
      const { error: rpcErr } = await supabase.rpc('sync_client_record', {
        client_data: c,
      });
      if (!rpcErr) {
        succeeded = true;
        syncedCount++;
      }
    } catch {
      // RPC non disponible
    }

    // 2. Si la RPC n'a pas répondu, tenter l'upsert standard
    if (!succeeded) {
      try {
        const { error: upsertErr } = await supabase.from('clients').upsert(
          {
            id: c.id,
            first_name: c.firstName || '',
            last_name: c.lastName || '',
            doc_type: c.docType || 'CIN',
            doc_number: c.docNumber || '',
            phone: c.phone || '',
            email: c.email || '',
            contract_count: c.contractCount || 0,
            assigned_manager_id: c.assignedManagerId || null,
            created_by: c.createdBy || 'system',
            data: c,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        if (!upsertErr) {
          syncedCount++;
        } else {
          lastErrorMessage = upsertErr.message;
          if (upsertErr.code === '42501' || upsertErr.message?.includes('row-level security')) {
            hasRlsError = true;
          }
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || String(err);
      }
    }
  }

  return {
    success: syncedCount === clients.length,
    syncedCount,
    totalCount: clients.length,
    hasRlsError,
    error: hasRlsError
      ? 'Erreur 42501 (RLS Supabase) : La politique de sécurité Supabase bloque l’écriture sans session Auth. Exécutez fix_supabase_sync_rls.sql.'
      : lastErrorMessage || undefined,
  };
}


