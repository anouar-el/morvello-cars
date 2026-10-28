import type { DepositStatus } from '../types';

/**
 * Statuts d'une caution : le vocabulaire de l'application et celui de la base ne sont pas les mêmes.
 *
 *   application            base (contrainte deposits_status_check)
 *   held                   collected   (caution prise et conservée)
 *   released               returned    (restituée)
 *   partially_deducted     partially_returned
 *   fully_retained         deducted
 *
 * L'application écrivait ses propres mots dans la colonne `status` : la base refusait toute caution
 * (« violates check constraint deposits_status_check ») et la création du contrat échouait.
 * Désormais la colonne reçoit toujours un mot que la base accepte ; l'application relit le sien.
 */

export const APP_DEPOSIT_STATUSES: readonly DepositStatus[] = ['held', 'released', 'partially_deducted', 'fully_retained'];
export const DB_DEPOSIT_STATUSES = ['pending', 'collected', 'partially_returned', 'returned', 'deducted'] as const;

const APP_TO_DB: Record<DepositStatus, (typeof DB_DEPOSIT_STATUSES)[number]> = {
  held: 'collected',
  released: 'returned',
  partially_deducted: 'partially_returned',
  fully_retained: 'deducted',
};

const DB_TO_APP: Record<(typeof DB_DEPOSIT_STATUSES)[number], DepositStatus> = {
  pending: 'held', // ancien mot écrit par la synchronisation globale pour une caution « held »
  collected: 'held',
  returned: 'released',
  partially_returned: 'partially_deducted',
  deducted: 'fully_retained',
};

export const isAppDepositStatus = (value: unknown): value is DepositStatus =>
  typeof value === 'string' && (APP_DEPOSIT_STATUSES as readonly string[]).includes(value);

const isDbDepositStatus = (value: unknown): value is (typeof DB_DEPOSIT_STATUSES)[number] =>
  typeof value === 'string' && (DB_DEPOSIT_STATUSES as readonly string[]).includes(value);

/** Mot à écrire dans la colonne `status` ; toujours accepté par la base. */
export function toDbDepositStatus(status: unknown): (typeof DB_DEPOSIT_STATUSES)[number] {
  if (isAppDepositStatus(status)) return APP_TO_DB[status];
  if (isDbDepositStatus(status)) return status;
  return 'pending';
}

/** Statut tel que l'application le comprend, d'après la ligne lue en base. */
export function resolveAppDepositStatus(columnStatus: unknown, data: Record<string, any> | null | undefined): DepositStatus {
  // `appStatus` : statut d'origine conservé quand la ligne a été créée par la fonction transactionnelle,
  // qui recopie le même mot dans la colonne et dans le JSON.
  if (isAppDepositStatus(data?.appStatus)) return data!.appStatus;
  if (isAppDepositStatus(data?.status)) return data!.status;
  if (isDbDepositStatus(columnStatus)) return DB_TO_APP[columnStatus];
  if (isDbDepositStatus(data?.status)) return DB_TO_APP[data!.status];
  return 'held';
}

/**
 * Caution envoyée à la fonction transactionnelle de création de contrat : elle recopie status dans la colonne et le JSON.
 * On y met le mot accepté par la base, et le statut d'origine dans appStatus.
 */
export function toRpcDeposit<T extends { status?: unknown } | null | undefined>(deposit: T): T {
  if (!deposit) return deposit;
  return { ...deposit, status: toDbDepositStatus(deposit.status), appStatus: isAppDepositStatus(deposit.status) ? deposit.status : undefined };
}
