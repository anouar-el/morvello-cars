import { describe, it, expect } from 'vitest';
import { reconcileVehiclesWithContracts } from './vehicleStatusUtils';
import { Vehicle, Contract } from '../types';

describe('vehicleStatusUtils', () => {
  it('correctly marks vehicle as rented when active contract exists', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'veh-46307',
        brand: 'PEUGEOT',
        model: 'PEUGEOT 208',
        plate: '46307 | A | 73',
        fuelType: 'Essence',
        status: 'available',
        currentKm: 42350,
        dailyRate: 300,
        year: 2025,
      },
    ];

    const contracts: Contract[] = [
      {
        id: 'cnt-2',
        contractNumber: 'MC-2026-0051',
        vehicleId: 'veh-46307',
        vehicleSnapshot: {
          id: 'veh-46307',
          plate: '46307 | A | 73',
          brand: 'PEUGEOT',
          model: 'PEUGEOT 208',
          fuelType: 'Essence',
        },
        status: 'active',
        startDate: '2026-09-20',
        endDate: '2026-09-26',
        departureKm: 42350,
        clientId: 'cli-1',
        clientSnapshot: {} as any,
        depositAmount: 5000,
        createdAt: '2026-09-20T10:00:00Z',
        createdBy: 'Said',
      } as unknown as Contract,
    ];

    const reconciled = reconcileVehiclesWithContracts(vehicles, contracts);
    expect(reconciled[0].status).toBe('rented');
    expect(reconciled[0].currentKm).toBe(42350);
  });

  it('restores vehicle to available when no active contracts exist', () => {
    const vehicles: Vehicle[] = [
      {
        id: 'veh-46307',
        brand: 'PEUGEOT',
        model: 'PEUGEOT 208',
        plate: '46307 | A | 73',
        fuelType: 'Essence',
        status: 'rented',
        currentKm: 42350,
        dailyRate: 300,
        year: 2025,
      },
    ];

    const contracts: Contract[] = [
      {
        id: 'cnt-2',
        contractNumber: 'MC-2026-0051',
        vehicleId: 'veh-46307',
        status: 'completed',
        startDate: '2026-09-20',
        endDate: '2026-09-26',
        departureKm: 42350,
        clientId: 'cli-1',
        clientSnapshot: {} as any,
        depositAmount: 5000,
        createdAt: '2026-09-20T10:00:00Z',
        createdBy: 'Said',
      } as unknown as Contract,
    ];

    const reconciled = reconcileVehiclesWithContracts(vehicles, contracts);
    expect(reconciled[0].status).toBe('available');
  });
});
