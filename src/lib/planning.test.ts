import { describe, expect, it } from 'vitest';
import type { Client, Contract, Vehicle } from '../types';
import { addDays, buildPlanning, dayOffset, isWeekend, rangeDays } from './planning';

const vehicle = (id: string, over: Partial<Vehicle> = {}): Vehicle => ({ id, brand: 'Dacia', model: 'Logan', plate: id, status: 'available', ...over }) as Vehicle;

const contract = (id: string, vehicleId: string, startDate: string, endDate: string, over: Partial<Contract> = {}): Contract =>
  ({
    id,
    contractNumber: `MC-${id}`,
    status: 'active',
    vehicleId,
    startDate,
    endDate,
    prolongation: { isActive: false },
    clientSnapshot: { firstName: 'Ali', lastName: 'Benani' },
    ...over,
  }) as Contract;

const base = { startDate: '2026-11-02', days: 7, today: '2026-11-04', clients: [] as Client[] };

describe('dates', () => {
  it('ajoute des jours à travers les mois et années', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compte les jours et liste la période', () => {
    expect(dayOffset('2026-11-02', '2026-11-05')).toBe(3);
    expect(dayOffset('2026-11-05', '2026-11-02')).toBe(-3);
    expect(rangeDays('2026-11-02', 3)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('repère le week-end', () => {
    expect(isWeekend('2026-11-07')).toBe(true);
    expect(isWeekend('2026-11-08')).toBe(true);
    expect(isWeekend('2026-11-09')).toBe(false);
  });
});

describe('buildPlanning', () => {
  it('place une barre sur la bonne colonne avec la bonne largeur', () => {
    const [row] = buildPlanning({ ...base, vehicles: [vehicle('v1')], contracts: [contract('1', 'v1', '2026-11-03', '2026-11-05')] });
    expect(row.bars).toHaveLength(1);
    expect(row.bars[0]).toMatchObject({ column: 1, span: 3, clippedStart: false, clippedEnd: false, label: 'Benani Ali' });
  });

  it('coupe une barre qui dépasse de la période', () => {
    const [row] = buildPlanning({ ...base, vehicles: [vehicle('v1')], contracts: [contract('1', 'v1', '2026-10-28', '2026-11-20')] });
    expect(row.bars[0]).toMatchObject({ column: 0, span: 7, clippedStart: true, clippedEnd: true });
  });

  it('ignore ce qui est hors période, annulé ou brouillon', () => {
    const [row] = buildPlanning({
      ...base,
      vehicles: [vehicle('v1')],
      contracts: [
        contract('1', 'v1', '2026-10-01', '2026-10-10'),
        contract('2', 'v1', '2026-11-03', '2026-11-04', { status: 'cancelled' }),
        contract('3', 'v1', '2026-11-03', '2026-11-04', { status: 'draft' }),
      ],
    });
    expect(row.bars).toEqual([]);
  });

  it('tient compte de la prolongation et signale un retard', () => {
    const prolonged = contract('1', 'v1', '2026-11-01', '2026-11-02', { prolongation: { isActive: true, newEndDate: '2026-11-06' } as Contract['prolongation'] });
    const late = contract('2', 'v2', '2026-10-30', '2026-11-03');
    const rows = buildPlanning({ ...base, vehicles: [vehicle('v1'), vehicle('v2')], contracts: [prolonged, late] });
    expect(rows[0].bars[0]).toMatchObject({ span: 5, overdue: false });
    expect(rows[1].bars[0].overdue).toBe(true);
  });

  it('empile sur deux rangs deux barres qui se chevauchent', () => {
    const [row] = buildPlanning({
      ...base,
      vehicles: [vehicle('v1')],
      contracts: [contract('1', 'v1', '2026-11-02', '2026-11-04'), contract('2', 'v1', '2026-11-04', '2026-11-06')],
    });
    expect(row.lanes).toBe(2);
    expect(new Set(row.bars.map((b) => b.lane))).toEqual(new Set([0, 1]));
  });

  it('met côte à côte deux barres qui ne se chevauchent pas', () => {
    const [row] = buildPlanning({
      ...base,
      vehicles: [vehicle('v1')],
      contracts: [contract('1', 'v1', '2026-11-02', '2026-11-03'), contract('2', 'v1', '2026-11-04', '2026-11-06')],
    });
    expect(row.lanes).toBe(1);
  });

  it('affiche les réservations actives, pas celles déjà devenues contrat', () => {
    const client = {
      id: 'cl',
      firstName: 'Sara',
      lastName: 'Alami',
      reservations: [
        { id: 'r1', status: 'active', vehicleId: 'v1', startDate: '2026-11-05', endDate: '2026-11-07' },
        { id: 'r2', status: 'active', vehicleId: 'v1', startDate: '2026-11-02', endDate: '2026-11-03' },
        { id: 'r3', status: 'cancelled', vehicleId: 'v1', startDate: '2026-11-02', endDate: '2026-11-03' },
        { id: 'r4', status: 'active', startDate: '2026-11-02', endDate: '2026-11-03' },
      ],
    } as unknown as Client;
    const [row] = buildPlanning({ ...base, clients: [client], vehicles: [vehicle('v1')], contracts: [contract('9', 'v1', '2026-11-02', '2026-11-03', { reservationId: 'r2' })] });
    const reservations = row.bars.filter((b) => b.kind === 'reservation');
    expect(reservations.map((b) => b.reservation?.id)).toEqual(['r1']);
  });

  it("indique les véhicules libres aujourd'hui", () => {
    const rows = buildPlanning({
      ...base,
      vehicles: [vehicle('free'), vehicle('busy'), vehicle('garage', { status: 'maintenance' }), vehicle('past')],
      contracts: [contract('1', 'busy', '2026-11-03', '2026-11-05'), contract('2', 'past', '2026-11-02', '2026-11-03')],
    });
    expect(rows.map((r) => r.freeToday)).toEqual([true, false, false, true]);
  });
});
