/**
 * Écriture sûre dans localStorage.
 *
 * Safari sur iPhone limite le stockage d'un site à environ 5 Mo. L'app y garde une copie locale des véhicules, clients,
 * contrats… et une écriture qui dépasse la limite lève « The quota has been exceeded », ce qui faisait planter
 * toute l'application. Ici, l'écriture ne lève jamais : on libère de la place, on réessaie avec une copie allégée
 * (sans photos ni scans), et à défaut on renonce à la copie locale, les données restant sur le serveur.
 */

export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number; message?: string } | null;
  if (!e) return false;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(e.message ?? '')
  );
}

/** Clés de simple confort (historique de l'assistant…) : on les sacrifie d'abord pour garder les données de travail. */
const DISPOSABLE_PREFIXES = ['morvello_ai_chat_'];

const DEFAULT_MIN_LENGTH = 2000;

/**
 * Copie d'une valeur JSON où les longues images/scans (« data:… ») sont remplacées par une chaîne vide.
 * Le serveur garde l'original ; la copie locale n'est qu'un cache.
 */
export function stripDataUrls<T>(value: T, minLength = DEFAULT_MIN_LENGTH): T {
  if (typeof value === 'string') {
    return (value.startsWith('data:') && value.length >= minLength ? '' : value) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => stripDataUrls(v, minLength)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = stripDataUrls(v, minLength);
    return out as T;
  }
  return value;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'length' | 'key'>;

const listeners = new Set<(key: string) => void>();
const reported = new Set<string>();

/** Prévient (une fois par clé et par session) qu'une copie locale n'a pas pu être enregistrée. */
export function onStorageFull(listener: (key: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function report(key: string): void {
  if (reported.has(key)) return;
  reported.add(key);
  console.warn(`[Stockage] Espace local plein : la copie « ${key} » n'est pas conservée sur cet appareil (les données restent sur le serveur).`);
  listeners.forEach((fn) => fn(key));
}

function freeDisposable(storage: StorageLike): number {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && DISPOSABLE_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
  }
  doomed.forEach((k) => storage.removeItem(k));
  return doomed.length;
}

export interface SafeSetOptions {
  /** Version allégée à tenter si la version complète ne rentre pas. */
  lite?: () => string;
  storage?: StorageLike;
}

/** Écrit sans jamais lever. Renvoie true si une version a bien été enregistrée. */
export function safeSetItem(key: string, value: string, options: SafeSetOptions = {}): boolean {
  const storage: StorageLike | undefined = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  if (!storage) return false;

  const attempt = (v: string): 'ok' | 'quota' | 'other' => {
    try {
      storage.setItem(key, v);
      return 'ok';
    } catch (err) {
      return isQuotaError(err) ? 'quota' : 'other';
    }
  };

  let result = attempt(value);
  if (result === 'ok') return true;
  if (result === 'other') return false;

  // 1. Libérer l'historique de l'assistant, puis réessayer la version complète
  if (freeDisposable(storage) > 0) {
    result = attempt(value);
    if (result === 'ok') return true;
  }

  // 2. Version allégée (sans photos ni scans)
  if (options.lite) {
    let liteValue: string | null = null;
    try {
      liteValue = options.lite();
    } catch {
      liteValue = null;
    }
    if (liteValue !== null) {
      result = attempt(liteValue);
      if (result === 'ok') {
        report(key);
        return true;
      }
    }
  }

  // 3. Renoncer : une ancienne copie périmée est plus trompeuse qu'une absence de copie
  try {
    storage.removeItem(key);
  } catch {
    /* rien de plus à faire */
  }
  report(key);
  return false;
}

/** Écrit une valeur JSON ; la version allégée retire les images et scans intégrés. */
export function safeSetJson(key: string, data: unknown, options: Omit<SafeSetOptions, 'lite'> & { lite?: boolean } = {}): boolean {
  let json: string;
  try {
    json = JSON.stringify(data);
  } catch {
    return false;
  }
  const { lite = true, ...rest } = options;
  return safeSetItem(key, json, { ...rest, lite: lite ? () => JSON.stringify(stripDataUrls(data)) : undefined });
}
