import { describe, expect, it } from 'vitest';
import type { Contract, Vehicle } from '../types';
import { buildReport, monthlySeries, periodDays, rentedDays, reportToCsv } from './reports';

const vehicle = (id: string, expenses: Array<{ id: string; date: string; costMAD: number }> = []): Vehicle =>
  ({ id, brand: 'Dacia', model: 'Logan', plate: id, maintenanceExpenses: expenses.map((e) => ({ category: 'other', title: 'Dépense', ...e })) }) as unknown as Vehicle;

const contract = (id: string, vehicleId: string, startDate: string, endDate: string, over: Partial<Contract> = {}): Contract =>
  ({
    id,
    contractNumber: `MC-${id}`,
    status: 'active',
    vehicleId,
    clientId: 'cl1',
    startDate,
    endDate,
    totalAmount: 1000,
    remainingAmount: 0,
    paidAmount: 0,
    payments: [],
    prolongation: { isActive: false },
    clientSnapshot: { firstName: 'Ali', lastName: 'Benani' },
    ...over,
  }) as unknown as Contract;

const range = { from: '2026-11-01', to: '2026-11-10' };

describe('rentedDays', () => {
  it('compte une seule fois les jours qui se chevauchent et coupe à la période', () => {
    const days = rentedDays(
      [contract('1', 'v', '2026-10-28', '2026-11-03'), contract('2', 'v', '2026-11-02', '2026-11-05'), contract('3', 'v', '2026-11-09', '2026-11-20')],
      range
    );
    // 1→5 (5 jours) + 9→10 (2 jours)
    expect(days).toBe(7);
  });

  it('compte les jours adjacents comme continus', () => {
    expect(rentedDays([contract('1', 'v', '2026-11-01', '2026-11-02'), contract('2', 'v', '2026-11-03', '2026-11-04')], range)).toBe(4);
  });

  it('renvoie 0 sans location dans la période', () => {
    expect(rentedDays([contract('1', 'v', '2026-09-01', '2026-09-05')], range)).toBe(0);
  });
});

describe('buildReport', () => {
  it("calcule l'occupation de la flotte et par véhicule", () => {
    const report = buildReport([contract('1', 'v1', '2026-11-01', '2026-11-05')], [vehicle('v1'), vehicle('v2')], range);
    expect(periodDays(range)).toBe(10);
    expect(report.vehicles.find((v) => v.vehicleId === 'v1')?.occupancy).toBe(0.5);
    expect(report.occupancy).toBe(0.25);
  });

  it('additionne facturé, encaissé, dépenses et reste à payer', () => {
    const c = contract('1', 'v1', '2026-11-02', '2026-11-04', {
      totalAmount: 900,
      remainingAmount: 400,
      payments: [{ id: 'p', date: '2026-11-02', amount: 500, method: 'cash' }] as Contract['payments'],
    });
    const report = buildReport([c, contract('2', 'v1', '2026-10-01', '2026-10-03', { totalAmount: 5000 })], [vehicle('v1', [{ id: 'e', date: '2026-11-03', costMAD: 120 }])], range);
    expect(report).toMatchObject({ contractsCount: 1, billed: 900, collected: 500, expenses: 120, net: 380, outstanding: 400 });
    expect(report.avgBilled).toBe(900);
  });

  it('classe les véhicules par résultat et les clients par montant facturé', () => {
    const contracts = [
      contract('1', 'v1', '2026-11-01', '2026-11-02', { clientId: 'a', totalAmount: 300, clientSnapshot: { firstName: 'A', lastName: 'Alpha' } as Contract['clientSnapshot'], payments: [{ id: 'p1', date: '2026-11-01', amount: 300, method: 'cash' }] as Contract['payments'] }),
      contract('2', 'v2', '2026-11-01', '2026-11-02', { clientId: 'b', totalAmount: 900, clientSnapshot: { firstName: 'B', lastName: 'Beta' } as Contract['clientSnapshot'], payments: [{ id: 'p2', date: '2026-11-01', amount: 900, method: 'cash' }] as Contract['payments'] }),
      contract('3', 'v2', '2026-11-05', '2026-11-06', { clientId: 'a', totalAmount: 100, clientSnapshot: { firstName: 'A', lastName: 'Alpha' } as Contract['clientSnapshot'] }),
    ];
    const report = buildReport(contracts, [vehicle('v1'), vehicle('v2')], range);
    expect(report.vehicles.map((v) => v.vehicleId)).toEqual(['v2', 'v1']);
    expect(report.topClients.map((c) => [c.name, c.contracts, c.billed])).toEqual([
      ['Beta B', 1, 900],
      ['Alpha A', 2, 400],
    ]);
  });

  it('ne plante pas sans véhicule ni contrat', () => {
    const report = buildReport([], [], range);
    expect(report).toMatchObject({ occupancy: 0, contractsCount: 0, billed: 0, avgDays: 0, avgBilled: 0 });
  });
});

describe('monthlySeries', () => {
  it('renvoie les derniers mois dans l\'ordre, du plus ancien au plus récent', () => {
    const paid = (id: string, date: string, amount: number) =>
      contract(id, 'v1', date, date, { payments: [{ id: `p${id}`, date, amount, method: 'cash' }] as Contract['payments'] });
    const series = monthlySeries(
      [paid('1', '2026-09-15', 100), paid('2', '2026-10-31', 200), paid('3', '2026-11-03', 300), paid('4', '2026-11-20', 999)],
      [vehicle('v1', [{ id: 'e', date: '2026-10-05', costMAD: 40 }])],
      '2026-11-10',
      3
    );
    expect(series.map((p) => p.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(series.map((p) => p.collected)).toEqual([100, 200, 300]);
    expect(series[1].expenses).toBe(40);
  });

  it('passe correctement la limite d\'année', () => {
    expect(monthlySeries([], [], '2027-01-15', 3).map((p) => p.month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('reportToCsv', () => {
  it('écrit une ligne par véhicule avec le taux en pourcentage', () => {
    const csv = reportToCsv(
      [{ vehicleId: 'v', label: 'Dacia Logan', plate: '123', rentalDays: 5, occupancy: 0.5, contracts: 2, billed: 1000, collected: 800, expenses: 100, net: 700 }],
      ['A', 'B']
    );
    expect(csv.split('\r\n')[1]).toBe('"Dacia Logan";"123";"5";"50";"2";"1000";"800";"100";"700"');
  });
});
