import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { mapClientRow, mapContractRow, mapDepositRow, mapVehicleRow } from './rowMappers';
import { runPushCycle, type PushCycleResult, type PushJobDeps, type PushSubscriptionRow, type Workspace } from './pushJob';
import type { PushPayload } from './pushDigest';

/**
 * Notifications push côté serveur : configuration, abonnements des appareils et envoi.
 * Les abonnements vivent dans `push_subscriptions`, lue et écrite uniquement avec la clé service_role.
 */

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Les trois variables doivent être présentes, sinon les notifications restent désactivées (sans erreur). */
export function readPushConfig(env: Record<string, string | undefined> = process.env): PushConfig | null {
  const publicKey = (env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (env.VAPID_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
  return { publicKey, privateKey, subject };
}

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/**
 * Contrôle d'un abonnement reçu du navigateur. Le serveur enverra des requêtes vers cette adresse :
 * on n'accepte donc que du https, de taille raisonnable, avec des clés bien formées.
 */
export function validateSubscription(body: unknown): BrowserSubscription | null {
  const sub = (body as { subscription?: unknown })?.subscription as Partial<BrowserSubscription> | undefined;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (p256dh.length < 20 || p256dh.length > 200 || auth.length < 8 || auth.length > 100) return null;
  if (!BASE64URL.test(p256dh) || !BASE64URL.test(auth)) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { endpoint, keys: { p256dh, auth } };
}

/** Profil Supabase → utilisateur, avec les champs qu'utilise le cloisonnement par manager. */
export function mapProfileToUser(row: any): User {
  return {
    id: row.id,
    name: row.name || '',
    role: row.role === 'admin' || row.role === 'manager' ? row.role : 'agent',
    email: row.email || '',
    legacyId: row.legacy_id || row.local_id || undefined,
    firebaseUid: row.firebase_uid || undefined,
    agency: row.agency || undefined,
  } as User;
}

const PAGE = 1000;

async function fetchAll(admin: SupabaseClient, table: string, columns = '*'): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export interface PushService {
  publicKey: string;
  subscribe(userId: string, sub: BrowserSubscription, userAgent?: string): Promise<void>;
  unsubscribe(userId: string, endpoint: string): Promise<void>;
  /** Envoie une notification d'essai à tous les appareils de l'utilisateur ; renvoie le nombre d'appareils joints. */
  sendTest(userId: string): Promise<number>;
  runCycle(): Promise<PushCycleResult>;
}

export function createPushService(admin: SupabaseClient, config: PushConfig, log: (m: string) => void = console.log): PushService {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const send: PushJobDeps['send'] = async (sub, payload) => {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'high' });
  };

  const deps: PushJobDeps = {
    loadSubscriptions: async () => (await fetchAll(admin, 'push_subscriptions')) as PushSubscriptionRow[],
    loadWorkspace: async (): Promise<Workspace> => {
      const [vehicles, clients, contracts, deposits, profiles] = await Promise.all([
        fetchAll(admin, 'vehicles'),
        fetchAll(admin, 'clients'),
        fetchAll(admin, 'contracts'),
        fetchAll(admin, 'deposits'),
        fetchAll(admin, 'profiles', 'id, name, role, email, legacy_id, local_id, firebase_uid, agency'),
      ]);
      return {
        vehicles: vehicles.map(mapVehicleRow),
        clients: clients.map(mapClientRow),
        contracts: contracts.map(mapContractRow),
        deposits: deposits.map(mapDepositRow),
        users: profiles.map(mapProfileToUser),
      };
    },
    send,
    deleteSubscription: async (id) => {
      const { error } = await admin.from('push_subscriptions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    updateSubscription: async (id, patch) => {
      const { error } = await admin
        .from('push_subscriptions')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    log,
  };

  return {
    publicKey: config.publicKey,

    async subscribe(userId, sub, userAgent) {
      const { error } = await admin.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          user_agent: (userAgent || '').slice(0, 300) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );
      if (error) throw new Error(error.message);
    },

    async unsubscribe(userId, endpoint) {
      // Filtré sur l'utilisateur : on ne peut retirer que ses propres appareils
      const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },

    async sendTest(userId) {
      const { data, error } = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
      if (error) throw new Error(error.message);
      const payload: PushPayload = {
        title: 'Morvello Cars',
        body: 'Les notifications fonctionnent sur cet appareil ✓',
        tag: 'morvello-test',
        url: '/',
      };
      let reached = 0;
      for (const row of (data ?? []) as PushSubscriptionRow[]) {
        try {
          await send({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
          reached += 1;
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await deps.deleteSubscription(row.id).catch(() => {});
        }
      }
      return reached;
    },

    runCycle: () => runPushCycle(deps),
  };
}
