import { describe, expect, it } from 'vitest';
import {
  INSURANCE_PACKS,
  VEHICLE_CATEGORIES,
  buildContractInsurance,
  getPackTerms,
  getVehicleCategory,
  inferVehicleCategory,
  resolveContractInsurance,
} from './insurancePacks';

describe('insurance packs (grille morvellocars.com, 1 EUR = 10 MAD)', () => {
  it('converts the published EUR grid to MAD', () => {
    expect(getPackTerms('citadine', 'base')).toEqual({ dailySupplementMad: 0, franchiseMad: 8000, depositMad: 8000 });
    expect(getPackTerms('suv', 'ameliore')).toEqual({ dailySupplementMad: 180, franchiseMad: 5000, depositMad: 5000 });
    expect(getPackTerms('premium', 'confort')).toEqual({ dailySupplementMad: 600, franchiseMad: 4000, depositMad: 0 });
  });

  it('always keeps a franchise, and never asks a deposit above it', () => {
    for (const cat of VEHICLE_CATEGORIES) {
      for (const pack of INSURANCE_PACKS) {
        const terms = getPackTerms(cat.id, pack.id);
        expect(terms.franchiseMad).toBeGreaterThan(0);
        expect(terms.depositMad).toBeLessThanOrEqual(terms.franchiseMad);
      }
    }
  });

  it('infers the vehicle category from the model names used on the website', () => {
    expect(inferVehicleCategory('RENAULT', 'Clio 5')).toBe('citadine');
    expect(inferVehicleCategory('DACIA', 'Duster')).toBe('suv');
    expect(inferVehicleCategory('VOLKSWAGEN', 'T-Roc')).toBe('suv');
    expect(inferVehicleCategory('LAND ROVER', 'Range Rover Velar')).toBe('premium');
    expect(inferVehicleCategory('VOLKSWAGEN', 'Golf 8 Sport')).toBe('premium');
  });

  it('prefers the category set on the vehicle over the inferred one', () => {
    expect(getVehicleCategory({ brand: 'DACIA', model: 'Duster', insuranceCategory: 'premium' })).toBe('premium');
    expect(getVehicleCategory({ brand: 'DACIA', model: 'Duster', insuranceCategory: null })).toBe('suv');
  });

  it('falls back to the included base pack for contracts created before packs existed', () => {
    const legacy = resolveContractInsurance({
      vehicleSnapshot: { id: 'v', brand: 'HYUNDAI', model: 'Tucson', plate: 'x', fuelType: 'Diesel' as any },
    });
    expect(legacy).toMatchObject({ packId: 'base', category: 'suv', franchiseMad: 10000 });

    const frozen = buildContractInsurance('citadine', 'confort');
    expect(resolveContractInsurance({ insurance: frozen, vehicleSnapshot: legacy as any })).toBe(frozen);
  });
});
