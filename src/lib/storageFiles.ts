/**
 * Fichiers (photos, scans, signatures) rangés dans Supabase Storage au lieu d'être intégrés en base64 dans les fiches.
 *
 * Une fiche ne garde qu'une courte référence « sbs://<espace>/<chemin> ». Les fichiers sont nommés d'après leur
 * empreinte SHA-256 : un même scan recopié dans dix contrats n'est stocké qu'une fois.
 *
 * Module sans dépendance navigateur : l'accès réseau passe par `StorageApi`, injecté (donc testable).
 * Principe de sécurité : l'envoi ne lève jamais ; en cas d'échec on rend l'image d'origine intacte, rien n'est perdu.
 */

export const REF_PREFIX = 'sbs://';

export type StorageKind = 'vehicle-photo' | 'client-doc' | 'signature' | 'inspection';

interface BucketInfo {
  bucket: string;
  isPublic: boolean;
}

/** Les photos de voitures ne sont pas sensibles : espace public, servi et mis en cache directement. Le reste est privé. */
export const BUCKETS: Record<StorageKind, BucketInfo> = {
  'vehicle-photo': { bucket: 'vehicle-photos', isPublic: true },
  'client-doc': { bucket: 'morvello-files', isPublic: false },
  signature: { bucket: 'morvello-files', isPublic: false },
  inspection: { bucket: 'morvello-files', isPublic: false },
};

const PUBLIC_BUCKETS = new Set(['vehicle-photos']);

/** En dessous, une image intégrée (signature minuscule, icône) ne vaut pas un aller-retour réseau. */
export const MIN_EMBED_LENGTH = 4000;

export function makeRef(bucket: string, path: string): string {
  return `${REF_PREFIX}${bucket}/${path}`;
}

export function isStorageRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(REF_PREFIX);
}

