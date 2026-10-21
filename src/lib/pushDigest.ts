import type { OperationalAlert, AlertCategory } from '../utils/alertsUtils';

/**
 * Contenu des notifications push : quelles alertes, quel texte, à quel moment.
 * Module pur (aucun accès réseau ni base) : le serveur n'a qu'à l'appeler puis à envoyer.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Une notification portant la même étiquette en remplace une plus ancienne au lieu de s'empiler. */
  tag: string;
  url: string;
}

/** Heure (Maroc) à partir de laquelle le résumé du matin part. */
export const DIGEST_HOUR = 8;
export const PUSH_TIME_ZONE = 'Africa/Casablanca';

/** Retards et retours du jour, réservations du jour / de demain / dépassées. */
const PUSH_CATEGORIES: ReadonlySet<AlertCategory> = new Set<AlertCategory>([
  'return_overdue',
  'return_today',
  'reservation_overdue',
  'reservation_today',
  'reservation_soon',
]);

/** Alertes qui méritent une notification : on écarte la réservation de J+2, trop lointaine pour réveiller un téléphone. */
export function selectPushAlerts(alerts: OperationalAlert[]): OperationalAlert[] {
  return alerts.filter((a) => {
    if (!PUSH_CATEGORIES.has(a.category)) return false;
    if (a.category === 'reservation_soon') return (a.daysRemaining ?? Number.POSITIVE_INFINITY) <= 1;
    return true;
  });
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Résumé du matin ; null s'il n'y a rien à signaler (on ne dérange pas pour rien). */
export function buildMorningDigest(alerts: OperationalAlert[]): PushPayload | null {
  const picked = selectPushAlerts(alerts);
  const count = (c: AlertCategory) => picked.filter((a) => a.category === c).length;

  const overdue = count('return_overdue');
  const returnsToday = count('return_today');
  const resOverdue = count('reservation_overdue');
  const resToday = count('reservation_today');
  const resTomorrow = count('reservation_soon');

  const lines: string[] = [];
  if (overdue) lines.push(`⚠ ${plural(overdue, 'véhicule en retard', 'véhicules en retard')}`);
  if (returnsToday) lines.push(`${plural(returnsToday, 'retour', 'retours')} aujourd'hui`);
  if (resToday) lines.push(`${plural(resToday, 'réservation', 'réservations')} aujourd'hui`);
  if (resTomorrow) lines.push(`${plural(resTomorrow, 'réservation', 'réservations')} demain`);
  if (resOverdue) lines.push(`${plural(resOverdue, 'réservation oubliée', 'réservations oubliées')}`);

  if (lines.length === 0) return null;
  return {
    title: 'Morvello Cars — le point du jour',
    body: lines.join(' • '),
    tag: 'morvello-digest',
    url: '/',
  };
}

/** Alertes critiques sélectionnées dont l'appareil n'a pas encore été prévenu. */
export function pickNewCritical(alerts: OperationalAlert[], alreadySent: ReadonlySet<string>): OperationalAlert[] {
  return selectPushAlerts(alerts).filter((a) => a.severity === 'critical' && !alreadySent.has(a.id));
}

/** Notification immédiate pour une ou plusieurs alertes critiques. */
export function buildCriticalPayload(newAlerts: OperationalAlert[]): PushPayload | null {
  if (newAlerts.length === 0) return null;
  if (newAlerts.length === 1) {
    const a = newAlerts[0];
    return { title: a.title, body: a.description, tag: `morvello-alert-${a.id}`, url: '/' };
  }
  return {
    title: `${newAlerts.length} alertes urgentes`,
    body: newAlerts
      .slice(0, 3)
      .map((a) => a.title)
      .join(' • '),
    tag: 'morvello-critical',
    url: '/',
  };
}

/** On ne garde que les identifiants encore actifs : la liste ne grossit pas indéfiniment. */
export function pruneSentAlerts(sent: Iterable<string>, activeIds: ReadonlySet<string>): string[] {
  return [...sent].filter((id) => activeIds.has(id));
}

/** Date et heure au Maroc, quel que soit le fuseau du serveur. */
export function moroccoNow(now: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PUSH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** Le résumé part une fois par jour, à partir de 8 h, même si le serveur redémarre en cours de journée. */
export function isDigestDue(local: { date: string; hour: number }, lastDigestOn: string | null | undefined): boolean {
  return local.hour >= DIGEST_HOUR && lastDigestOn !== local.date;
}
