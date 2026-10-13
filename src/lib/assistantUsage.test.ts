import { describe, it, expect } from 'vitest';
import { createUsageTracker } from './assistantUsage';

describe('createUsageTracker', () => {
  it('bloque au-delà du quota quotidien', () => {
    const t = createUsageTracker({ dailyLimit: 2 });
    expect(t.consume('u1').allowed).toBe(true);
    expect(t.consume('u1').remaining).toBe(0);
    const third = t.consume('u1');
    expect(third.allowed).toBe(false);
    expect(third.used).toBe(2);
  });

  it('compte chaque utilisateur séparément', () => {
    const t = createUsageTracker({ dailyLimit: 1 });
    expect(t.consume('u1').allowed).toBe(true);
    expect(t.consume('u2').allowed).toBe(true);
    expect(t.consume('u1').allowed).toBe(false);
  });

  it('ne bloque jamais un utilisateur exempté mais le compte', () => {
    const t = createUsageTracker({ dailyLimit: 1 });
    for (let i = 0; i < 5; i++) expect(t.consume('admin', 'Gérant', true).allowed).toBe(true);
    expect(t.summary().users[0].requests).toBe(5);
  });

  it('un quota de 0 signifie illimité', () => {
    const t = createUsageTracker({ dailyLimit: 0 });
    for (let i = 0; i < 20; i++) expect(t.consume('u1').allowed).toBe(true);
    expect(t.status('u1').remaining).toBeNull();
  });

  it('repart de zéro le lendemain', () => {
    let now = new Date('2026-10-13T10:00:00Z');
    const t = createUsageTracker({ dailyLimit: 1, now: () => now });
    expect(t.consume('u1').allowed).toBe(true);
    expect(t.consume('u1').allowed).toBe(false);
    now = new Date('2026-10-14T10:00:00Z');
    expect(t.consume('u1').allowed).toBe(true);
    expect(t.summary().days).toHaveLength(2);
  });

  it('cumule les jetons et n\'estime le coût que si les tarifs sont fournis', () => {
    const free = createUsageTracker({ dailyLimit: 10 });
    free.consume('u1', 'Larbi');
    free.record('u1', { inputTokens: 2000, outputTokens: 500, toolCalls: 1 });
    free.record('u1', { inputTokens: 1000, outputTokens: 100 });
    const s = free.summary();
    expect(s.totals).toMatchObject({ requests: 1, inputTokens: 3000, outputTokens: 600, toolCalls: 1, estimatedCost: null });
    expect(s.users[0].name).toBe('Larbi');

    const priced = createUsageTracker({ dailyLimit: 10, priceInPerMTok: 1, priceOutPerMTok: 4 });
    priced.consume('u1');
    priced.record('u1', { inputTokens: 1_000_000, outputTokens: 500_000 });
    expect(priced.summary().totals.estimatedCost).toBeCloseTo(3);
  });

  it('purge les jours au-delà de la rétention', () => {
    let now = new Date('2026-10-01T10:00:00Z');
    const t = createUsageTracker({ dailyLimit: 0, now: () => now, retentionDays: 3 });
    for (let d = 1; d <= 6; d++) {
      now = new Date(`2026-10-0${d}T10:00:00Z`);
      t.consume('u1');
    }
    expect(t.summary().days).toHaveLength(3);
  });
});
