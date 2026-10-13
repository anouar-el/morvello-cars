import { todayInMorocco } from './aiAssistantContext';

/*
 * Quota quotidien et suivi de consommation de l'assistant IA, par utilisateur.
 *  - Le quota est consommé à l'arrivée de la demande (deux demandes simultanées ne contournent pas la limite).
 *  - Les jetons réels sont ajoutés à la fin de la réponse, d'après les métadonnées renvoyées par le modèle.
 *  - Les données sont en mémoire du serveur : elles repartent de zéro à chaque redémarrage ou déploiement,
 *    et sont propres à chaque instance. C'est un garde-fou et un indicateur, pas une comptabilité.
 *  - Le coût n'est estimé que si les tarifs sont fournis (jamais de prix inventé).
 */

export interface UsageBucket {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
}

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  /** 0 = illimité. */
  limit: number;
  remaining: number | null;
}

export interface UsageSummary {
  day: string;
  dailyLimit: number;
  totals: UsageBucket & { estimatedCost: number | null };
  users: (UsageBucket & { uid: string; name: string })[];
  days: (UsageBucket & { day: string })[];
}

export interface UsageTrackerOptions {
  /** Requêtes par utilisateur et par jour ; 0 ou moins = illimité. */
  dailyLimit: number;
  now?: () => Date;
  retentionDays?: number;
  /** Tarif par million de jetons, dans la devise de votre choix (optionnel). */
  priceInPerMTok?: number;
  priceOutPerMTok?: number;
}

const empty = (): UsageBucket => ({ requests: 0, inputTokens: 0, outputTokens: 0, toolCalls: 0 });

export function createUsageTracker(opts: UsageTrackerOptions) {
  const now = opts.now ?? (() => new Date());
  const retention = opts.retentionDays ?? 14;
  const limit = Math.max(0, Math.floor(opts.dailyLimit || 0));

  // jour -> uid -> compteurs
  const days = new Map<string, Map<string, UsageBucket & { name: string }>>();

  const today = () => todayInMorocco(now());

  const prune = () => {
    const keep = Array.from(days.keys()).sort().slice(-retention);
    for (const key of Array.from(days.keys())) if (!keep.includes(key)) days.delete(key);
  };

  const entry = (uid: string, name = '') => {
    const day = today();
    let users = days.get(day);
    if (!users) {
      users = new Map();
      days.set(day, users);
      prune();
    }
    let e = users.get(uid);
    if (!e) {
      e = { ...empty(), name };
      users.set(uid, e);
    }
    if (name) e.name = name;
    return e;
  };

  return {
    limit,

    /** Réserve une demande. Un utilisateur exempté (gérant) n'est jamais bloqué mais reste compté. */
    consume(uid: string, name = '', exempt = false): QuotaStatus {
      const e = entry(uid, name);
      if (!exempt && limit > 0 && e.requests >= limit) {
        return { allowed: false, used: e.requests, limit, remaining: 0 };
      }
      e.requests += 1;
      const unlimited = exempt || limit === 0;
      return {
        allowed: true,
        used: e.requests,
        limit: unlimited ? 0 : limit,
        remaining: unlimited ? null : Math.max(0, limit - e.requests),
      };
    },

    /** Consommation du jour, sans l'incrémenter (pour l'affichage). */
    status(uid: string, exempt = false): QuotaStatus {
      const e = days.get(today())?.get(uid);
      const used = e?.requests ?? 0;
      const unlimited = exempt || limit === 0;
      return {
        allowed: unlimited || used < limit,
        used,
        limit: unlimited ? 0 : limit,
        remaining: unlimited ? null : Math.max(0, limit - used),
      };
    },

    record(uid: string, usage: { inputTokens?: number; outputTokens?: number; toolCalls?: number }, name = ''): void {
      const e = entry(uid, name);
      e.inputTokens += Math.max(0, Math.round(usage.inputTokens || 0));
      e.outputTokens += Math.max(0, Math.round(usage.outputTokens || 0));
      e.toolCalls += Math.max(0, Math.round(usage.toolCalls || 0));
    },

    summary(): UsageSummary {
      const day = today();
      const users = Array.from(days.get(day)?.entries() ?? []).map(([uid, e]) => ({ uid, ...e }));
      users.sort((a, b) => b.requests - a.requests);

      const totals = users.reduce<UsageBucket>(
        (t, u) => ({
          requests: t.requests + u.requests,
          inputTokens: t.inputTokens + u.inputTokens,
          outputTokens: t.outputTokens + u.outputTokens,
          toolCalls: t.toolCalls + u.toolCalls,
        }),
        empty()
      );

      const priced = opts.priceInPerMTok !== undefined && opts.priceOutPerMTok !== undefined;
      const estimatedCost = priced
        ? (totals.inputTokens / 1_000_000) * (opts.priceInPerMTok as number) +
          (totals.outputTokens / 1_000_000) * (opts.priceOutPerMTok as number)
        : null;

      const history = Array.from(days.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, map]) => {
          const b = empty();
          for (const e of map.values()) {
            b.requests += e.requests;
            b.inputTokens += e.inputTokens;
            b.outputTokens += e.outputTokens;
            b.toolCalls += e.toolCalls;
          }
          return { day: d, ...b };
        });

      return { day, dailyLimit: limit, totals: { ...totals, estimatedCost }, users, days: history };
    },
  };
}

export type UsageTracker = ReturnType<typeof createUsageTracker>;
