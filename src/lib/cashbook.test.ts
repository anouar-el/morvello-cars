import { describe, expect, it } from 'vitest';
import type { Contract, Vehicle } from '../types';
import { buildCashbook, cashbookToCsv, periodRange } from './cashbook';

const vehicle = (id: string, expenses: Array<{ id: string; date: string; costMAD: number; category?: string; title?: string }> = []): Vehicle =>
  ({
    id,
    brand: 'Dacia',
    model: 'Logan',
    plate: id,
    maintenanceExpenses: expenses.map((e) => ({ category: 'other', title: 'Dépense', ...e })),
  }) as unknown as Vehicle;

const contract = (id: string, vehicleId: string, payments: Array<{ id: string; date: string; amount: number; method?: string }>, status = 'active'): Contract =>
  ({
    id,
    contractNumber: `MC-${id}`,
    status,
    vehicleId,
    clientSnapshot: { firstName: 'Ali', lastName: 'Benani' },
    payments: payments.map((p) => ({ method: 'cash', ...p })),
  }) as unknown as Contract;

const range = { from: '2026-11-01', to: '2026-11-30' };

describe('periodRange', () => {
  const today = '2026-11-15';
  it('calcule les périodes prédéfinies', () => {
    expect(periodRange('today', today)).toEqual({ from: today, to: today });
    expect(periodRange('week', today)).toEqual({ from: '2026-11-09', to: today });
    expect(periodRange('month', today)).toEqual({ from: '2026-11-01', to: today });
    expect(periodRange('lastMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('year', today)).toEqual({ from: '2026-01-01', to: today });
  });

  it('gère le mois précédent en janvier', () => {
    expect(periodRange('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('buildCashbook', () => {
  it('additionne encaissements et dépenses de la période seulement', () => {
    const book = buildCashbook(
      [
        contract('1', 'v1', [
          { id: 'a', date: '2026-11-03', amount: 1000 },
          { id: 'b', date: '2026-10-30', amount: 500 },
          { id: 'c', date: '2026-11-10T09:00:00', amount: 200, method: 'tpe_card' },
        ]),
      ],
      [vehicle('v1', [{ id: 'e1', date: '2026-11-05', costMAD: 300, category: 'oil_change' }, { id: 'e2', date: '2026-12-01', costMAD: 999 }])],
      range
    );
    expect(book.totalIn).toBe(1200);
    expect(book.totalOut).toBe(300);
    expect(book.net).toBe(900);
    expect(book.entries.map((e) => e.date)).toEqual(['2026-11-10', '2026-11-05', '2026-11-03']);
  });

  it('ignore les contrats annulés et brouillons', () => {
    const book = buildCashbook(
      [
        contract('1', 'v1', [{ id: 'a', date: '2026-11-03', amount: 100 }], 'cancelled'),
        contract('2', 'v1', [{ id: 'b', date: '2026-11-03', amount: 100 }], 'draft'),
        contract('3', 'v1', [{ id: 'c', date: '2026-11-03', amount: 100 }], 'completed'),
      ],
      [vehicle('v1')],
      range
    );
    expect(book.totalIn).toBe(100);
  });

  it('ajoute à la date de départ le montant payé qui n\'a pas de ligne de paiement', () => {
    const noLines = { ...contract('1', 'v1', []), paidAmount: 800, startDate: '2026-11-04' } as Contract;
    const partial = { ...contract('2', 'v1', [{ id: 'a', date: '2026-11-06', amount: 300 }]), paidAmount: 500, startDate: '2026-11-05' } as Contract;
    const complete = { ...contract('3', 'v1', [{ id: 'b', date: '2026-11-06', amount: 200 }]), paidAmount: 200, startDate: '2026-11-05' } as Contract;
    const book = buildCashbook([noLines, partial, complete], [vehicle('v1')], range);
    expect(book.totalIn).toBe(800 + 500 + 200);
    expect(book.entries.filter((e) => e.undetailed).map((e) => [e.contractNumber, e.amount, e.date])).toEqual([
      ['MC-2', 200, '2026-11-05'],
      ['MC-1', 800, '2026-11-04'],
    ]);
    expect(book.byMethod).toEqual([{ method: 'cash', amount: 500 }]);
  });

  it('ignore les montants nuls ou invalides', () => {
    const book = buildCashbook(
      [contract('1', 'v1', [{ id: 'a', date: '2026-11-03', amount: 0 }, { id: 'b', date: '2026-11-03', amount: Number.NaN }])],
      [vehicle('v1', [{ id: 'e', date: '2026-11-03', costMAD: -5 }])],
      range
    );
    expect(book.entries).toEqual([]);
  });

  it('ventile par mode de paiement, par catégorie et par véhicule', () => {
    const book = buildCashbook(
      [
        contract('1', 'v1', [{ id: 'a', date: '2026-11-03', amount: 1000, method: 'cash' }, { id: 'b', date: '2026-11-04', amount: 400, method: 'virement' }]),
        contract('2', 'v2', [{ id: 'c', date: '2026-11-04', amount: 300, method: 'cash' }]),
      ],
      [
        vehicle('v1', [{ id: 'e1', date: '2026-11-05', costMAD: 200, category: 'tires' }]),
        vehicle('v2', [{ id: 'e2', date: '2026-11-05', costMAD: 500, category: 'tires' }]),
      ],
      range
    );
    expect(book.byMethod).toEqual([
      { method: 'cash', amount: 1300 },
      { method: 'virement', amount: 400 },
    ]);
    expect(book.byCategory).toEqual([{ category: 'tires', amount: 700 }]);
    expect(book.perVehicle.map((v) => [v.vehicleId, v.net])).toEqual([
      ['v1', 1200],
      ['v2', -200],
    ]);
  });
});

describe('cashbookToCsv', () => {
  it('échappe les guillemets et signe les sorties', () => {
    const csv = cashbookToCsv(
      [
        { key: '1', kind: 'in', date: '2026-11-03', amount: 100, label: 'Ali "Le Grand"', contractNumber: 'MC-1', method: 'cash' },
        { key: '2', kind: 'out', date: '2026-11-04', amount: 40, label: 'Vidange', category: 'oil_change' },
      ],
      { header: ['Date', 'Type', 'Libellé', 'Contrat', 'Détail', 'Montant'], kind: { in: 'Encaissement', out: 'Dépense' } }
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('"Date";"Type";"Libellé";"Contrat";"Détail";"Montant"');
    expect(lines[1]).toBe('"2026-11-03";"Encaissement";"Ali ""Le Grand""";"MC-1";"cash";"100"');
    expect(lines[2]).toBe('"2026-11-04";"Dépense";"Vidange";"";"oil_change";"-40"');
  });
});
