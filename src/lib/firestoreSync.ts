import {
  isSupabaseConfigured,
} from './supabase';
import {
  fetchRemoteAgencyDataFromSupabase,
  saveRemoteAgencyDataToSupabase,
  subscribeToRemoteAgencyDataFromSupabase,
  saveUserProfileToSupabase,
} from './supabaseSync';
import {
  Client,
  Driver,
  Vehicle,
  Contract,
  CompanySettings,
  AuditLog,
  User,
  TermsVersion,
  DepositRecord,
  PaymentRecord,
  AiAssistantSettings,
} from '../types';

// NOTE: Ce module s'appelait historiquement "firestoreSync" car il synchronisait les
// données d'agence avec Firebase Cloud Firestore. Firebase a été retiré de ce chemin de
// synchronisation (Supabase est l'unique source de vérité pour les données et l'auth,
// cf. brief projet). Le nom du fichier est conservé pour ne pas casser les imports
// existants (AppContext.tsx, teamAdminService.ts) ; ce module ne fait plus que déléguer
// à src/lib/supabaseSync.ts.

export interface MorvelloCloudData {
  clients?: Client[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
  contracts?: Contract[];
  deposits?: DepositRecord[];
  companySettings?: CompanySettings;
  aiSettings?: AiAssistantSettings;
  termsVersion?: TermsVersion;
  users?: User[];
  auditLogs?: AuditLog[];
  updatedAt?: string;
  updatedBy?: string;
}

export async function fetchRemoteAgencyData(): Promise<MorvelloCloudData | null> {
  if (!isSupabaseConfigured) {
    return null;
  }
  try {
    return await fetchRemoteAgencyDataFromSupabase();
  } catch (err) {
    console.warn('[Data Sync] Supabase fetch error:', err);
    return null;
  }
}

export async function saveRemoteAgencyData(data: Partial<MorvelloCloudData>): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }
  try {
    return await saveRemoteAgencyDataToSupabase(data);
  } catch (err) {
    console.warn('[Data Sync] Supabase save error:', err);
    return false;
  }
}

/**
 * Real-time listener for multi-workstation agency data synchronization (Supabase Realtime).
 */
export function subscribeToRemoteAgencyData(
  onData: (data: MorvelloCloudData) => void,
  onError?: (err: any) => void
): () => void {
  return subscribeToRemoteAgencyDataFromSupabase(onData, onError);
}

/**
 * Sync individual user profile and RBAC role in Supabase profiles.
 */
export async function saveUserProfile(
  uid: string,
  profile: { role: string; email: string; name?: string; phone?: string; permissions?: any }
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }
  try {
    return await saveUserProfileToSupabase(uid, profile);
  } catch (err) {
    console.warn('[Supabase Profile] update notice:', err);
    return false;
  }
}
