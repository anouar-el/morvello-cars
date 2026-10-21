import { describe, expect, it } from 'vitest';
import type { Client, Contract, User, Vehicle } from '../types';
import { runPushCycle, type PushJobDeps, type PushSubscriptionRow, type Workspace } from './pushJob';
import type { PushPayload } from './pushDigest';

const admin = { id: 'u-admin', name: 'Anouar', role: 'admin', email: 'a@x.ma' } as User;
const manager = { id: 'u-mgr', name: 'Said', role: 'manager', email: 's@x.ma' } as User;
const agent = { id: 'u-agent', name: 'Agent', role: 'agent', email: 'g@x.ma' } as User;

const overdueContract = {
  id: 'c1',
  contractNumber: '0012',
  status: 'active',
  clientId: 'cl1',
  vehicleId: 'v1',
  startDate: '2026-10-10',
  endDate: '2026-10-18',
  clientSnapshot: { firstName: 'Ali', lastName: 'ALAMI' },
  vehicleSnapshot: { brand: 'DACIA', model: 'Logan', plate: '12345-A-6' },
} as unknown as Contract;

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  vehicles: [{ id: 'v1', brand: 'DACIA', model: 'Logan', plate: '12345-A-6', assignedManagerId: 'u-admin' } as Vehicle],
  clients: [{ id: 'cl1', firstName: 'Ali', lastName: 'ALAMI' } as Client],
  contracts: [overdueContract],
  deposits: [],
  users: [admin, manager, agent],
  ...over,
});

const sub = (over: Partial<PushSubscriptionRow> = {}): PushSubscriptionRow => ({
  id: 1,
  user_id: 'u-admin',
  endpoint: 'https://push.example/1',
  p256dh: 'k',
  auth: 'a',
  last_digest_on: null,
  sent_alerts: [],
  ...over,
});

// 21 octobre 2026, 08:30 au Maroc (UTC+1)
const MORNING = new Date('2026-10-21T07:30:00Z');
const EARLY = new Date('2026-10-21T05:30:00Z'); // 06:30 au Maroc

function harness(subs: PushSubscriptionRow[], ws: Workspace, now: Date, sendError?: (p: PushPayload) => unknown) {
  const sent: PushPayload[] = [];
  const updates: Array<{ id: number; patch: any }> = [];
  const deleted: number[] = [];
  const deps: PushJobDeps = {
    loadSubscriptions: async () => subs,
    loadWorkspace: async () => ws,
    send: async (_s, payload) => {
      const err = sendError?.(payload);
      if (err) throw err;
      sent.push(payload);
    },
    deleteSubscription: async (id) => void deleted.push(id),
    updateSubscription: async (id, patch) => void updates.push({ id, patch }),
    now: () => now,
  };
  return { deps, sent, updates, deleted };
}

describe('runPushCycle', () => {
  it("envoie le résumé du matin et marque le jour comme traité", async () => {
    const h = harness([sub()], workspace(), MORNING);
    const result = await runPushCycle(h.deps);
    expect(result.sent).toBe(1);
    expect(h.sent[0].tag).toBe('morvello-digest');
    expect(h.sent[0].body).toContain('en retard');
    expect(h.updates[0].patch.last_digest_on).toBe('2026-10-21');
    // le résumé couvre déjà le retard : pas de seconde notification, mais l'alerte est marquée vue
    expect(h.updates[0].patch.sent_alerts).toEqual(['return-overdue-c1']);
  });

  it('ne renvoie pas le résumé deux fois le même jour', async () => {
    const h = harness([sub({ last_digest_on: '2026-10-21', sent_alerts: ['return-overdue-c1'] })], workspace(), MORNING);
    const result = await runPushCycle(h.deps);
    expect(result.sent).toBe(0);
    expect(h.updates).toEqual([]);
  });

  it("avant 8 h, seule une alerte critique nouvelle part", async () => {
    const h = harness([sub()], workspace(), EARLY);
    await runPushCycle(h.deps);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].tag).toBe('morvello-alert-return-overdue-c1');
    expect(h.updates[0].patch.sent_alerts).toEqual(['return-overdue-c1']);
    expect(h.updates[0].patch.last_digest_on).toBeUndefined();
  });

  it("n'envoie rien à un agent ni à un appareil inconnu", async () => {
    const h = harness([sub({ user_id: 'u-agent' }), sub({ id: 2, user_id: 'ghost' })], workspace(), MORNING);
    expect((await runPushCycle(h.deps)).sent).toBe(0);
  });

  it("un manager ne reçoit que son périmètre", async () => {
    const h = harness([sub({ user_id: 'u-mgr' })], workspace(), MORNING);
    const result = await runPushCycle(h.deps);
    // le véhicule du contrat est affecté à l'admin, pas à ce manager : rien à signaler
    expect(result.sent).toBe(0);
    expect(h.updates[0].patch.last_digest_on).toBe('2026-10-21');
  });

  it('supprime un abonnement expiré (410) sans compter un échec', async () => {
    const h = harness([sub()], workspace(), MORNING, () => ({ statusCode: 410 }));
    const result = await runPushCycle(h.deps);
    expect(result).toMatchObject({ sent: 0, removed: 1, failed: 0 });
    expect(h.deleted).toEqual([1]);
  });

  it("garde l'abonnement et réessaiera au cycle suivant après une erreur passagère", async () => {
    const h = harness([sub()], workspace(), MORNING, () => ({ statusCode: 500, message: 'boom' }));
    const result = await runPushCycle(h.deps);
    expect(result.failed).toBeGreaterThan(0);
    expect(h.deleted).toEqual([]);
    expect(h.updates).toEqual([]);
  });

  it('oublie les alertes résolues', async () => {
    const h = harness([sub({ last_digest_on: '2026-10-21', sent_alerts: ['return-overdue-gone'] })], workspace({ contracts: [] }), MORNING);
    await runPushCycle(h.deps);
    expect(h.updates[0].patch.sent_alerts).toEqual([]);
  });

  it("ne charge rien sans abonnement", async () => {
    let loaded = false;
    const deps: PushJobDeps = {
      loadSubscriptions: async () => [],
      loadWorkspace: async () => {
        loaded = true;
        return workspace();
      },
      send: async () => {},
      deleteSubscription: async () => {},
      updateSubscription: async () => {},
    };
    expect((await runPushCycle(deps)).sent).toBe(0);
    expect(loaded).toBe(false);
  });
});
