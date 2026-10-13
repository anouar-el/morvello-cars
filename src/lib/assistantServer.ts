import { mapVehicleRow, mapContractRow, mapDepositRow } from './rowMappers';
import type { Vehicle, Contract, DepositRecord } from '../types';

/*
 * Briques côté serveur de l'assistant IA. Module pur (sans Express ni SDK) pour rester testable :
 *  - nettoyage et plafonnement de TOUT ce qui vient du navigateur (message, historique, charte) ;
 *  - lecture des données métier par le serveur, avec le jeton de l'utilisateur (donc sous RLS), au lieu
 *    de faire confiance à ce que le navigateur envoie ;
 *  - délimitation des données dans l'invite et message d'erreur public sans fuite d'information.
 */

export const ASSISTANT_LIMITS = {
  message: 4000,
  historyItems: 8,
  historyItemChars: 4000,
  brandVision: 2000,
  customInstructions: 3000,
  signatureGreeting: 200,
  standardPricingRule: 1000,
  listItems: 12,
  listItemChars: 300,
  samples: 5,
  sampleScenarioChars: 200,
  sampleReplyChars: 1500,
  rowsPerTable: 1000,
  modelTimeoutMs: 25_000,
} as const;

// Doit rester aligné sur AiToneOfVoice / AiLanguagePreference (src/types.ts).
const TONES = ['luxury_concierge', 'business_formal', 'warm_commercial', 'direct_operational'] as const;
const LANGUAGES = ['french_darija', 'french_only', 'darija_arabic_french'] as const;

export interface AssistantSettings {
  brandVision: string;
  toneOfVoice: string;
  languagePreference: string;
  signatureGreeting: string;
  standardPricingRule: string;
  customInstructions: string;
  keyValues: string[];
  prohibitedBehaviors: string[];
  sampleResponses: { scenario: string; idealReply: string }[];
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function clipList(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => clip(v, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Charte de l'assistant : valeurs inconnues écartées, longueurs plafonnées. */
export function sanitizeAssistantSettings(raw: unknown): AssistantSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const L = ASSISTANT_LIMITS;
  const tone = typeof s.toneOfVoice === 'string' ? s.toneOfVoice : '';
  const lang = typeof s.languagePreference === 'string' ? s.languagePreference : '';

  const samples = Array.isArray(s.sampleResponses) ? s.sampleResponses : [];

  return {
    brandVision: clip(s.brandVision, L.brandVision),
    toneOfVoice: (TONES as readonly string[]).includes(tone) ? tone : 'luxury_concierge',
    languagePreference: (LANGUAGES as readonly string[]).includes(lang) ? lang : 'french_darija',
    signatureGreeting: clip(s.signatureGreeting, L.signatureGreeting),
    standardPricingRule: clip(s.standardPricingRule, L.standardPricingRule),
    customInstructions: clip(s.customInstructions, L.customInstructions),
    keyValues: clipList(s.keyValues, L.listItems, L.listItemChars),
    prohibitedBehaviors: clipList(s.prohibitedBehaviors, L.listItems, L.listItemChars),
    sampleResponses: samples
      .slice(0, L.samples)
      .map((item) => {
        const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return { scenario: clip(it.scenario, L.sampleScenarioChars), idealReply: clip(it.idealReply, L.sampleReplyChars) };
      })
      .filter((it) => it.idealReply),
  };
}

export function sanitizeMessage(raw: unknown): string | null {
  const text = clip(raw, ASSISTANT_LIMITS.message);
  return text || null;
}

export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

/** Historique envoyé par le navigateur : rôles validés, longueurs et nombre plafonnés. */
export function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-ASSISTANT_LIMITS.historyItems)) {
    const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const content = clip(it.content, ASSISTANT_LIMITS.historyItemChars);
    if (!content) continue;
    turns.push({ role: it.role === 'model' || it.role === 'assistant' ? 'model' : 'user', content });
  }
  return turns;
}

const DATA_TAG = 'donnees_internes';

/** Empêche une donnée (nom, note…) de refermer elle-même le bloc de données de l'invite. */
export function neutralizeData(text: string): string {
  return text.replace(new RegExp(`<\\/?\\s*${DATA_TAG}[^>]*>`, 'gi'), '');
}

