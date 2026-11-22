import { supabase, isSupabaseConfigured } from './supabase';

/** Contrat édité pour une agence partenaire, tel qu'enregistré dans la table `partner_contracts`. */
export interface PartnerContractRecord<F = unknown> {
  id: string;
  /** Agence partenaire (id de `partner_agencies`) pour laquelle le contrat est édité. */
  partnerAgencyId: string;
  partnerAgencyName: string;
  form: F;
  createdAt?: string;
  updatedAt?: string;
}

export interface PartnerContractsResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const TABLE = 'partner_contracts';

function describeError(error: { message?: string; code?: string }): string {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'La table « partner_contracts » n’existe pas encore : exécutez supabase_migration_partner_contracts.sql dans Supabase.';
  }
  if (error.code === '42501') return 'Accès refusé : seul l’administrateur peut enregistrer des contrats.';
  return error.message || 'Erreur inconnue';
}

export function contractToRow<F>(record: PartnerContractRecord<F>) {
  return {
    id: record.id,
    data: { partnerAgencyId: record.partnerAgencyId, partnerAgencyName: record.partnerAgencyName, form: record.form },
    updated_at: new Date().toISOString(),
  };
}

export function contractFromRow<F>(row: {
  id: string;
  data?: { partnerAgencyId?: string; partnerAgencyName?: string; form?: F } | null;
  created_at?: string;
  updated_at?: string;
}): PartnerContractRecord<F> {
  const data = row.data || {};
  return {
    id: row.id,
    partnerAgencyId: data.partnerAgencyId || '',
    partnerAgencyName: data.partnerAgencyName || '',
    form: (data.form || {}) as F,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPartnerContracts<F>(): Promise<PartnerContractsResult<PartnerContractRecord<F>[]>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Serveur non configuré.' };
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, data, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: describeError(error) };
  return { ok: true, value: (data || []).map((row) => contractFromRow<F>(row as never)) };
}

export async function savePartnerContract<F>(record: PartnerContractRecord<F>): Promise<PartnerContractsResult<true>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Serveur non configuré.' };
  const { error } = await supabase.from(TABLE).upsert(contractToRow(record), { onConflict: 'id' });
  return error ? { ok: false, error: describeError(error) } : { ok: true, value: true };
}

export async function deletePartnerContract(id: string): Promise<PartnerContractsResult<true>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Serveur non configuré.' };
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return error ? { ok: false, error: describeError(error) } : { ok: true, value: true };
}
