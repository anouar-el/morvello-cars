import { describe, it, expect } from 'vitest';
import { computeOperationalAlerts } from './alertsUtils';
import { getTodayDateString, getVehicleHealthSummary } from './vehicleExpiryUtils';
import type { Vehicle } from '../types';

const vehicle = (over: Partial<Vehicle>): Vehicle =>
  ({
    id: 'v1',
    brand: 'DACIA',
    model: 'Logan',
    plate: '12345-A-6',
    fuelType: 'Diesel',
    status: 'available',
    currentKm: 10000,
    vignettePaidYear: 2026,
    ...over,
  }) as Vehicle;

describe('computeOperationalAlerts', () => {
  it('returns no alerts when the authenticated workspace has no records', () => {
    const { alerts } = computeOperationalAlerts([], [], [], '2026-09-22');
    expect(alerts).toEqual([]);
  });

  it('traite comme critique une assurance qui expire dans 7 jours ou moins', () => {
    const { alerts } = computeOperationalAlerts([vehicle({ insuranceExpiryDate: '2026-10-05' })], [], [], '2026-10-01');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].badgeText).toBe('Dans 4j');
  });

  it("garde un simple avertissement entre 8 et 30 jours", () => {
    const { alerts } = computeOperationalAlerts([vehicle({ insuranceExpiryDate: '2026-10-21' })], [], [], '2026-10-01');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].badgeText).toBe('Dans 20j');
  });

  it("classe l'échéance la plus proche en premier à gravité égale", () => {
    const { alerts } = computeOperationalAlerts(
      [
        vehicle({ id: 'far', insuranceExpiryDate: '2026-10-25' }),
        vehicle({ id: 'near', insuranceExpiryDate: '2026-10-12' }),
      ],
      [],
      [],
      '2026-10-01'
    );
    expect(alerts.map((a) => a.entityId)).toEqual(['near', 'far']);
  });
});

describe('getVehicleHealthSummary', () => {
  it("juge la vignette d'après l'année de la date de référence, pas une année figée", () => {
    const v = vehicle({ vignettePaidYear: 2026 });
    expect(getVehicleHealthSummary(v, '2026-10-01').alerts.some((a) => a.type === 'vignette')).toBe(false);
    expect(getVehicleHealthSummary(v, '2027-02-01').alerts.some((a) => a.type === 'vignette')).toBe(true);
  });
});

describe('getTodayDateString', () => {
  it("utilise la date locale (pas UTC)", () => {
    // 00:30 heure locale le 17 octobre : en UTC (UTC+1 → 23:30 la veille), l'ancienne version rendait le 16
    expect(getTodayDateString(new Date(2026, 9, 17, 0, 30))).toBe('2026-10-17');
  });
});