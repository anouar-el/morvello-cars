import { Contract, CompanySettings, DepositRecord } from '../types';

export interface ParsedContractNumber {
  raw: string;
  prefix: string;
  year: number;
  sequence: number;
}

/**
 * Analyse et extrait le préfixe, l'année et le numéro de séquence d'un numéro de contrat.
 * Formats acceptés : MC-2026-0050, MC-2026-50, etc.
 */
export function parseContractNumber(
  contractNumber?: string,
  expectedPrefix = 'MC',
  expectedYear = 2026
): ParsedContractNumber | null {
  if (!contractNumber || typeof contractNumber !== 'string') return null;
  const trimmed = contractNumber.trim();

  // Format standard : PREFIX-YEAR-SEQUENCE (ex: MC-2026-0050)
  const standardMatch = trimmed.match(/^([A-Za-z0-9_-]+)-(\d{4})-(\d+)$/);
  if (standardMatch) {
    return {
      raw: trimmed,
      prefix: standardMatch[1].toUpperCase(),
      year: parseInt(standardMatch[2], 10),
      sequence: parseInt(standardMatch[3], 10),
    };
  }

  // Format avec suffixe numérique : ...-SEQUENCE
  const suffixMatch = trimmed.match(/-(\d+)$/);
  if (suffixMatch) {
    return {
      raw: trimmed,
      prefix: expectedPrefix.toUpperCase(),
      year: expectedYear,
      sequence: parseInt(suffixMatch[1], 10),
    };
  }

  return null;
}

/**
 * Calcule le prochain numéro de contrat disponible et garanti sans doublon.
 * Scanne l'ensemble des contrats existants pour trouver le numéro le plus élevé
 * et effectue une vérification d'unicité absolue pour éviter toute collision.
 */
export function getNextAvailableContractNumber(
  contracts: Contract[],
  companySettings?: Partial<CompanySettings>
): {
  nextSequence: number;
  formattedContractNumber: string;
  prefix: string;
  year: number;
} {
  const prefix = (companySettings?.contractPrefix || 'MC').trim().toUpperCase();
  const year = Number(companySettings?.contractYear) || new Date().getFullYear();
  const configuredNext = Number(companySettings?.nextContractNumber) || 1;

  // Ensemble normalisé de tous les numéros de contrats actuellement existants (accès O(1))
  const usedNumbersUpper = new Set<string>();
  const sequencesInCurrentYear: number[] = [];

  for (const c of contracts) {
    if (!c || !c.contractNumber) continue;
    const norm = c.contractNumber.trim().toUpperCase();
    usedNumbersUpper.add(norm);

    const parsed = parseContractNumber(c.contractNumber, prefix, year);
    if (parsed && parsed.year === year) {
      sequencesInCurrentYear.push(parsed.sequence);
    }
  }

  const maxExistingSequence =
    sequencesInCurrentYear.length > 0 ? Math.max(...sequencesInCurrentYear) : 0;

  // Le prochain numéro doit être supérieur ou égal au compteur configuré
  // ET strictement supérieur à tous les contrats existants pour cette année
  let candidateSeq = Math.max(configuredNext, maxExistingSequence + 1);

  // Garantie absolue contre tout doublon
  let formatted = `${prefix}-${year}-${String(candidateSeq).padStart(4, '0')}`;
  while (usedNumbersUpper.has(formatted.toUpperCase())) {
    candidateSeq++;
    formatted = `${prefix}-${year}-${String(candidateSeq).padStart(4, '0')}`;
  }

  return {
    nextSequence: candidateSeq,
    formattedContractNumber: formatted,
    prefix,
    year,
  };
}

/**
 * Empêche le compteur nextContractNumber de régresser en dessous du contrat existant le plus élevé.
 */
export function reconcileCompanySettingsWithContracts(
  settings: CompanySettings,
  contracts: Contract[]
): CompanySettings {
  const { nextSequence } = getNextAvailableContractNumber(contracts, settings);
  if (settings.nextContractNumber < nextSequence) {
    return {
      ...settings,
      nextContractNumber: nextSequence,
    };
  }
  return settings;
}

export interface DuplicateContractReport {
  contractNumber: string;
  contracts: Contract[];
}

/**
 * Détecte les doublons de numéros de contrat existants dans la base de données.
 */
export function findDuplicateContractNumbers(contracts: Contract[]): DuplicateContractReport[] {
  const map = new Map<string, Contract[]>();
  for (const c of contracts) {
    if (!c || !c.contractNumber) continue;
    const key = c.contractNumber.trim().toUpperCase();
    const list = map.get(key) || [];
    list.push(c);
    map.set(key, list);
  }

  const duplicates: DuplicateContractReport[] = [];
  for (const [contractNumber, list] of map.entries()) {
    if (list.length > 1) {
      duplicates.push({ contractNumber, contracts: list });
    }
  }

  return duplicates;
}

/**
 * Répare et dédoublonne les contrats existants en conservant le numéro sur le contrat
 * le plus ancien et en réattribuant des numéros uniques consécutifs aux doublons récents.
 * Met également à jour les cautions liées pour préserver l'intégrité financière.
 */
export function repairAndDeduplicateContracts(
  contracts: Contract[],
  deposits: DepositRecord[] = [],
  companySettings: CompanySettings
): {
  repairedContracts: Contract[];
  repairedDeposits: DepositRecord[];
  updatedCompanySettings: CompanySettings;
  renumberedCount: number;
} {
  const duplicates = findDuplicateContractNumbers(contracts);
  if (duplicates.length === 0) {
    return {
      repairedContracts: contracts,
      repairedDeposits: deposits,
      updatedCompanySettings: reconcileCompanySettingsWithContracts(companySettings, contracts),
      renumberedCount: 0,
    };
  }

  let currentContracts = [...contracts];
  let currentDeposits = [...deposits];
  let renumberedCount = 0;

  for (const group of duplicates) {
    const sorted = [...group.contracts].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    // Le premier contrat (le plus ancien) conserve son numéro d'origine
    // Tous les contrats suivants reçoivent un numéro libre unique
    for (let i = 1; i < sorted.length; i++) {
      const duplicateContract = sorted[i];
      const { formattedContractNumber } = getNextAvailableContractNumber(
        currentContracts,
        companySettings
      );

      const oldNumber = duplicateContract.contractNumber;
      const newNumber = formattedContractNumber;

      currentContracts = currentContracts.map((c) =>
        c.id === duplicateContract.id ? { ...c, contractNumber: newNumber } : c
      );

      currentDeposits = currentDeposits.map((dep) => {
        if (dep.contractId === duplicateContract.id || dep.contractNumber === oldNumber) {
          return {
            ...dep,
            contractNumber: newNumber,
            notes: dep.notes?.includes(oldNumber)
              ? dep.notes.replace(oldNumber, newNumber)
              : dep.notes,
          };
        }
        return dep;
      });

      renumberedCount++;
    }
  }

  const updatedSettings = reconcileCompanySettingsWithContracts(companySettings, currentContracts);

  return {
    repairedContracts: currentContracts,
    repairedDeposits: currentDeposits,
    updatedCompanySettings: updatedSettings,
    renumberedCount,
  };
}
