import { describe, expect, it } from 'vitest';
import type { ClientObservation } from '../types';
import { isValidRating, needsAttention, sortObservationsNewestFirst, summarizeObservations } from './clientObservations';

const obs = (over: Partial<ClientObservation>): ClientObservation => ({
  id: over.id ?? 'o',
  createdAt: '2026-10-01T10:00:00.000Z',
  authorName: 'Anouar',
  rating: 4,
  tags: [],
  comment: '',
  ...over,
});

describe('summarizeObservations', () => {
  it("renvoie un résumé vide sans observation", () => {
    const s = summarizeObservations(undefined);
    expect(s).toMatchObject({ count: 0, average: null, standing: 'none', last: null });
    expect(needsAttention(s)).toBe(false);
  });

  it('calcule la moyenne et un niveau « bon » pour un client régulier', () => {
    const s = summarizeObservations([
      obs({ id: 'a', rating: 5, createdAt: '2026-08-01T10:00:00.000Z' }),
      obs({ id: 'b', rating: 4, createdAt: '2026-09-01T10:00:00.000Z' }),
    ]);
    expect(s.average).toBe(4.5);
    expect(s.standing).toBe('good');
    expect(needsAttention(s)).toBe(false);
  });

  it("met un client à surveiller dès que sa dernière location s'est mal passée, même avec une bonne moyenne", () => {
    const s = summarizeObservations([
      obs({ id: 'a', rating: 5, createdAt: '2026-06-01T10:00:00.000Z' }),
      obs({ id: 'b', rating: 5, createdAt: '2026-07-01T10:00:00.000Z' }),
      obs({ id: 'c', rating: 5, createdAt: '2026-08-01T10:00:00.000Z' }),
      obs({ id: 'd', rating: 2, createdAt: '2026-10-01T10:00:00.000Z', tags: ['late_return'] }),
    ]);
    expect(s.last?.id).toBe('d');
    expect(s.standing).toBe('watch');
    expect(needsAttention(s)).toBe(true);
  });

  it('classe « à éviter » une dernière note de 1', () => {
    expect(summarizeObservations([obs({ rating: 1 })]).standing).toBe('avoid');
  });

  it('compte les étiquettes négatives et ignore les positives', () => {
    const s = summarizeObservations([
      obs({ id: 'a', tags: ['late_return', 'punctual'], createdAt: '2026-08-01T10:00:00.000Z' }),
      obs({ id: 'b', tags: ['late_return', 'damage'], createdAt: '2026-09-01T10:00:00.000Z' }),
    ]);
    expect(s.negativeTags).toEqual([
      { tag: 'late_return', count: 2 },
      { tag: 'damage', count: 1 },
    ]);
  });
});

describe('sortObservationsNewestFirst', () => {
  it('ne modifie pas le tableau reçu', () => {
    const log = [obs({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }), obs({ id: 'b', createdAt: '2026-02-01T00:00:00.000Z' })];
    expect(sortObservationsNewestFirst(log).map((o) => o.id)).toEqual(['b', 'a']);
    expect(log.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('isValidRating', () => {
  it('accepte 1 à 5 seulement', () => {
    expect([0, 1, 5, 6, 3.5].map(isValidRating)).toEqual([false, true, true, false, false]);
  });
});
