import { describe, expect, it } from 'vitest';
import type { Client, Contract, Reservation } from '../types';
import {
  activeReservations,
  findVehicleConflicts,
  patchReservation,
  reservationTiming,
  toContractDraft,
  validateReservationDates,
} from './reservations';

const res = (over: Partial<Reservation>): Reservation => ({
  id: 'r1',
  createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: 'Anouar',
  startDate: '2026-10-25',
  startTime: '10:00',
  endDate: '2026-10-30',
  endTime: '18:00',
  status: 'active',
  ...over,
});

const client = (id: string, reservations: Reservation[]): Client =>
  ({ id, firstName: 'Ali', lastName: id.toUpperCase(), reservations }) as Client;

describe('reservationTiming', () => {
  const today = '2026-10-21';
  it('classe selon le nombre de jours avant le départ', () => {
    expect(reservationTiming(res({ startDate: '2026-10-20' }), today)).toEqual({ timing: 'overdue', daysUntil: -1 });
    expect(reservationTiming(res({ startDate: '2026-10-21' }), today).timing).toBe('today');
    expect(reservationTiming(res({ startDate: '2026-10-23' }), today).timing).toBe('soon');
    expect(reservationTiming(res({ startDate: '2026-10-24' }), today).timing).toBe('upcoming');
  });
});

describe('activeReservations', () => {
  it('ne garde que les réservations actives, la plus proche en premier', () => {
    const list = activeReservations([
      client('a', [res({ id: 'late', startDate: '2026-11-05' }), res({ id: 'done', status: 'converted' })]),
      client('b', [res({ id: 'soon', startDate: '2026-10-22' }), res({ id: 'gone', status: 'cancelled' })]),
    ]);
    expect(list.map((e) => e.reservation.id)).toEqual(['soon', 'late']);
  });
});

describe('réservation transformée en contrat', () => {
  it("n'est plus à traiter dès qu'un contrat en est issu", () => {
    const clients = [client('a', [res({ id: 'r-done' }), res({ id: 'r-open', startDate: '2026-11-01' })])];
    const contracts = [{ id: 'c1', reservationId: 'r-done' } as Contract];
    expect(activeReservations(clients, contracts).map((e) => e.reservation.id)).toEqual(['r-open']);
  });
});

describe('findVehicleConflicts', () => {
  const clients = [client('a', [res({ id: 'r-a', vehicleId: 'v1', startDate: '2026-10-25', endDate: '2026-10-30' })])];
  const contract = (over: Partial<Contract>) =>
    ({ id: 'c1', vehicleId: 'v1', status: 'active', startDate: '2026-10-10', endDate: '2026-10-20', ...over }) as Contract;

  it('trouve une autre réservation qui chevauche, bornes comprises', () => {
    const q = { clients, contracts: [], vehicleId: 'v1', startDate: '2026-10-30', endDate: '2026-11-02' };
    expect(findVehicleConflicts(q).reservations).toHaveLength(1);
    expect(findVehicleConflicts({ ...q, startDate: '2026-10-31' }).reservations).toHaveLength(0);
  });

  it("ignore la réservation en cours de modification et les autres véhicules", () => {
    const q = { clients, contracts: [], vehicleId: 'v1', startDate: '2026-10-26', endDate: '2026-10-28' };
    expect(findVehicleConflicts({ ...q, ignoreReservationId: 'r-a' }).reservations).toHaveLength(0);
    expect(findVehicleConflicts({ ...q, vehicleId: 'v2' }).reservations).toHaveLength(0);
  });

  it("tient compte d'un contrat en cours, y compris prolongé", () => {
    const q = { clients: [], vehicleId: 'v1', startDate: '2026-10-22', endDate: '2026-10-24' };
    expect(findVehicleConflicts({ ...q, contracts: [contract({})] }).contracts).toHaveLength(0);
    const prolonged = contract({ prolongation: { isActive: true, newEndDate: '2026-10-23', newEndTime: '18:00' } });
    expect(findVehicleConflicts({ ...q, contracts: [prolonged] }).contracts).toHaveLength(1);
    expect(findVehicleConflicts({ ...q, contracts: [contract({ status: 'completed', endDate: '2026-10-23' })] }).contracts).toHaveLength(0);
  });

  it('ne signale rien sans véhicule ni dates', () => {
    expect(findVehicleConflicts({ clients, contracts: [], vehicleId: '', startDate: '', endDate: '' })).toEqual({
      reservations: [],
      contracts: [],
    });
  });
});

describe('validateReservationDates', () => {
  it('refuse des dates absentes ou inversées', () => {
    expect(validateReservationDates({ startDate: '', endDate: '2026-10-30' })).not.toBeNull();
    expect(validateReservationDates({ startDate: '2026-10-30', endDate: '2026-10-25' })).not.toBeNull();
    expect(validateReservationDates({ startDate: '2026-10-25', endDate: '2026-10-25' })).toBeNull();
  });
});

describe('toContractDraft / patchReservation', () => {
  it("reprend client, véhicule, dates et acompte de la réservation", () => {
    const c = client('a', [res({ id: 'r9', vehicleId: 'v7', deposit: 500 })]);
    expect(toContractDraft({ client: c, reservation: c.reservations![0] })).toMatchObject({
      reservationId: 'r9',
      clientId: 'a',
      vehicleId: 'v7',
      startDate: '2026-10-25',
      deposit: 500,
    });
  });

  it("ne modifie que la réservation visée", () => {
    const list = [res({ id: 'x' }), res({ id: 'y' })];
    const next = patchReservation(list, 'y', { status: 'cancelled' });
    expect(next.map((r) => r.status)).toEqual(['active', 'cancelled']);
    expect(list[1].status).toBe('active');
  });
});
