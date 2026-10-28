import { supabase, SUPABASE_URL, isSupabaseConfigured } from './supabase';
import { migrateEmbeddedFiles, storeEmbeddedFile, type MigrationOutcome, type StorageApi, type StorageKind, type UploadResult } from './storageFiles';

/**
 * Accès Supabase Storage depuis le navigateur. La logique (références, empreintes, repli) vit dans storageFiles.ts.
 */

function toUploadResult(error: { message?: string; statusCode?: string | number; status?: number } | null): UploadResult {
  if (!error) return { ok: true };
  const message = error.message ?? 'Envoi impossible';
  const status = String(error.statusCode ?? error.status ?? '');
  if (status === '409' || /already exists|duplicate/i.test(message)) return { ok: false, duplicate: true, error: message };
  // Espace absent, ou politiques non installées : même traitement, on retombe sur l'ancien comportement
  if (status === '404' || /bucket not found|row-level security|not authorized|unauthorized/i.test(message)) {
    return { ok: false, missingBucket: true, error: message };
  }
  return { ok: false, error: message };
}

const api: StorageApi = {
  baseUrl: SUPABASE_URL,

  async upload(bucket, path, bytes, mime) {
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: '31536000',
    });
    return toUploadResult(error as { message?: string; statusCode?: string } | null);
  },

  async signedUrl(bucket, path, ttlSeconds) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
    return error ? null : data?.signedUrl ?? null;
  },

  async download(url) {
    try {
      const res = await fetch(url);
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  },
};

/** Null quand Supabase n'est pas configuré (aperçu local) : l'app garde alors l'ancien comportement. */
export const browserStorageApi: StorageApi | null = isSupabaseConfigured ? api : null;

/** Range une image ou un PDF intégré dans Storage ; rend la référence, ou la valeur d'origine si l'envoi n'est pas possible. */
export function storeFile(value: string, kind: StorageKind): Promise<string> {
  return storeEmbeddedFile(value, kind, browserStorageApi);
}

/** Déplace tous les fichiers intégrés d'une fiche vers Storage. */
export function migrateRecordFiles<T>(record: T): Promise<MigrationOutcome<T>> {
  return migrateEmbeddedFiles(record, browserStorageApi);
}
