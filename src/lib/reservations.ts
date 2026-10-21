import type { Client, Contract, Reservation } from '../types';
import { getDaysDiff } from '../utils/vehicleExpiryUtils';

/**
 * Réservations légères (sans contrat), stockées dans la fiche du client (`Client.reservations`).
 * Module pur : classement par urgence, détection de chevauchement et passage au contrat.
 */

export interface ReservationEntry {
  reservation: Reservation;
  client: Client;
}

export type ReservationTiming = 'overdue' | 'today' | 'soon' | 'upcoming';

/** Une réservation de J+1 ou J+2 est « proche » : il faut préparer le véhicule. */
export const SOON_DAYS = 2;

/** Prérempli du contrat à partir d'une réservation. */
export interface ReservationDraft {
  reservationId: string;
  clientId: string;
  vehicleId?: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  deposit?: number;
}

export function newReservationId(): string {
  return `res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Toutes les réservations de tous les clients, quel que soit leur statut. */
export function collectReservations(clients: Client[]): ReservationEntry[] {
  const out: ReservationEntry[] = [];
  for (const client of clients) {
    for (const reservation of client.reservations ?? []) out.push({ reservation, client });
  }
  return out;
}

const byStart = (a: ReservationEntry, b: ReservationEntry) =>
  `${a.reservation.startDate} ${a.reservation.startTime}`.localeCompare(`${b.reservation.startDate} ${b.reservation.startTime}`);

/**
 * Réservations encore à traiter, la plus proche (ou la plus en retard) en premier.
 * Une réservation dont un contrat est issu (`Contract.reservationId`) est considérée comme traitée : on évite ainsi
 * une seconde écriture sur la fiche client au moment de créer le contrat.
 */
export function activeReservations(clients: Client[], contracts: Contract[] = []): ReservationEntry[] {
  const converted = new Set(contracts.map((c) => c.reservationId).filter(Boolean));
  return collectReservations(clients)
    .filter((e) => e.reservation.status === 'active' && !converted.has(e.reservation.id))
    .sort(byStart);
}

export function reservationTiming(reservation: Reservation, today: string): { timing: ReservationTiming; daysUntil: number } {
  const daysUntil = getDaysDiff(reservation.startDate, today) ?? 0;
  if (daysUntil < 0) return { timing: 'overdue', daysUntil };
  if (daysUntil === 0) return { timing: 'today', daysUntil };
  if (daysUntil <= SOON_DAYS) return { timing: 'soon', daysUntil };
  return { timing: 'upcoming', daysUntil };
}

export interface ConflictQuery {
  clients: Client[];
  contracts: Contract[];
  vehicleId: string;
  startDate: string;
  endDate: string;
  /** Réservation en cours de modification, à ne pas compter contre elle-même. */
  ignoreReservationId?: string;
}

export interface ConflictResult {
  reservations: ReservationEntry[];
  contracts: Contract[];
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;

/**
 * Autres réservations actives et contrats en cours qui occupent déjà ce véhicule sur ces dates.
 * Les dates sont des AAAA-MM-JJ, comparées comme du texte ; les deux bornes comptent (inclusives).
 */
export function findVehicleConflicts(q: ConflictQuery): ConflictResult {
  if (!q.vehicleId || !q.startDate || !q.endDate) return { reservations: [], contracts: [] };

  const reservations = activeReservations(q.clients, q.contracts).filter(
    (e) =>
      e.reservation.id !== q.ignoreReservationId &&
      e.reservation.vehicleId === q.vehicleId &&
      overlaps(q.startDate, q.endDate, e.reservation.startDate, e.reservation.endDate)
  );

  const contracts = q.contracts.filter((c) => {
    if (c.vehicleId !== q.vehicleId || c.status !== 'active') return false;
    const end = c.prolongation?.isActive && c.prolongation.newEndDate ? c.prolongation.newEndDate : c.endDate;
    return overlaps(q.startDate, q.endDate, c.startDate, end);
  });

  return { reservations, contracts };
}

export interface ReservationInput {
  startDate: string;
  endDate: string;
}

/** Message d'erreur (en français) ou null si les dates tiennent. */
export function validateReservationDates(input: ReservationInput): string | null {
  if (!input.startDate || !input.endDate) return 'Renseignez les dates de début et de fin.';
  if (input.endDate < input.startDate) return 'La date de fin doit être après la date de début.';
  return null;
}

export function toContractDraft(entry: ReservationEntry): ReservationDraft {
  const r = entry.reservation;
  return {
    reservationId: r.id,
    clientId: entry.client.id,
    vehicleId: r.vehicleId,
    startDate: r.startDate,
    startTime: r.startTime,
    endDate: r.endDate,
    endTime: r.endTime,
    deposit: r.deposit,
  };
}

/** Remplace une réservation dans la liste du client sans toucher aux autres. */
export function patchReservation(list: Reservation[] | undefined, id: string, patch: Partial<Reservation>): Reservation[] {
  return (list ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r));
}