/** Données métier encadrées par des balises : l'invite précise que leur contenu n'est jamais une consigne. */
export function wrapDataBlock(text: string): string {
  return `<${DATA_TAG}>\n${neutralizeData(text)}\n</${DATA_TAG}>`;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface GenChunk {
  text?: string;
  functionCalls?: { name?: string; args?: Record<string, unknown> }[];
  /** Parties brutes du modèle, à renvoyer telles quelles au tour suivant (signatures de réflexion incluses). */
  parts?: unknown[];
}

/** Aplatit un morceau brut du SDK Gemini : texte, appels d'outils et parties d'origine. */
export function toGenChunk(raw: any): GenChunk {
  const parts: any[] = Array.isArray(raw?.candidates?.[0]?.content?.parts) ? raw.candidates[0].content.parts : [];
  const text = parts
    .filter((p) => typeof p?.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  const functionCalls = parts.filter((p) => p?.functionCall).map((p) => p.functionCall);
  // Les parties de texte vides (fin de flux) sont écartées : renvoyées au modèle, elles provoquent une erreur 400.
  return { text, functionCalls, parts: parts.filter((p) => !(p && p.text === '' && !p.functionCall)) };
}

export interface ToolRunOptions<S> {
  models: string[];
  contents: any[];
  /** Ouvre un flux pour un modèle ; `allowTools` est faux au dernier tour pour forcer une réponse en texte. */
  generate: (model: string, contents: any[], allowTools: boolean) => Promise<AsyncIterable<GenChunk>>;
  executeTool: (name: string, args: unknown) => { result: unknown; sources: S[] };
  /** Appelé à chaque morceau de texte, dès qu'il arrive. */
  onDelta: (text: string) => void;
  timeoutMs: number;
  /** Nombre maximal de tours d'outils avant de forcer la réponse. */
  maxToolRounds?: number;
}

/**
 * Boucle de réponse avec appel d'outils, en flux, avec repli sur le modèle suivant.
 *  - Tant qu'aucun texte n'a été envoyé à l'utilisateur, un échec (ouverture, délai, flux vide) passe au
 *    modèle suivant, en repartant de zéro.
 *  - Dès qu'un texte est parti, on ne change plus de modèle (ce serait un doublon) : l'erreur remonte.
 *  - Le délai s'applique à l'ouverture du flux ET à chaque morceau.
 */
export async function runWithTools<S>(opts: ToolRunOptions<S>): Promise<{ model: string; text: string; sources: S[] }> {
  const maxRounds = opts.maxToolRounds ?? 4;
  let lastError: unknown = null;

  for (const model of opts.models) {
    let emitted = false;
    let text = '';
    const sources: S[] = [];
    const contents = [...opts.contents];

    try {
      for (let round = 0; ; round += 1) {
        const allowTools = round < maxRounds;
        const stream = await withTimeout(opts.generate(model, contents, allowTools), opts.timeoutMs);
        const iterator = stream[Symbol.asyncIterator]();
        const calls: { name: string; args: Record<string, unknown> }[] = [];
        const parts: unknown[] = [];

        let step = await withTimeout(iterator.next(), opts.timeoutMs);
        while (!step.done) {
          const chunk = step.value || {};
          if (chunk.text) {
            emitted = true;
            text += chunk.text;
            opts.onDelta(chunk.text);
          }
          for (const fc of chunk.functionCalls || []) {
            if (fc?.name) calls.push({ name: fc.name, args: (fc.args || {}) as Record<string, unknown> });
          }
          if (chunk.parts) parts.push(...chunk.parts);
          step = await withTimeout(iterator.next(), opts.timeoutMs);
        }

        if (calls.length === 0 || !allowTools) {
          if (emitted) return { model, text, sources };
          throw new Error('Flux vide');
        }

        // Le modèle demande des outils : on les exécute, puis on lui renvoie les résultats.
        const responses = calls.map((call) => {
          const out = opts.executeTool(call.name, call.args);
          sources.push(...out.sources);
          return { functionResponse: { name: call.name, response: { output: out.result } } };
        });
        contents.push({
          role: 'model',
          parts: parts.length ? parts : calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
        });
        contents.push({ role: 'user', parts: responses });
      }
    } catch (err) {
      if (emitted) throw err;
      lastError = err;
    }
  }

  throw lastError || new Error('Aucun modèle disponible');
}

/** Message d'erreur montré à l'utilisateur : jamais le texte brut d'une erreur serveur ou fournisseur. */
export function toPublicError(err: unknown): { status: number; message: string } {
  const raw = String((err as { message?: string } | null)?.message || err || '').toLowerCase();
  if (raw.includes('ai_timeout') || raw.includes('timeout') || raw.includes('deadline')) {
    return { status: 504, message: "L'assistant met trop de temps à répondre. Réessayez dans un instant." };
  }
  if (raw.includes('429') || raw.includes('quota') || raw.includes('resource_exhausted') || raw.includes('rate')) {
    return { status: 503, message: "L'assistant est momentanément très sollicité. Réessayez dans une minute." };
  }
  if (raw.includes('api key') || raw.includes('gemini_api_key') || raw.includes('non configur')) {
    return { status: 503, message: "L'assistant IA n'est pas configuré sur le serveur. Contactez l'administrateur." };
  }
  return { status: 500, message: "L'assistant est momentanément indisponible. Réessayez dans un instant." };
}

export interface AssistantDataset {
  vehicles: Vehicle[];
  contracts: Contract[];
  deposits: DepositRecord[];
}

/** Sous-ensemble du client Supabase dont on a besoin (facilite les tests). */
export interface AssistantQueryClient {
  from(table: string): any;
}

/**
 * Lit véhicules, contrats et cautions avec le client de l'utilisateur : la RLS de la base fait le
 * cloisonnement (un responsable ne voit que son périmètre). Retourne null au moindre échec : l'appelant
 * retombe alors sur les données transmises par le navigateur (comportement précédent).
 */
export async function fetchAssistantData(client: AssistantQueryClient): Promise<AssistantDataset | null> {
  const read = async (table: string): Promise<any[]> => {
    const { data, error } = await client.from(table).select('*').limit(ASSISTANT_LIMITS.rowsPerTable);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  try {
    const [vehicles, contracts, deposits] = await Promise.all([read('vehicles'), read('contracts'), read('deposits')]);
    return {
      vehicles: vehicles.map(mapVehicleRow),
      contracts: contracts.map(mapContractRow),
      deposits: deposits.map(mapDepositRow),
    };
  } catch {
    return null;
  }
}

/** Charte enregistrée par le gérant (table agency_data) ; null si illisible. */
export async function fetchAssistantSettings(client: AssistantQueryClient): Promise<unknown | null> {
  try {
    const { data, error } = await client.from('agency_data').select('data').eq('id', 'morvello_main').maybeSingle();
    if (error) return null;
    const settings = data?.data?.aiSettings;
    return settings && typeof settings === 'object' ? settings : null;
  } catch {
    return null;
  }
}
