import { supabase, isSupabaseConfigured } from './supabase';

/** Identité d'une agence partenaire, telle qu'enregistrée dans la table `partner_agencies`. */
export interface PartnerAgencyRecord {
  id: string;
  name: string;
  logo: string;
  city: string;
  legalLine: string;
  address: string;
  phone1: string;
  phone2: string;
  assistancePhone: string;
  email: string;
  website: string;
  taxId: string;
  rc: string;
  ice: string;
  patente: string;
}

/** `ok` vrai : `value` est présent ; sinon `error` explique l'échec. */
export interface PartnerAgenciesResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

const TABLE = 'partner_agencies';

export function agencyToRow(agency: PartnerAgencyRecord) {
  const { id, ...data } = agency;
  return { id, data, updated_at: new Date().toISOString() };
}

export function agencyFromRow(row: { id: string; data?: Partial<PartnerAgencyRecord> | null }, blank: PartnerAgencyRecord): PartnerAgencyRecord {
  return { ...blank, ...(row.data || {}), id: row.id };
}

function describeError(error: { message?: string; code?: string }): string {
  // 42P01 / PGRST205 : la table n'existe pas encore (migration SQL non exécutée)
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'La table « partner_agencies » n’existe pas encore : exécutez supabase_migration_partner_agencies.sql dans Supabase.';
  }
  if (error.code === '42501') return 'Accès refusé : seul l’administrateur peut enregistrer des agences.';
  return error.message || 'Erreur inconnue';
}

export async function fetchPartnerAgencies(blank: PartnerAgencyRecord): Promise<PartnerAgenciesResult<PartnerAgencyRecord[]>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Serveur non configuré.' };
  const { data, error } = await supabase.from(TABLE).select('id, data, created_at').order('created_at', { ascending: true });
  if (error) return { ok: false, error: describeError(error) };
  return { ok: true, value: (data || []).map((row) => agencyFromRow(row as { id: string; data: Partial<PartnerAgencyRecord> }, blank)) };
}

export async function savePartnerAgency(agency: PartnerAgencyRecord): Promise<PartnerAgenciesResult<true>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Serveur non configuré.' };
  const { error } = await supabase.from(TABLE).upsert(agencyToRow(agency), { onConflict: 'id' });
  return error ? { ok: false, error: describeError(error) } : { ok: true, value: true };
}

export async function deletePartnerAgency(id: string): Promise<PartnerAgenciesResult<true>> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Serveur non configuré.' };
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  return error ? { ok: false, error: describeError(error) } : { ok: true, value: true };
}
