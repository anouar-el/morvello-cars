import { Client, ClientSnapshot, Contract, Vehicle, VehicleSnapshot, DepositRecord } from '../types';

// Répercussion d'une modification de fiche client / véhicule sur les contrats et cautions
// qui en portent une copie (clientSnapshot / vehicleSnapshot, clientName, vehiclePlate...).
//
//  - 'open' : contrats non clôturés (brouillon, actif…)            -> recommandé
//  - 'all'  : tous les contrats, y compris terminés / annulés
//  - 'none' : ne rien répercuter, les contrats gardent leurs valeurs d'origine

export type PropagationScope = 'open' | 'all' | 'none';

export const DEFAULT_PROPAGATION_SCOPE: PropagationScope = 'open';

const CLOSED_STATUSES = new Set(['completed', 'cancelled', 'terminated', 'closed']);

export function isContractInScope(contract: Contract, scope: PropagationScope): boolean {
  if (scope === 'none') return false;
  if (scope === 'all') return true;
  return !CLOSED_STATUSES.has(String(contract.status));
}

const CLIENT_SNAPSHOT_KEYS: (keyof ClientSnapshot)[] = [
  'firstName',
  'lastName',
  'birthDate',
  'drivingLicense',
  'docType',
  'docNumber',
  'phone',
  'email',
  'address',
  'country',
  'cinDocUrl',
  'cinDocName',
  'cinDocVersoUrl',
  'cinDocVersoName',
  'licenseDocUrl',
  'licenseDocName',
  'licenseDocVersoUrl',
  'licenseDocVersoName',
  'documents',
];

const VEHICLE_SNAPSHOT_KEYS: (keyof VehicleSnapshot)[] = [
  'brand',
  'model',
  'plate',
  'fuelType',
  'transmission',
  'color',
  'year',
];

function pickDefined<T extends object>(source: Partial<T>, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(source, k) && source[k] !== undefined) {
      out[k] = source[k];
    }
  }
  return out;
}

export function buildClientSnapshotPatch(patch: Partial<Client>): Partial<ClientSnapshot> {
  return pickDefined<ClientSnapshot>(patch as Partial<ClientSnapshot>, CLIENT_SNAPSHOT_KEYS);
}

export function buildVehicleSnapshotPatch(patch: Partial<Vehicle>): Partial<VehicleSnapshot> {
  return pickDefined<VehicleSnapshot>(patch as Partial<VehicleSnapshot>, VEHICLE_SNAPSHOT_KEYS);
}

export function contractBelongsToClient(contract: Contract, clientId: string, docNumber?: string): boolean {
  if (contract.clientId === clientId || contract.clientSnapshot?.id === clientId) return true;
  const a = contract.clientSnapshot?.docNumber?.trim().toUpperCase();
  const b = docNumber?.trim().toUpperCase();
  return Boolean(a && b && a === b);
}

export interface ContractSnapshotChange {
  contractId: string;
  snapshotKey: 'clientSnapshot' | 'vehicleSnapshot';
  snapshot: ClientSnapshot | VehicleSnapshot;
}

function hasChanges<T extends object>(before: T | undefined, patch: Partial<T>): boolean {
  return Object.keys(patch).some((k) => JSON.stringify((before as any)?.[k]) !== JSON.stringify((patch as any)[k]));
}

/** Contrats à mettre à jour (avec le nouveau snapshot complet) après modification d'un client. */
export function planClientPropagation(
  contracts: Contract[],
  clientId: string,
  previousDocNumber: string | undefined,
  patch: Partial<Client>,
  scope: PropagationScope
): ContractSnapshotChange[] {
  const snapshotPatch = buildClientSnapshotPatch(patch);
  if (scope === 'none' || Object.keys(snapshotPatch).length === 0) return [];

  const changes: ContractSnapshotChange[] = [];
  for (const c of contracts) {
    if (!contractBelongsToClient(c, clientId, previousDocNumber)) continue;
    if (!isContractInScope(c, scope)) continue;
    if (!hasChanges(c.clientSnapshot, snapshotPatch)) continue;
    changes.push({
      contractId: c.id,
      snapshotKey: 'clientSnapshot',
      snapshot: { ...(c.clientSnapshot || ({ id: clientId } as ClientSnapshot)), ...snapshotPatch, id: clientId },
    });
  }
  return changes;
}

/** Contrats à mettre à jour après modification d'un véhicule. */
export function planVehiclePropagation(
  contracts: Contract[],
  vehicleId: string,
  patch: Partial<Vehicle>,
  scope: PropagationScope
): ContractSnapshotChange[] {
  const snapshotPatch = buildVehicleSnapshotPatch(patch);
  if (scope === 'none' || Object.keys(snapshotPatch).length === 0) return [];

  const changes: ContractSnapshotChange[] = [];
  for (const c of contracts) {
    if (c.vehicleId !== vehicleId && c.vehicleSnapshot?.id !== vehicleId) continue;
    if (!isContractInScope(c, scope)) continue;
    if (!hasChanges(c.vehicleSnapshot, snapshotPatch)) continue;
    changes.push({
      contractId: c.id,
      snapshotKey: 'vehicleSnapshot',
      snapshot: { ...(c.vehicleSnapshot || ({ id: vehicleId } as VehicleSnapshot)), ...snapshotPatch, id: vehicleId },
    });
  }
  return changes;
}

/** Champs dénormalisés d'une caution qui suivent le client. */
export function buildDepositClientPatch(patch: Partial<Client>, fallback: DepositRecord): Partial<DepositRecord> {
  const out: Partial<DepositRecord> = {};
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    const parts = (fallback.clientName || '').split(' ');
    const first = patch.firstName ?? parts[0] ?? '';
    const last = patch.lastName ?? parts.slice(1).join(' ');
    out.clientName = `${first} ${last}`.trim();
  }
  if (patch.phone !== undefined) out.clientPhone = patch.phone;
  return out;
}

/** Champs dénormalisés d'une caution qui suivent le véhicule. */
export function buildDepositVehiclePatch(
  vehicleAfter: Pick<Vehicle, 'brand' | 'model' | 'plate'>
): Partial<DepositRecord> {
  return {
    vehicleName: `${vehicleAfter.brand} ${vehicleAfter.model}`.trim(),
    vehiclePlate: vehicleAfter.plate,
  };
}
