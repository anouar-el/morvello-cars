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

/**
 * Checks if two date intervals [startA, endA] and [startB, endB] overlap.
 * Format expected: YYYY-MM-DD
 */
export function doContractDatesOverlap(
  startA?: string,
  endA?: string,
  startB?: string,
  endB?: string
): boolean {
  if (!startA || !endA || !startB || !endB) return false;
  const sA = startA.trim().substring(0, 10);
  const eA = endA.trim().substring(0, 10);
  const sB = startB.trim().substring(0, 10);
  const eB = endB.trim().substring(0, 10);

  return sA <= eB && eA >= sB;
}

/**
 * Searches for any active or draft contract that already books the given vehicle during [startDate, endDate].
 */
export function findConflictingContract(
  vehicleId: string,
  startDate: string,
  endDate: string,
  contracts: Contract[],
  excludeContractId?: string,
  vehiclePlate?: string
): Contract | null {
  if (!vehicleId && !vehiclePlate) return null;
  const normPlate = vehiclePlate ? vehiclePlate.trim().toUpperCase() : '';

  for (const c of contracts) {
    if (!c || c.id === excludeContractId) continue;
    if (c.status !== 'active' && c.status !== 'draft') continue;

    const matchesVehicle =
      (vehicleId && c.vehicleId === vehicleId) ||
      (normPlate && c.vehicleSnapshot?.plate && c.vehicleSnapshot.plate.trim().toUpperCase() === normPlate);

    if (matchesVehicle) {
      if (doContractDatesOverlap(startDate, endDate, c.startDate, c.endDate)) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Determines whether a vehicle is available to be booked for the specified date range.
 */
export function isVehicleAvailableForPeriod(
  vehicleId: string,
  startDate: string,
  endDate: string,
  contracts: Contract[],
  vehicle?: Vehicle,
  excludeContractId?: string
): { available: boolean; conflictReason?: string; conflictingContract?: Contract } {
  if (vehicle) {
    if (vehicle.status === 'maintenance') {
      return { available: false, conflictReason: `Le véhicule ${vehicle.plate || vehicleId} est en cours de maintenance.` };
    }
    if (vehicle.status === 'inactive') {
      return { available: false, conflictReason: `Le véhicule ${vehicle.plate || vehicleId} est désactivé ou retiré de la flotte.` };
    }
  }

  const conflict = findConflictingContract(vehicleId, startDate, endDate, contracts, excludeContractId, vehicle?.plate);
  if (conflict) {
    return {
      available: false,
      conflictReason: `Le véhicule est déjà engagé dans le contrat ${conflict.contractNumber || conflict.id} du ${conflict.startDate} au ${conflict.endDate}.`,
      conflictingContract: conflict,
    };
  }

  return { available: true };
}
