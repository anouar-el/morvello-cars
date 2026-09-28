import { Contract, ContractInsurance, InsurancePackId, Vehicle, VehicleCategory } from '../types';

/**
 * Packs d'assurance Morvello Cars, alignés sur la grille publiée sur morvellocars.com.
 * Chaque pack conserve une franchise : seul le dépôt de garantie baisse (jusqu'à 0 pour le Pack Confort).
 * Le site affiche les montants en EUR ; l'agence les convertit au taux fixe 1 EUR = 10 MAD.
 */
export const EUR_TO_MAD = 10;

/** Franchise appliquée : ce pourcentage du montant des dégâts, avec pour minimum le montant de la grille. */
export const FRANCHISE_DAMAGE_RATE_PERCENT = 5;

export const VEHICLE_CATEGORIES: { id: VehicleCategory; label: string; examples: string }[] = [
  { id: 'citadine', label: 'Citadine & Berline', examples: 'i10, Picanto, C3, 208, Clio, Logan, Sandero, Accent, Jogger' },
  { id: 'suv', label: 'SUV', examples: 'Duster, Arkana, T-Roc, Tucson, Sportage, Formentor' },
  { id: 'premium', label: 'Premium & Luxe', examples: 'Golf 8 Sport, Touareg, Range Rover, Evoque, Velar' },
];

export const INSURANCE_PACKS: { id: InsurancePackId; label: string; coverage: string }[] = [
  {
    id: 'base',
    label: 'Pack de Base',
    coverage: 'RC, protection juridique, assurance conducteur & passagers, assistance de base',
  },
  {
    id: 'ameliore',
    label: 'Pack Amélioré',
    coverage: 'Pack de Base + vol, incendie, bris de glace, CDW, assistance étendue (RSN)',
  },
  {
    id: 'confort',
    label: 'Pack Confort',
    coverage: 'Pack Amélioré + pneus & jantes, véhicule de remplacement, assistance RSN complète',
  },
];

/** Grille en EUR par gamme : supplément journalier, franchise, dépôt de garantie. */
const PACK_GRID_EUR: Record<VehicleCategory, Record<InsurancePackId, { dailyEur: number; franchiseEur: number; depositEur: number }>> = {
  citadine: {
    base: { dailyEur: 0, franchiseEur: 800, depositEur: 800 },
    ameliore: { dailyEur: 13, franchiseEur: 400, depositEur: 400 },
    confort: { dailyEur: 25, franchiseEur: 200, depositEur: 0 },
  },
  suv: {
    base: { dailyEur: 0, franchiseEur: 1000, depositEur: 1000 },
    ameliore: { dailyEur: 18, franchiseEur: 500, depositEur: 500 },
    confort: { dailyEur: 35, franchiseEur: 300, depositEur: 0 },
  },
  premium: {
    base: { dailyEur: 0, franchiseEur: 1200, depositEur: 1200 },
    ameliore: { dailyEur: 35, franchiseEur: 600, depositEur: 600 },
    confort: { dailyEur: 60, franchiseEur: 400, depositEur: 0 },
  },
};

export function getPackTerms(category: VehicleCategory, packId: InsurancePackId) {
  const row = PACK_GRID_EUR[category][packId];
  return {
    dailySupplementMad: row.dailyEur * EUR_TO_MAD,
    franchiseMad: row.franchiseEur * EUR_TO_MAD,
    depositMad: row.depositEur * EUR_TO_MAD,
  };
}

const PREMIUM_PATTERNS = [/range\s*rover/, /land\s*rover/, /evoque/, /velar/, /touareg/, /golf\s*8\s*sport/, /golf.*\bgti\b/, /porsche/, /\bamg\b/, /mercedes/, /\bbmw\b/, /audi/];
const SUV_PATTERNS = [/duster/, /arkana/, /t-?roc/, /tucson/, /sportage/, /formentor/, /kardian/, /captur/, /kadjar/, /qashqai/, /3008/, /2008/, /tiguan/, /c5\s*aircross/, /bigster/];

/** Gamme déduite de la marque/modèle quand elle n'a pas été renseignée sur la fiche véhicule. */
export function inferVehicleCategory(brand?: string, model?: string): VehicleCategory {
  const name = `${brand || ''} ${model || ''}`.toLowerCase();
  if (PREMIUM_PATTERNS.some((re) => re.test(name))) return 'premium';
  if (SUV_PATTERNS.some((re) => re.test(name))) return 'suv';
  return 'citadine';
}

export function getVehicleCategory(vehicle?: Pick<Vehicle, 'brand' | 'model' | 'insuranceCategory'> | null): VehicleCategory {
  if (vehicle?.insuranceCategory) return vehicle.insuranceCategory;
  return inferVehicleCategory(vehicle?.brand, vehicle?.model);
}

export function getCategoryLabel(category: VehicleCategory): string {
  return VEHICLE_CATEGORIES.find((c) => c.id === category)?.label || category;
}

/** Instantané figé sur le contrat au moment de sa création (les grilles futures ne le modifient pas). */
export function buildContractInsurance(category: VehicleCategory, packId: InsurancePackId): ContractInsurance {
  const pack = INSURANCE_PACKS.find((p) => p.id === packId) || INSURANCE_PACKS[0];
  const terms = getPackTerms(category, pack.id);
  return {
    packId: pack.id,
    packLabel: pack.label,
    coverage: pack.coverage,
    category,
    categoryLabel: getCategoryLabel(category),
    franchiseMad: terms.franchiseMad,
    franchiseRatePercent: FRANCHISE_DAMAGE_RATE_PERCENT,
    depositMad: terms.depositMad,
    dailySupplementMad: terms.dailySupplementMad,
  };
}

/** Franchise due pour un sinistre donné : le pourcentage des dégâts, jamais en dessous du minimum du pack. */
export function computeFranchise(insurance: Pick<ContractInsurance, 'franchiseMad' | 'franchiseRatePercent'>, damageMad: number): number {
  const rate = insurance.franchiseRatePercent ?? FRANCHISE_DAMAGE_RATE_PERCENT;
  return Math.max(insurance.franchiseMad, Math.round((Math.max(0, damageMad) * rate) / 100));
}

/** Libellé imprimé : « 5 % des dégâts, min. 8 000 MAD ». */
export function formatFranchise(insurance: Pick<ContractInsurance, 'franchiseMad' | 'franchiseRatePercent'>): string {
  const rate = insurance.franchiseRatePercent ?? FRANCHISE_DAMAGE_RATE_PERCENT;
  return `${rate} % des dégâts, min. ${insurance.franchiseMad.toLocaleString('fr-FR')} MAD`;
}

/**
 * Couverture à imprimer sur un contrat. Les contrats antérieurs aux packs n'ont pas d'instantané :
 * on affiche alors le Pack de Base (inclus dans toute location) de la gamme du véhicule.
 */
export function resolveContractInsurance(contract: Pick<Contract, 'insurance' | 'vehicleSnapshot'>): ContractInsurance {
  if (contract.insurance) return contract.insurance;
  return buildContractInsurance(inferVehicleCategory(contract.vehicleSnapshot?.brand, contract.vehicleSnapshot?.model), 'base');
}
