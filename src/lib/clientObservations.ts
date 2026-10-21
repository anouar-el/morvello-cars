import type { ClientObservation, ObservationTag } from '../types';

/**
 * Observations de l'agence sur le comportement d'un client.
 * Module pur : le résumé et l'alerte « client à surveiller » se calculent ici, l'écran ne fait qu'afficher.
 */

export type TagTone = 'positive' | 'negative';

export const OBSERVATION_TAGS: Array<{ id: ObservationTag; label: string; tone: TagTone }> = [
  { id: 'punctual', label: 'Ponctuel', tone: 'positive' },
  { id: 'polite', label: 'Courtois', tone: 'positive' },
  { id: 'clean_vehicle', label: 'Véhicule propre', tone: 'positive' },
  { id: 'careful_driver', label: 'Conduite soigneuse', tone: 'positive' },
  { id: 'late_return', label: 'Retard au retour', tone: 'negative' },
  { id: 'dirty_vehicle', label: 'Véhicule sale', tone: 'negative' },
  { id: 'damage', label: 'Dommage', tone: 'negative' },
  { id: 'fuel_issue', label: 'Carburant non respecté', tone: 'negative' },
  { id: 'km_exceeded', label: 'Km dépassés', tone: 'negative' },
  { id: 'payment_issue', label: 'Paiement difficile', tone: 'negative' },
  { id: 'dispute', label: 'Litige', tone: 'negative' },
  { id: 'no_show', label: 'Absent à la réservation', tone: 'negative' },
];

export const RATING_LABELS: Record<number, string> = {
  1: 'À éviter',
  2: 'Décevant',
  3: 'Correct',
  4: 'Bon client',
  5: 'Excellent client',
};

export type ClientStanding = 'none' | 'good' | 'watch' | 'avoid';

export interface ObservationSummary {
  count: number;
  /** Moyenne des notes, une décimale ; null sans observation. */
  average: number | null;
  standing: ClientStanding;
  negativeTags: Array<{ tag: ObservationTag; count: number }>;
  last: ClientObservation | null;
}

export function tagTone(tag: ObservationTag): TagTone {
  return OBSERVATION_TAGS.find((t) => t.id === tag)?.tone ?? 'negative';
}

export function sortObservationsNewestFirst(log: ClientObservation[] | undefined): ClientObservation[] {
  return [...(log ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/**
 * Niveau d'un client d'après ses observations.
 * - « à éviter » : la dernière note est 1, ou la moyenne est inférieure à 2
 * - « à surveiller » : la dernière note est 2 ou 3, ou la moyenne est inférieure à 3,5
 * - « bon » : le reste
 * La dernière observation compte autant que l'historique : un client qui s'est dégradé doit se voir tout de suite.
 */
export function summarizeObservations(log: ClientObservation[] | undefined): ObservationSummary {
  const sorted = sortObservationsNewestFirst(log);
  if (sorted.length === 0) {
    return { count: 0, average: null, standing: 'none', negativeTags: [], last: null };
  }
  const total = sorted.reduce((sum, o) => sum + o.rating, 0);
  const average = Math.round((total / sorted.length) * 10) / 10;
  const last = sorted[0];

  let standing: ClientStanding = 'good';
  if (last.rating <= 1 || average < 2) standing = 'avoid';
  else if (last.rating <= 3 || average < 3.5) standing = 'watch';

  const counts = new Map<ObservationTag, number>();
  for (const obs of sorted) {
    for (const tag of obs.tags) {
      if (tagTone(tag) === 'negative') counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const negativeTags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return { count: sorted.length, average, standing, negativeTags, last };
}

export function needsAttention(summary: ObservationSummary): boolean {
  return summary.standing === 'watch' || summary.standing === 'avoid';
}

export function newObservationId(): string {
  return `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isValidRating(value: number): value is ClientObservation['rating'] {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Les observations sont réservées à la direction : gérant et managers (affichage seulement ; les données restent dans la fiche client). */
export function canAccessObservations(role: string | undefined): boolean {
  return role === 'admin' || role === 'manager';
}
