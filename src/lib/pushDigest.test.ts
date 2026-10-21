import { describe, expect, it } from 'vitest';
import type { OperationalAlert } from '../utils/alertsUtils';
import {
  buildCriticalPayload,
  buildMorningDigest,
  isDigestDue,
  moroccoNow,
  pickNewCritical,
  pruneSentAlerts,
  selectPushAlerts,
} from './pushDigest';

const alert = (over: Partial<OperationalAlert>): OperationalAlert => ({
  id: 'a',
  category: 'return_overdue',
  severity: 'critical',
  title: 'Retard de restitution : DACIA Logan (12345-A-6)',
  description: 'Contrat #12 en retard',
  targetTab: 'contracts',
  entityId: 'c1',
  badgeText: 'Retard 2j',
  ...over,
});

describe('selectPushAlerts', () => {
  it('garde retards, retours du jour et réservations proches ; écarte le reste', () => {
    const picked = selectPushAlerts([
      alert({ id: '1', category: 'return_overdue' }),
      alert({ id: '2', category: 'return_upcoming', severity: 'info' }),
      alert({ id: '3', category: 'insurance_expired' }),
      alert({ id: '4', category: 'deposit_held', severity: 'warning' }),
      alert({ id: '5', category: 'reservation_soon', severity: 'info', daysRemaining: 1 }),
      alert({ id: '6', category: 'reservation_soon', severity: 'info', daysRemaining: 2 }),
    ]);
    expect(picked.map((a) => a.id)).toEqual(['1', '5']);
  });
});

describe('buildMorningDigest', () => {
  it("ne dérange pas quand il n'y a rien à signaler", () => {
    expect(buildMorningDigest([])).toBeNull();
    expect(buildMorningDigest([alert({ category: 'insurance_expired' })])).toBeNull();
  });

  it('résume en une phrase, avec les bons accords', () => {
    const digest = buildMorningDigest([
      alert({ id: '1', category: 'return_overdue' }),
      alert({ id: '2', category: 'return_overdue' }),
      alert({ id: '3', category: 'return_today', severity: 'warning' }),
      alert({ id: '4', category: 'reservation_today', severity: 'warning' }),
      alert({ id: '5', category: 'reservation_soon', severity: 'info', daysRemaining: 1 }),
      alert({ id: '6', category: 'reservation_overdue' }),
    ]);
    expect(digest?.body).toBe(
      "⚠ 2 véhicules en retard • 1 retour aujourd'hui • 1 réservation aujourd'hui • 1 réservation demain • 1 réservation oubliée"
    );
    expect(digest?.tag).toBe('morvello-digest');
  });
});

describe('alertes critiques', () => {
  it("ne signale que les nouvelles alertes critiques", () => {
    const alerts = [
      alert({ id: 'old', category: 'return_overdue' }),
      alert({ id: 'new', category: 'reservation_overdue' }),
      alert({ id: 'warn', category: 'return_today', severity: 'warning' }),
    ];
    expect(pickNewCritical(alerts, new Set(['old'])).map((a) => a.id)).toEqual(['new']);
  });

  it('une seule alerte garde son texte ; plusieurs sont regroupées', () => {
    const one = buildCriticalPayload([alert({ id: 'x', title: 'Retard : Logan', description: 'Depuis 2 jours' })]);
    expect(one).toMatchObject({ title: 'Retard : Logan', body: 'Depuis 2 jours', tag: 'morvello-alert-x' });
    const many = buildCriticalPayload([alert({ id: '1' }), alert({ id: '2' })]);
    expect(many?.title).toBe('2 alertes urgentes');
    expect(buildCriticalPayload([])).toBeNull();
  });

  it("oublie les alertes qui ne sont plus d'actualité", () => {
    expect(pruneSentAlerts(['a', 'b', 'c'], new Set(['b']))).toEqual(['b']);
  });
});

describe('heure du Maroc et résumé du matin', () => {
  it("lit la date et l'heure à Casablanca, pas celles du serveur", () => {
    // 22:30 UTC le 20 octobre = 23:30 au Maroc (UTC+1) : toujours le 20
    expect(moroccoNow(new Date('2026-10-20T22:30:00Z'))).toEqual({ date: '2026-10-20', hour: 23 });
    // 23:30 UTC le 20 = 00:30 le 21 au Maroc
    expect(moroccoNow(new Date('2026-10-20T23:30:00Z'))).toEqual({ date: '2026-10-21', hour: 0 });
  });

  it('envoie le résumé une fois par jour, à partir de 8 h', () => {
    expect(isDigestDue({ date: '2026-10-21', hour: 7 }, null)).toBe(false);
    expect(isDigestDue({ date: '2026-10-21', hour: 8 }, null)).toBe(true);
    expect(isDigestDue({ date: '2026-10-21', hour: 15 }, '2026-10-20')).toBe(true);
    expect(isDigestDue({ date: '2026-10-21', hour: 15 }, '2026-10-21')).toBe(false);
  });
});
