import type { ReservationDraft } from './reservations';

/**
 * Passage « réservation → contrat » : l'écran de réservation dépose un brouillon, l'assistant de contrat
 * le lit une seule fois à son ouverture. Un simple dépôt en mémoire évite de toucher aux contextes de l'app.
 */

let pending: ReservationDraft | null = null;

export function setReservationDraft(draft: ReservationDraft): void {
  pending = draft;
}

/** Lit et vide le brouillon : il ne doit servir qu'une fois. */
export function takeReservationDraft(): ReservationDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
