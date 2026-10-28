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
  /**
   * Données qui n'existent QUE sur cet appareil (journal, réglages) : en dernier recours on garde l'ancienne copie
   * au lieu de la supprimer. Faux pour un simple cache du serveur, où une copie périmée trompe plus qu'elle n'aide.
   */
  keepOnFail?: boolean;
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

  // 3. Renoncer : pour un cache, une ancienne copie périmée est plus trompeuse qu'une absence de copie
  if (!options.keepOnFail) {
    try {
      storage.removeItem(key);
    } catch {
      /* rien de plus à faire */
    }
  }
  report(key);
  return false;
}

/**
 * Budget d'une copie locale, en caractères. Safari sur iPhone offre environ 2,5 millions de caractères au total
 * pour tout le site : une seule copie ne doit pas en prendre plus du quart.
 */
export const KEY_BUDGET_CHARS = 600_000;

/**
 * Écrit une valeur JSON ; la version allégée retire les images et scans intégrés.
 * Au-delà du budget, la copie allégée est utilisée d'emblée : le serveur garde les originaux, la copie locale n'est qu'un cache.
 */
export function safeSetJson(
  key: string,
  data: unknown,
  options: Omit<SafeSetOptions, 'lite'> & { lite?: boolean; budget?: number } = {}
): boolean {
  let json: string;
  try {
    json = JSON.stringify(data);
  } catch {
    return false;
  }
  const { lite = true, budget = KEY_BUDGET_CHARS, ...rest } = options;
  const liteJson = () => JSON.stringify(stripDataUrls(data));
  if (lite && json.length > budget) {
    try {
      const light = liteJson();
      // Rien à retirer (pas d'images intégrées) : on garde la copie complète, c'est la plus fidèle
      if (light.length < json.length) json = light;
    } catch {
      /* on tente la copie complète */
    }
  }
  return safeSetItem(key, json, { ...rest, lite: lite ? liteJson : undefined });
}

export interface StorageUsage {
  total: number;
  /** Clés de l'app, de la plus lourde à la plus légère. */
  keys: Array<{ key: string; chars: number }>;
}

/** Place prise par le stockage local, clé par clé (diagnostic). */
export function measureLocalStorage(storage?: Pick<Storage, 'getItem' | 'key' | 'length'>): StorageUsage {
  const s = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  const keys: Array<{ key: string; chars: number }> = [];
  if (s) {
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (!key) continue;
      keys.push({ key, chars: key.length + (s.getItem(key)?.length ?? 0) });
    }
  }
  keys.sort((a, b) => b.chars - a.chars);
  return { total: keys.reduce((sum, k) => sum + k.chars, 0), keys };
}
