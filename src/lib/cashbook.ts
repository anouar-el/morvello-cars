import type { Contract, ExpenseCategory, PaymentMethod, Vehicle } from '../types';
import { addDays } from './planning';

/**
 * Caisse : encaissements (paiements des contrats) et dépenses (carnet de chaque véhicule) sur une période.
 * Module pur ; les dates sont des AAAA-MM-JJ.
 */

export type CashKind = 'in' | 'out';

export interface CashEntry {
  key: string;
  kind: CashKind;
  date: string;
  amount: number;
  label: string;
  method?: PaymentMethod;
  category?: ExpenseCategory;
  vehicleId?: string;
  contractNumber?: string;
  /** Montant payé connu du contrat mais sans ligne de paiement : daté du départ de la location. */
  undetailed?: boolean;
}

export interface VehicleCash {
  vehicleId: string;
  label: string;
  plate: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface Cashbook {
  entries: CashEntry[];
  totalIn: number;
  totalOut: number;
  net: number;
  byMethod: Array<{ method: PaymentMethod; amount: number }>;
  byCategory: Array<{ category: ExpenseCategory; amount: number }>;
  perVehicle: VehicleCash[];
}

export type PeriodPreset = 'today' | 'week' | 'month' | 'lastMonth' | 'year';

export interface DateRange {
  from: string;
  to: string;
}

const firstOfMonth = (date: string) => `${date.slice(0, 7)}-01`;

/** Bornes (incluses) d'une période prédéfinie, calculées à partir d'aujourd'hui. */
export function periodRange(preset: PeriodPreset, today: string): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: addDays(today, -6), to: today };
    case 'month':
      return { from: firstOfMonth(today), to: today };
    case 'lastMonth': {
      const lastDayPrev = addDays(firstOfMonth(today), -1);
      return { from: firstOfMonth(lastDayPrev), to: lastDayPrev };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

const inRange = (date: string, range: DateRange) => date >= range.from && date <= range.to;
const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function buildCashbook(contracts: Contract[], vehicles: Vehicle[], range: DateRange): Cashbook {
  const entries: CashEntry[] = [];
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  for (const c of contracts) {
    if (c.status === 'cancelled' || c.status === 'draft') continue;
    const who = `${c.clientSnapshot?.lastName ?? ''} ${c.clientSnapshot?.firstName ?? ''}`.trim() || c.contractNumber;
    const recorded = (c.payments ?? []).reduce((s, p) => s + money(p.amount), 0);
    const gap = money(c.paidAmount) - recorded;
    const gapDate = (c.startDate ?? '').slice(0, 10);
    if (gap > 0 && inRange(gapDate, range)) {
      entries.push({
        key: `in-${c.id}-undetailed`,
        kind: 'in',
        date: gapDate,
        amount: gap,
        label: who,
        vehicleId: c.vehicleId,
        contractNumber: c.contractNumber,
        undetailed: true,
      });
    }
    for (const p of c.payments ?? []) {
      const date = (p.date ?? '').slice(0, 10);
      const amount = money(p.amount);
      if (!amount || !inRange(date, range)) continue;
      entries.push({
        key: `in-${c.id}-${p.id}`,
        kind: 'in',
        date,
        amount,
        label: who,
        method: p.method,
        vehicleId: c.vehicleId,
        contractNumber: c.contractNumber,
      });
    }
  }

  for (const v of vehicles) {
    for (const e of v.maintenanceExpenses ?? []) {
      const date = (e.date ?? '').slice(0, 10);
      const amount = money(e.costMAD);
      if (!amount || !inRange(date, range)) continue;
      entries.push({
        key: `out-${v.id}-${e.id}`,
        kind: 'out',
        date,
        amount,
        label: e.title,
        category: e.category,
        vehicleId: v.id,
      });
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));

  const sum = (kind: CashKind) => entries.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
  const totalIn = sum('in');
  const totalOut = sum('out');

  const methods = new Map<PaymentMethod, number>();
  const categories = new Map<ExpenseCategory, number>();
  const perVehicleMap = new Map<string, { revenue: number; expenses: number }>();
  for (const e of entries) {
    if (e.kind === 'in' && e.method) methods.set(e.method, (methods.get(e.method) ?? 0) + e.amount);
    if (e.kind === 'out' && e.category) categories.set(e.category, (categories.get(e.category) ?? 0) + e.amount);
    if (e.vehicleId) {
      const row = perVehicleMap.get(e.vehicleId) ?? { revenue: 0, expenses: 0 };
      if (e.kind === 'in') row.revenue += e.amount;
      else row.expenses += e.amount;
      perVehicleMap.set(e.vehicleId, row);
    }
  }

  const desc = <T extends { amount: number }>(a: T, b: T) => b.amount - a.amount;
  const perVehicle: VehicleCash[] = [...perVehicleMap.entries()]
    .map(([vehicleId, row]) => {
      const v = vehicleById.get(vehicleId);
      return {
        vehicleId,
        label: v ? `${v.brand} ${v.model}`.trim() : vehicleId,
        plate: v?.plate ?? '',
        revenue: row.revenue,
        expenses: row.expenses,
        net: row.revenue - row.expenses,
      };
    })
    .sort((a, b) => b.net - a.net);

  return {
    entries,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    byMethod: [...methods.entries()].map(([method, amount]) => ({ method, amount })).sort(desc),
    byCategory: [...categories.entries()].map(([category, amount]) => ({ category, amount })).sort(desc),
    perVehicle,
  };
}

/** CSV (séparateur point-virgule, lisible par Excel en français) des écritures de la période. */
export function cashbookToCsv(entries: CashEntry[], labels: { header: string[]; kind: Record<CashKind, string> }): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [e.date, labels.kind[e.kind], e.label, e.contractNumber ?? '', e.method ?? e.category ?? '', e.kind === 'in' ? e.amount : -e.amount].map(esc).join(';')
  );
  return [labels.header.map(esc).join(';'), ...rows].join('\r\n');
}
