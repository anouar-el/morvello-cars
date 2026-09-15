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
            '[Supabase] Exécutez le script supabase_schema.sql dans Supabase pour activer la sauvegarde PostgreSQL.'
          );
          hasWarnedMissingSchema = true;
        }
        return false;
      }
      console.error('[Supabase Sync] Failed to save agency data:', error.message);
      return false;
    }

    // Synchronisation granulaire dans les tables individuelles Supabase (en tâche de fond sécurisée)
    syncIndividualTables(payload).catch((err) => {
      console.warn('[Supabase Sync] Granular tables sync note:', err);
    });

    return true;
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
            assigned_manager_id: v.assignedManagerId,
            approval_status: v.approvalStatus || 'approved',
            data: v,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // 2. Clients
    if (payload.clients && Array.isArray(payload.clients) && payload.clients.length > 0) {
      for (const c of payload.clients) {
        await supabase.from('clients').upsert(
          {
            id: c.id,
            first_name: c.firstName,
            last_name: c.lastName,
            doc_type: c.docType,
            doc_number: c.docNumber,
            phone: c.phone,
            email: c.email,
            contract_count: c.contractCount || 0,
            data: c,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // 3. Contrats
    if (payload.contracts && Array.isArray(payload.contracts) && payload.contracts.length > 0) {
      for (const cnt of payload.contracts) {
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
            created_by: cnt.createdBy,
            data: cnt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    // 4. Cautions
    if (payload.deposits && Array.isArray(payload.deposits) && payload.deposits.length > 0) {
      for (const dep of payload.deposits) {
        await supabase.from('deposits').upsert(
          {
            id: dep.id,
            contract_id: dep.contractId,
            client_name: dep.clientName,
            amount: dep.amount,
            status: dep.status === 'held' ? 'pending' : dep.status,
            method: dep.method,
            data: dep,
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

