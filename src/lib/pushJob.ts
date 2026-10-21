import type { Client, Contract, DepositRecord, User, Vehicle } from '../types';
import { computeOperationalAlerts } from '../utils/alertsUtils';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import {
  buildCriticalPayload,
  buildMorningDigest,
  isDigestDue,
  moroccoNow,
  pickNewCritical,
  pruneSentAlerts,
  selectPushAlerts,
  type PushPayload,
} from './pushDigest';

/**
 * Un cycle de notifications push : qui doit être prévenu, de quoi, et mise à jour de ce qui a déjà été envoyé.
 * Tout ce qui touche au réseau ou à la base est injecté (`PushJobDeps`), donc le cycle se teste sans serveur.
 */

export interface PushSubscriptionRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_digest_on: string | null;
  sent_alerts: string[] | null;
}

export interface Workspace {
  vehicles: Vehicle[];
  clients: Client[];
  contracts: Contract[];
  deposits: DepositRecord[];
  users: User[];
}

export interface PushJobDeps {
  loadSubscriptions(): Promise<PushSubscriptionRow[]>;
  loadWorkspace(): Promise<Workspace>;
  send(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: PushPayload): Promise<void>;
  deleteSubscription(id: number): Promise<void>;
  updateSubscription(id: number, patch: { last_digest_on?: string; sent_alerts?: string[] }): Promise<void>;
  now?: () => Date;
  log?: (message: string) => void;
}

export interface PushCycleResult {
  sent: number;
  removed: number;
  failed: number;
}

/** Seuls le gérant et les managers reçoivent des notifications. */
const RECIPIENT_ROLES = new Set(['admin', 'manager']);

const isGone = (err: unknown): boolean => {
  const code = (err as { statusCode?: number })?.statusCode;
  return code === 404 || code === 410;
};

export async function runPushCycle(deps: PushJobDeps): Promise<PushCycleResult> {
  const result: PushCycleResult = { sent: 0, removed: 0, failed: 0 };
  const log = deps.log ?? (() => {});
  const subs = await deps.loadSubscriptions();
  if (subs.length === 0) return result;

  const workspace = await deps.loadWorkspace();
  const local = moroccoNow(deps.now?.() ?? new Date());
  const usersById = new Map(workspace.users.map((u) => [u.id, u]));

  // Les alertes sont calculées une fois par utilisateur, puis partagées entre ses appareils
  const alertsByUser = new Map<string, ReturnType<typeof selectPushAlerts>>();
  const alertsFor = (user: User) => {
    const cached = alertsByUser.get(user.id);
    if (cached) return cached;
    const scoped = getScopedDataForUser(
      user,
      workspace.vehicles,
      workspace.contracts,
      workspace.deposits,
      workspace.clients,
      workspace.users
    );
    const { alerts } = computeOperationalAlerts(
      scoped.scopedVehicles,
      scoped.scopedContracts,
      scoped.scopedDeposits,
      local.date,
      scoped.scopedClients
    );
    const picked = selectPushAlerts(alerts);
    alertsByUser.set(user.id, picked);
    return picked;
  };

  for (const sub of subs) {
    const user = usersById.get(sub.user_id);
    if (!user || !RECIPIENT_ROLES.has(user.role)) continue;

    const alerts = alertsFor(user);
    const target = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    const sentBefore = new Set(sub.sent_alerts ?? []);
    const sentNow = new Set(sentBefore);
    const patch: { last_digest_on?: string; sent_alerts?: string[] } = {};
    let gone = false;

    const deliver = async (payload: PushPayload): Promise<boolean> => {
      try {
        await deps.send(target, payload);
        result.sent += 1;
        return true;
      } catch (err) {
        if (isGone(err)) {
          gone = true;
        } else {
          result.failed += 1;
          log(`[Push] échec d'envoi (abonnement ${sub.id}) : ${(err as Error)?.message ?? err}`);
        }
        return false;
      }
    };

    // 1. Résumé du matin, une fois par jour
    let digestSent = false;
    if (isDigestDue(local, sub.last_digest_on)) {
      const digest = buildMorningDigest(alerts);
      if (!digest) {
        patch.last_digest_on = local.date; // rien à dire aujourd'hui : on ne recalcule pas à chaque cycle
      } else if (await deliver(digest)) {
        patch.last_digest_on = local.date;
        digestSent = true;
      }
    }

    // 2. Alertes critiques nouvelles. Le résumé les couvre déjà : on les marque vues sans doubler la notification.
    if (!gone) {
      const fresh = pickNewCritical(alerts, sentNow);
      if (fresh.length > 0) {
        if (digestSent || (await deliver(buildCriticalPayload(fresh)!))) {
          for (const a of fresh) sentNow.add(a.id);
        }
      }
    }

    if (gone) {
      await deps.deleteSubscription(sub.id).catch((e) => log(`[Push] suppression impossible : ${e?.message ?? e}`));
      result.removed += 1;
      continue;
    }

    const activeIds = new Set(alerts.map((a) => a.id));
    const pruned = pruneSentAlerts(sentNow, activeIds);
    const changed = pruned.length !== (sub.sent_alerts ?? []).length || pruned.some((id) => !sentBefore.has(id));
    if (changed) patch.sent_alerts = pruned;
    if (Object.keys(patch).length > 0) {
      await deps.updateSubscription(sub.id, patch).catch((e) => log(`[Push] mise à jour impossible : ${e?.message ?? e}`));
    }
  }

  return result;
}
