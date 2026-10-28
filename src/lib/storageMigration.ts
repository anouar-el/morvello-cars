import type { Client, Contract, Vehicle } from '../types';
import { measureEmbedded, type MigrationOutcome } from './storageFiles';

/**
 * Déplace vers Supabase Storage les photos, scans et signatures déjà intégrés (base64) dans les fiches existantes.
 * Orchestration pure : lecture, envoi et écriture sont injectés, donc testable sans réseau.
 * Relançable à volonté : une fiche déjà traitée n'a plus rien à déplacer.
 */

export interface MigrationDeps {
  clients: Client[];
  vehicles: Vehicle[];
  contracts: Contract[];
  /** Remplace chaque fichier intégré d'une fiche par sa référence Storage. */
  migrate<T>(record: T): Promise<MigrationOutcome<T>>;
  /** Écrit les seuls champs modifiés sur le serveur ; true si l'écriture a abouti. */
  patchClient(id: string, patch: Partial<Client>): Promise<boolean>;
  patchVehicle(id: string, patch: Partial<Vehicle>): Promise<boolean>;
  patchContract(id: string, patch: Partial<Contract>): Promise<boolean>;
  onProgress?(progress: { done: number; total: number; label: string }): void;
  isCancelled?(): boolean;
}

export interface MigrationReport {
  /** Fiches contenant des fichiers intégrés au départ. */
  candidates: number;
  recordsUpdated: number;
  filesMoved: number;
  /** Fichiers ou écritures qui n'ont pas abouti (la fiche garde alors son image, on peut relancer). */
  failures: number;
  /** Caractères retirés des fiches. */
  reclaimedChars: number;
  abortedReason?: 'storage-unavailable' | 'cancelled';
}

/** Après ce nombre de fiches de suite où rien n'a pu être envoyé, on conclut que Storage n'est pas prêt. */
const MAX_EMPTY_RUNS = 2;

/** Champs de premier niveau dont la valeur a changé. */
export function changedTopLevelKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

export async function runStorageMigration(deps: MigrationDeps): Promise<MigrationReport> {
  type Item = { label: string; record: any; patch: (id: string, p: any) => Promise<boolean> };
  const items: Item[] = [
    ...deps.clients.map((record) => ({ label: 'clients', record, patch: deps.patchClient as Item['patch'] })),
    ...deps.vehicles.map((record) => ({ label: 'véhicules', record, patch: deps.patchVehicle as Item['patch'] })),
    ...deps.contracts.map((record) => ({ label: 'contrats', record, patch: deps.patchContract as Item['patch'] })),
  ].filter((item) => measureEmbedded(item.record).count > 0);

  const report: MigrationReport = { candidates: items.length, recordsUpdated: 0, filesMoved: 0, failures: 0, reclaimedChars: 0 };
  let emptyRuns = 0;

  for (let i = 0; i < items.length; i++) {
    if (deps.isCancelled?.()) {
      report.abortedReason = 'cancelled';
      break;
    }
    const { label, record, patch } = items[i];
    deps.onProgress?.({ done: i, total: items.length, label });

    const before = measureEmbedded(record).bytes;
    const out = await deps.migrate(record);
    report.failures += out.failed;

    if (out.moved === 0) {
      emptyRuns += out.failed > 0 ? 1 : 0;
      if (emptyRuns >= MAX_EMPTY_RUNS) {
        report.abortedReason = 'storage-unavailable';
        break;
      }
      continue;
    }
    emptyRuns = 0;

    const keys = changedTopLevelKeys(record, out.value as Record<string, unknown>);
    const fields: Record<string, unknown> = {};
    for (const k of keys) fields[k] = (out.value as Record<string, unknown>)[k];

    const ok = await patch(record.id, fields);
    if (!ok) {
      report.failures += 1;
      continue;
    }
    report.recordsUpdated += 1;
    report.filesMoved += out.moved;
    report.reclaimedChars += Math.max(0, before - measureEmbedded(out.value).bytes);
  }

  deps.onProgress?.({ done: items.length, total: items.length, label: 'terminé' });
  return report;
}

/** Poids total des fichiers intégrés dans les fiches, par famille (affichage avant migration). */
export function summarizeEmbedded(data: { clients: Client[]; vehicles: Vehicle[]; contracts: Contract[] }) {
  const sum = (records: unknown[]) =>
    records.reduce<{ count: number; bytes: number }>(
      (acc, r) => {
        const m = measureEmbedded(r);
        return { count: acc.count + m.count, bytes: acc.bytes + m.bytes };
      },
      { count: 0, bytes: 0 }
    );
  const clients = sum(data.clients);
  const vehicles = sum(data.vehicles);
  const contracts = sum(data.contracts);
  return {
    clients,
    vehicles,
    contracts,
    total: { count: clients.count + vehicles.count + contracts.count, bytes: clients.bytes + vehicles.bytes + contracts.bytes },
  };
}
