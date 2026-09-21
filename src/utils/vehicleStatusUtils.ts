import { Vehicle, Contract } from '../types';

/**
 * Reconciles vehicle status with active contracts.
 * 
 * In car rental management:
 * 1. If a vehicle is tied to an active contract (status === 'active'),
 *    its effective status MUST be 'rented' and its currentKm must be at least the departureKm.
 * 2. If a vehicle has status 'rented' but there is NO active contract for it
 *    (e.g. after contract completion or deletion), its status should be 'available'.
 */
export function reconcileVehiclesWithContracts(
  vehicles: Vehicle[],
  contracts: Contract[]
): Vehicle[] {
  if (!vehicles || vehicles.length === 0) return [];
  const safeContracts = contracts || [];

  // Index active contracts by vehicleId and plate
  const activeContractsByVehId = new Map<string, Contract>();
  const activeContractsByPlate = new Map<string, Contract>();

  for (const c of safeContracts) {
    if (c.status === 'active') {
      if (c.vehicleId) {
        activeContractsByVehId.set(c.vehicleId, c);
      }
      if (c.vehicleSnapshot?.plate) {
        const norm = c.vehicleSnapshot.plate.trim().toUpperCase();
        activeContractsByPlate.set(norm, c);
      }
    }
  }

  return vehicles.map((veh) => {
    const normPlate = veh.plate ? veh.plate.trim().toUpperCase() : '';
    const activeContract =
      activeContractsByVehId.get(veh.id) ||
      (normPlate ? activeContractsByPlate.get(normPlate) : undefined);

    if (activeContract) {
      const depKm = Number(activeContract.departureKm) || 0;
      const effectiveKm = Math.max(veh.currentKm || 0, depKm);

      if (veh.status !== 'rented' || (depKm > 0 && (veh.currentKm || 0) < depKm)) {
        return {
          ...veh,
          status: 'rented' as const,
          currentKm: effectiveKm,
        };
      }
      return veh;
    } else {
      // No active contract for this vehicle
      // If it was previously marked rented, it should be available
      if (veh.status === 'rented') {
        return {
          ...veh,
          status: 'available' as const,
        };
      }
      return veh;
    }
  });
}
