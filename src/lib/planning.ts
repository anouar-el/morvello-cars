import type { Client, Contract, Reservation, Vehicle } from '../types';
import { collectReservations } from './reservations';

/**
 * Planning : une ligne par véhicule, une barre par contrat ou réservation sur la période affichée.
 * Module pur ; les dates sont des AAAA-MM-JJ, calculées en UTC pour ne pas dépendre du fuseau.
 */

const DAY_MS = 86_400_000;

const toUtc = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
};

export function addDays(date: string, n: number): string {
  const d = new Date(toUtc(date) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function dayOffset(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function rangeDays(startDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(startDate, i));
}

/** Samedi ou dimanche. */
export function isWeekend(date: string): boolean {
  const day = new Date(toUtc(date)).getUTCDay();
  return day === 0 || day === 6;
}

export type PlanningBarKind = 'contract' | 'reservation';

export interface PlanningBar {
  key: string;
  kind: PlanningBarKind;
  /** Contrat ou réservation d'origine, pour ouvrir la bonne fiche. */
  contract?: Contract;
  reservation?: Reservation;
  client?: Client;
  label: string;
  start: string;
  end: string;
  /** Colonne de départ (0 = premier jour affiché) et nombre de jours visibles. */
  column: number;
  span: number;
  /** La barre commence avant / finit après la période affichée. */
  clippedStart: boolean;
  clippedEnd: boolean;
  /** Contrat en cours dont le retour est dépassé. */
  overdue: boolean;
  done: boolean;
  /** Rang de la barre dans la ligne quand plusieurs se chevauchent. */
  lane: number;
}

export interface PlanningRow {
  vehicle: Vehicle;
  bars: PlanningBar[];
  lanes: number;
  /** Véhicule sans contrat ni réservation le jour `today`. */
  freeToday: boolean;
}

export interface PlanningInput {
  vehicles: Vehicle[];
  contracts: Contract[];
  clients: Client[];
  startDate: string;
  days: number;
  today: string;
}

const effectiveEnd = (c: Contract) => (c.prolongation?.isActive && c.prolongation.newEndDate ? c.prolongation.newEndDate : c.endDate).slice(0, 10);

function clientLabel(first?: string, last?: string): string {
  return `${last ?? ''} ${first ?? ''}`.trim();
}

function place(
  base: Omit<PlanningBar, 'column' | 'span' | 'clippedStart' | 'clippedEnd' | 'lane'>,
  startDate: string,
  days: number
): PlanningBar | null {
  const first = dayOffset(startDate, base.start);
  const last = dayOffset(startDate, base.end);
  if (last < 0 || first > days - 1) return null;
  const column = Math.max(0, first);
  const lastVisible = Math.min(days - 1, last);
  return {
    ...base,
    column,
    span: Math.max(1, lastVisible - column + 1),
    clippedStart: first < 0,
    clippedEnd: last > days - 1,
    lane: 0,
  };
}

/** Répartit les barres en rangs pour que deux barres qui se chevauchent ne se superposent pas. */
function assignLanes(bars: PlanningBar[]): number {
  const sorted = [...bars].sort((a, b) => a.column - b.column || b.span - a.span);
  const laneEnds: number[] = [];
  for (const bar of sorted) {
    let lane = laneEnds.findIndex((end) => end < bar.column);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = bar.column + bar.span - 1;
    bar.lane = lane;
  }
  return Math.max(1, laneEnds.length);
}

export function buildPlanning(input: PlanningInput): PlanningRow[] {
  const { vehicles, contracts, clients, startDate, days, today } = input;
  const barsByVehicle = new Map<string, PlanningBar[]>();
  const push = (vehicleId: string | undefined, bar: PlanningBar | null) => {
    if (!vehicleId || !bar) return;
    const list = barsByVehicle.get(vehicleId) ?? [];
    list.push(bar);
    barsByVehicle.set(vehicleId, list);
  };

  const convertedReservations = new Set(contracts.map((c) => c.reservationId).filter(Boolean));

  for (const c of contracts) {
    if (c.status !== 'active' && c.status !== 'completed') continue;
    const end = effectiveEnd(c);
    push(
      c.vehicleId,
      place(
        {
          key: `contract-${c.id}`,
          kind: 'contract',
          contract: c,
          label: clientLabel(c.clientSnapshot?.firstName, c.clientSnapshot?.lastName) || c.contractNumber,
          start: c.startDate.slice(0, 10),
          end: end < c.startDate.slice(0, 10) ? c.startDate.slice(0, 10) : end,
          overdue: c.status === 'active' && end < today,
          done: c.status === 'completed',
        },
        startDate,
        days
      )
    );
  }

  for (const entry of collectReservations(clients)) {
    const r = entry.reservation;
    if (r.status !== 'active' || convertedReservations.has(r.id)) continue;
    push(
      r.vehicleId,
      place(
        {
          key: `reservation-${r.id}`,
          kind: 'reservation',
          reservation: r,
          client: entry.client,
          label: clientLabel(entry.client.firstName, entry.client.lastName),
          start: r.startDate.slice(0, 10),
          end: r.endDate < r.startDate ? r.startDate.slice(0, 10) : r.endDate.slice(0, 10),
          overdue: false,
          done: false,
        },
        startDate,
        days
      )
    );
  }

  return vehicles.map((vehicle) => {
    const bars = barsByVehicle.get(vehicle.id) ?? [];
    const lanes = assignLanes(bars);
    const occupiedToday = bars.some((b) => b.start <= today && b.end >= today && !b.done);
    return { vehicle, bars, lanes, freeToday: !occupiedToday && vehicle.status !== 'maintenance' && vehicle.status !== 'inactive' };
  });
}