export function parseRef(ref: string): { bucket: string; path: string } | null {
  if (!isStorageRef(ref)) return null;
  const rest = ref.slice(REF_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

/** Image ou PDF intégré (data:) assez gros pour mériter d'être déplacé dans Storage. */
export function isEmbeddedFile(value: unknown, minLength = MIN_EMBED_LENGTH): value is string {
  return typeof value === 'string' && value.length >= minLength && /^data:(image\/(jpeg|png|webp)|application\/pdf)[;,]/.test(value);
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const isBase64 = /;base64/i.test(match[2]);
  const payload = match[3];
  try {
    if (isBase64) {
      const bin = atob(payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mime };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mime };
  } catch {
    return null;
  }
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export function extensionFor(mime: string): string | null {
  return EXT[mime] ?? null;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Chemin dans l'espace : deux caractères d'empreinte comme sous-dossier, pour ne pas tout mettre au même niveau. */
export function objectPath(hash: string, ext: string): string {
  return `${hash.slice(0, 2)}/${hash}.${ext}`;
}

export function publicUrl(baseUrl: string, bucket: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${path}`;
}

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

// ---------------------------------------------------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------------------------------------------------

export interface UploadResult {
  ok: boolean;
  /** Le fichier existe déjà (même empreinte) : c'est un succès. */
  duplicate?: boolean;
  /** L'espace n'existe pas encore (migration SQL pas exécutée). */
  missingBucket?: boolean;
  error?: string;
}

export interface StorageApi {
  upload(bucket: string, path: string, bytes: Uint8Array, mime: string): Promise<UploadResult>;
  /** Lien signé de courte durée vers un fichier privé ; null si indisponible. */
  signedUrl(bucket: string, path: string, ttlSeconds: number): Promise<string | null>;
  /** Télécharge le contenu d'une adresse (lien signé) ; null en cas d'échec. */
  download(url: string): Promise<Blob | null>;
  baseUrl: string;
}

let unavailableUntil = 0;
const UNAVAILABLE_COOLDOWN_MS = 5 * 60 * 1000;

/** Après un « espace introuvable », on cesse d'essayer pendant quelques minutes : l'app garde son comportement d'avant. */
export function isStorageTemporarilyUnavailable(now = Date.now()): boolean {
  return now < unavailableUntil;
}

export function resetStorageAvailability(): void {
  unavailableUntil = 0;
}

export interface StoreOptions {
  /** Longueur minimale à partir de laquelle on envoie ; défaut : MIN_EMBED_LENGTH. */
  minLength?: number;
  now?: () => number;
}

/**
 * Range un fichier intégré dans Storage et rend sa référence. Ne lève jamais : toute impossibilité (réseau,
 * espace absent, format inconnu, trop petit) rend la valeur d'origine inchangée.
 */
export async function storeEmbeddedFile(value: string, kind: StorageKind, api: StorageApi | null, options: StoreOptions = {}): Promise<string> {
  try {
    if (!api || isStorageRef(value) || !isEmbeddedFile(value, options.minLength ?? MIN_EMBED_LENGTH)) return value;
    if (isStorageTemporarilyUnavailable(options.now?.())) return value;

    const decoded = dataUrlToBytes(value);
    if (!decoded) return value;
    const ext = extensionFor(decoded.mime);
    if (!ext) return value;

    const { bucket } = BUCKETS[kind];
    const hash = await sha256Hex(decoded.bytes);
    const path = objectPath(hash, ext);
    const result = await api.upload(bucket, path, decoded.bytes, decoded.mime);

    if (result.ok || result.duplicate) return makeRef(bucket, path);
    if (result.missingBucket) unavailableUntil = (options.now?.() ?? Date.now()) + UNAVAILABLE_COOLDOWN_MS;
    return value;
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Parcours des fiches (migration et nettoyage)
// ---------------------------------------------------------------------------------------------------------------------

/** Nombre et poids des fichiers intégrés dans une valeur JSON quelconque. */
export function measureEmbedded(value: unknown, minLength = MIN_EMBED_LENGTH): { count: number; bytes: number } {
  let count = 0;
  let bytes = 0;
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (isEmbeddedFile(v, minLength)) {
        count += 1;
        bytes += v.length;
      }
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(walk);
  };
  walk(value);
  return { count, bytes };
}

/** Quel espace utiliser selon l'endroit où le fichier se trouve dans la fiche. */
export function kindForKey(key: string, path: string[] = []): StorageKind {
  if (key === 'photoUrl') return 'vehicle-photo';
  if (/signature/i.test(key)) return 'signature';
  if (path.some((p) => /inspection|photos/i.test(p))) return 'inspection';
  return 'client-doc';
}

export interface MigrationOutcome<T> {
  value: T;
  moved: number;
  failed: number;
}

/**
 * Copie de la valeur où chaque fichier intégré est remplacé par sa référence Storage.
 * Un envoi raté laisse l'image d'origine en place (comptée dans `failed`) : on peut relancer plus tard.
 */
export async function migrateEmbeddedFiles<T>(
  value: T,
  api: StorageApi | null,
  kindFor: (key: string, path: string[]) => StorageKind = kindForKey,
  options: StoreOptions = {}
): Promise<MigrationOutcome<T>> {
  let moved = 0;
  let failed = 0;
  const walk = async (v: unknown, key: string, path: string[]): Promise<unknown> => {
    if (typeof v === 'string') {
      if (!isEmbeddedFile(v, options.minLength ?? MIN_EMBED_LENGTH)) return v;
      const out = await storeEmbeddedFile(v, kindFor(key, path), api, options);
      if (out !== v) moved += 1;
      else failed += 1;
      return out;
    }
    if (Array.isArray(v)) {
      const next: unknown[] = [];
      for (let i = 0; i < v.length; i++) next.push(await walk(v[i], key, [...path, String(i)]));
      return next;
    }
    if (v && typeof v === 'object') {
      const next: Record<string, unknown> = {};
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) next[k] = await walk(child, k, [...path, k]);
      return next;
    }
    return v;
  };
  const result = (await walk(value, '', [])) as T;
  return { value: result, moved, failed };
}

// ---------------------------------------------------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------------------------------------------------

const objectUrlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();
const MAX_CACHED_OBJECT_URLS = 80;

const SIGNED_URL_TTL_SECONDS = 120;

/**
 * Adresse affichable d'une valeur de fiche.
 * - data:, https:, blob: → telle quelle
 * - référence vers un espace public → adresse publique (immédiate)
 * - référence privée → fichier téléchargé via un lien signé puis servi en blob: (compatible CSP et capture PDF)
 */
export function resolveSync(value: string | null | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  if (!isStorageRef(value)) return value;
  const parsed = parseRef(value);
  if (!parsed) return undefined;
  if (isPublicBucket(parsed.bucket)) return publicUrl(baseUrl, parsed.bucket, parsed.path);
  return objectUrlCache.get(value);
}

export async function resolveRef(ref: string, api: StorageApi): Promise<string | null> {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  if (isPublicBucket(parsed.bucket)) return publicUrl(api.baseUrl, parsed.bucket, parsed.path);

  const cached = objectUrlCache.get(ref);
  if (cached) return cached;
  const pending = inFlight.get(ref);
  if (pending) return pending;

  const job = (async () => {
    try {
      const signed = await api.signedUrl(parsed.bucket, parsed.path, SIGNED_URL_TTL_SECONDS);
      if (!signed) return null;
      const blob = await api.download(signed);
      if (!blob) return null;
      const objectUrl = URL.createObjectURL(blob);
      objectUrlCache.set(ref, objectUrl);
      if (objectUrlCache.size > MAX_CACHED_OBJECT_URLS) {
        const oldest = objectUrlCache.keys().next().value;
        if (oldest !== undefined) {
          const url = objectUrlCache.get(oldest);
          objectUrlCache.delete(oldest);
          if (url) URL.revokeObjectURL(url);
        }
      }
      return objectUrl;
    } catch {
      return null;
    } finally {
      inFlight.delete(ref);
    }
  })();
  inFlight.set(ref, job);
  return job;
}
