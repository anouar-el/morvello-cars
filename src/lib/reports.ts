import type { Contract, Vehicle } from '../types';
import { buildCashbook, type DateRange } from './cashbook';
import { addDays, dayOffset } from './planning';

/**
 * Rapports : activité de la période (occupation, chiffre d'affaires, rentabilité, meilleurs clients, évolution).
 * Module pur ; les dates sont des AAAA-MM-JJ. Les montants encaissés et les dépenses viennent de la caisse.
 */

export interface VehicleReport {
  vehicleId: string;
  label: string;
  plate: string;
  rentalDays: number;
  /** Part des jours de la période où le véhicule était loué, de 0 à 1. */
  occupancy: number;
  contracts: number;
  billed: number;
  collected: number;
  expenses: number;
  /** Encaissé moins dépenses. */
  net: number;
}

export interface ClientReport {
  key: string;
  name: string;
  contracts: number;
  billed: number;
}

export interface Report {
  range: DateRange;
  days: number;
  fleetSize: number;
  occupancy: number;
  contractsCount: number;
  /** Total des contrats commencés dans la période. */
  billed: number;
  collected: number;
  expenses: number;
  net: number;
  /** Reste à payer sur les contrats commencés dans la période. */
  outstanding: number;
  avgDays: number;
  avgBilled: number;
  vehicles: VehicleReport[];
  topClients: ClientReport[];
}

const effectiveEnd = (c: Contract) => (c.prolongation?.isActive && c.prolongation.newEndDate ? c.prolongation.newEndDate : c.endDate).slice(0, 10);
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const isRental = (c: Contract) => c.status === 'active' || c.status === 'completed';

export function periodDays(range: DateRange): number {
  return Math.max(1, dayOffset(range.from, range.to) + 1);
}

/** Jours distincts loués dans la période : les locations qui se chevauchent ne comptent qu'une fois. */
export function rentedDays(contracts: Contract[], range: DateRange): number {
  const spans = contracts
    .map((c) => ({ from: c.startDate.slice(0, 10) < range.from ? range.from : c.startDate.slice(0, 10), to: effectiveEnd(c) > range.to ? range.to : effectiveEnd(c) }))
    .filter((s) => s.to >= s.from)
    .sort((a, b) => a.from.localeCompare(b.from));
  let total = 0;
  let curFrom = '';
  let curTo = '';
  for (const s of spans) {
    if (!curFrom) {
      curFrom = s.from;
      curTo = s.to;
    } else if (s.from <= addDays(curTo, 1)) {
      if (s.to > curTo) curTo = s.to;
    } else {
      total += dayOffset(curFrom, curTo) + 1;
      curFrom = s.from;
      curTo = s.to;
    }
  }
  if (curFrom) total += dayOffset(curFrom, curTo) + 1;
  return total;
}

export function buildReport(contracts: Contract[], vehicles: Vehicle[], range: DateRange): Report {
  const days = periodDays(range);
  const rentals = contracts.filter(isRental);
  const cash = buildCashbook(contracts, vehicles, range);
  const cashByVehicle = new Map(cash.perVehicle.map((v) => [v.vehicleId, v]));
  const started = rentals.filter((c) => c.startDate.slice(0, 10) >= range.from && c.startDate.slice(0, 10) <= range.to);

  const vehicleReports: VehicleReport[] = vehicles.map((v) => {
    const own = rentals.filter((c) => c.vehicleId === v.id);
    const rentalDays = rentedDays(own, range);
    const ownStarted = started.filter((c) => c.vehicleId === v.id);
    const money = cashByVehicle.get(v.id);
    return {
      vehicleId: v.id,
      label: `${v.brand} ${v.model}`.trim(),
      plate: v.plate,
      rentalDays,
      occupancy: Math.min(1, rentalDays / days),
      contracts: ownStarted.length,
      billed: ownStarted.reduce((s, c) => s + num(c.totalAmount), 0),
      collected: money?.revenue ?? 0,
      expenses: money?.expenses ?? 0,
      net: money?.net ?? 0,
    };
  });

  const totalRentalDays = vehicleReports.reduce((s, v) => s + v.rentalDays, 0);
  const billed = started.reduce((s, c) => s + num(c.totalAmount), 0);

  const clients = new Map<string, ClientReport>();
  for (const c of started) {
    const key = c.clientId || c.clientSnapshot?.id || c.clientSnapshot?.docNumber || c.contractNumber;
    const name = `${c.clientSnapshot?.lastName ?? ''} ${c.clientSnapshot?.firstName ?? ''}`.trim() || c.contractNumber;
    const row = clients.get(key) ?? { key, name, contracts: 0, billed: 0 };
    row.contracts += 1;
    row.billed += num(c.totalAmount);
    clients.set(key, row);
  }

  return {
    range,
    days,
    fleetSize: vehicles.length,
    occupancy: vehicles.length ? Math.min(1, totalRentalDays / (vehicles.length * days)) : 0,
    contractsCount: started.length,
    billed,
    collected: cash.totalIn,
    expenses: cash.totalOut,
    net: cash.net,
    outstanding: started.reduce((s, c) => s + num(c.remainingAmount), 0),
    avgDays: started.length ? started.reduce((s, c) => s + (num(c.totalDays) || dayOffset(c.startDate.slice(0, 10), effectiveEnd(c)) + 1), 0) / started.length : 0,
    avgBilled: started.length ? billed / started.length : 0,
    vehicles: vehicleReports.sort((a, b) => b.net - a.net || b.rentalDays - a.rentalDays),
    topClients: [...clients.values()].sort((a, b) => b.billed - a.billed || b.contracts - a.contracts).slice(0, 5),
  };
}

export interface MonthPoint {
  month: string;
  collected: number;
  expenses: number;
}

/** Encaissé et dépenses des `count` derniers mois (le dernier va jusqu'à aujourd'hui). */
export function monthlySeries(contracts: Contract[], vehicles: Vehicle[], today: string, count = 6): MonthPoint[] {
  const points: MonthPoint[] = [];
  let first = `${today.slice(0, 7)}-01`;
  for (let i = 0; i < count; i += 1) {
    const last = i === 0 ? today : addDays(addDays(first, 32).slice(0, 7) + '-01', -1);
    const book = buildCashbook(contracts, vehicles, { from: first, to: last });
    points.unshift({ month: first.slice(0, 7), collected: book.totalIn, expenses: book.totalOut });
    first = `${addDays(first, -1).slice(0, 7)}-01`;
  }
  return points;
}

/** CSV (point-virgule) du tableau par véhicule. */
export function reportToCsv(vehicles: VehicleReport[], header: string[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = vehicles.map((v) =>
    [v.label, v.plate, v.rentalDays, Math.round(v.occupancy * 100), v.contracts, v.billed, v.collected, v.expenses, v.net].map(esc).join(';')
  );
  return [header.map(esc).join(';'), ...rows].join('\r\n');
}
