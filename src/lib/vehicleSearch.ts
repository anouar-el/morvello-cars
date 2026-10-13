import type { Vehicle } from '../types';

/*
 * Recherche rapide d'un véhicule : insensible à la casse et aux accents, la plaque est comparée sans
 * espaces ni séparateurs (« 52596 A 73 », « 52596-A-73 » et « 52596|A|73 » se valent). Plusieurs mots :
 * tous doivent être trouvés (marque + modèle, modèle + responsable…).
 */

export type VehicleStatusFilter = 'all' | 'available' | 'unavailable';

const strip = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const compact = (value: unknown): string => strip(value).replace(/[^a-z0-9]/g, '');

function haystack(v: Partial<Vehicle>): { text: string; plate: string } {
  const text = strip(
    [v.brand, v.model, v.fuelType, v.color, v.year, v.assignedManagerName, v.insuranceCompany].filter(Boolean).join(' ')
  );
  return { text, plate: compact(v.plate) };
}

export function matchesVehicleQuery(v: Partial<Vehicle>, query: string): boolean {
  const tokens = strip(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const { text, plate } = haystack(v);
  const fullText = `${text} ${plate}`;
  const queryCompact = compact(query);

  // Plaque saisie en un seul bloc (« 52596 A 73 ») : comparaison sur la plaque compactée.
  if (queryCompact.length >= 3 && plate.includes(queryCompact)) return true;

  return tokens.every((t) => fullText.includes(t) || (compact(t).length > 0 && plate.includes(compact(t))));
}

export interface VehicleSearchOptions {
  query: string;
  status: VehicleStatusFilter;
  /** Véhicule du contrat en cours d'édition : toujours considéré comme disponible. */
  currentVehicleId?: string;
}

const isFree = (v: Vehicle, currentVehicleId?: string) => v.status === 'available' || v.id === currentVehicleId;

export function searchVehicles(vehicles: Vehicle[], opts: VehicleSearchOptions): Vehicle[] {
  const result = vehicles.filter((v) => {
    if (opts.status === 'available' && !isFree(v, opts.currentVehicleId)) return false;
    if (opts.status === 'unavailable' && isFree(v, opts.currentVehicleId)) return false;
    return matchesVehicleQuery(v, opts.query);
  });

  // Les véhicules disponibles d'abord, sans bouleverser l'ordre d'origine à l'intérieur de chaque groupe.
  return result
    .map((v, i) => ({ v, i }))
    .sort((a, b) => Number(isFree(b.v, opts.currentVehicleId)) - Number(isFree(a.v, opts.currentVehicleId)) || a.i - b.i)
    .map(({ v }) => v);
}

export function countByStatus(vehicles: Vehicle[], currentVehicleId?: string): { all: number; available: number; unavailable: number } {
  const available = vehicles.filter((v) => isFree(v, currentVehicleId)).length;
  return { all: vehicles.length, available, unavailable: vehicles.length - available };
}
