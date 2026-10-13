import { describe, it, expect } from 'vitest';
import type { AuditLog } from '../types';
import {
  auditLogsToCsv,
  categorize,
  filterAuditLogs,
  formatWhen,
  groupByDay,
} from './auditPresentation';

const NOW = new Date(2026, 9, 13, 15, 0, 0); // 13 octobre 2026, heure locale

const log = (over: Partial<AuditLog>): AuditLog => ({
  id: 'l1',
  timestamp: new Date(2026, 9, 13, 9, 5).toISOString(),
  userName: 'Larbi',
  userRole: 'manager',
  action: 'Création contrat',
  targetType: 'contract',
  targetId: 'MC-2026-0001',
  details: 'Contrat créé',
  ...over,
});

describe('categorize', () => {
  it('classe par type de cible', () => {
    expect(categorize(log({ targetType: 'contract' }))).toBe('contrats');
    expect(categorize(log({ targetType: 'client', action: 'Ajout client' }))).toBe('clients');
    expect(categorize(log({ targetType: 'vehicle', action: 'Modification véhicule' }))).toBe('vehicules');
    expect(categorize(log({ targetType: 'user_permission', action: 'Changement' }))).toBe('acces');
    expect(categorize(log({ targetType: 'terms', action: 'Ajout clause' }))).toBe('parametres');
  });

  it('range les cautions et paiements ensemble, quel que soit le type de cible', () => {
    expect(categorize(log({ action: 'Règlement enregistré' }))).toBe('cautions');
    expect(categorize(log({ action: 'Mise à jour', details: 'Caution prise' }))).toBe('cautions');
  });
});

describe('formatWhen', () => {
  it('affiche aujourd\'hui, hier puis la date complète', () => {
    expect(formatWhen(new Date(2026, 9, 13, 9, 5).toISOString(), NOW)).toBe('Aujourd’hui 09:05');
    expect(formatWhen(new Date(2026, 9, 12, 18, 30).toISOString(), NOW)).toBe('Hier 18:30');
    expect(formatWhen(new Date(2026, 8, 30, 8, 0).toISOString(), NOW)).toBe('30/09/2026 08:00');
  });

  it('tolère un horodatage illisible', () => {
    expect(formatWhen('pas une date', NOW)).toBe('pas une date');
  });
});

describe('filterAuditLogs', () => {
  const logs = [
    log({ id: 'a' }),
    log({ id: 'b', userName: 'Said', targetType: 'client', action: 'Ajout client', details: 'Client Éléonore' }),
    log({ id: 'c', timestamp: new Date(2026, 8, 1, 10, 0).toISOString() }),
  ];
  const base = { query: '', category: 'all', user: 'all', period: 'all' } as const;

  it('filtre par agent, catégorie et période', () => {
    expect(filterAuditLogs(logs, { ...base, user: 'Said' }, NOW).map((l) => l.id)).toEqual(['b']);
    expect(filterAuditLogs(logs, { ...base, category: 'clients' }, NOW).map((l) => l.id)).toEqual(['b']);
    expect(filterAuditLogs(logs, { ...base, period: '7d' }, NOW).map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('cherche sans tenir compte des accents ni de la casse', () => {
    expect(filterAuditLogs(logs, { ...base, query: 'eleonore' }, NOW).map((l) => l.id)).toEqual(['b']);
  });
});

describe('groupByDay', () => {
  it('regroupe les entrées consécutives du même jour', () => {
    const groups = groupByDay(
      [log({ id: 'a' }), log({ id: 'b' }), log({ id: 'c', timestamp: new Date(2026, 9, 12, 10, 0).toISOString() })],
      NOW
    );
    expect(groups.map((g) => [g.heading, g.logs.length])).toEqual([
      ['Aujourd’hui', 2],
      ['Hier', 1],
    ]);
  });
});

describe('auditLogsToCsv', () => {
  it('échappe les guillemets et neutralise les formules', () => {
    const csv = auditLogsToCsv([log({ details: 'Dit "bonjour"', userName: '=CMD()' })]);
    expect(csv).toContain('"Dit ""bonjour"""');
    expect(csv).toContain(`"'=CMD()"`);
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
