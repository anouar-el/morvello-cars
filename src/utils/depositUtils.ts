import { Contract, DepositStatus } from '../types';

export type DepositCollectionStatus = 'collected' | 'not_collected' | 'none';

export type DbDepositStatus = 'pending' | 'collected' | 'partially_returned' | 'returned' | 'deducted';

/**
 * Mappe l'état applicatif de la caution vers les statuts stricts imposés par
 * la contrainte de vérification PostgreSQL "deposits_status_check" :
 * ('pending', 'collected', 'partially_returned', 'returned', 'deducted').
 * Évite l'erreur : new row for relation "deposits" violates check constraint "deposits_status_check".
 */
export function mapDepositStatusToDb(status?: string): DbDepositStatus {
  if (!status) return 'pending';
  switch (status) {
    case 'held':
      return 'pending';
    case 'released':
      return 'returned';
    case 'partially_deducted':
      return 'partially_returned';
    case 'fully_retained':
      return 'deducted';
    case 'pending':
    case 'collected':
    case 'partially_returned':
    case 'returned':
    case 'deducted':
      return status as DbDepositStatus;
    default:
      return 'pending';
  }
}

/**
 * Mappe le statut SQL PostgreSQL vers le type applicatif DepositStatus.
 */
export function mapDepositStatusFromDb(dbStatus?: string): DepositStatus {
  if (!dbStatus) return 'held';
  switch (dbStatus) {
    case 'pending':
    case 'collected':
      return 'held';
    case 'returned':
      return 'released';
    case 'partially_returned':
      return 'partially_deducted';
    case 'deducted':
      return 'fully_retained';
    case 'held':
    case 'released':
    case 'partially_deducted':
    case 'fully_retained':
      return dbStatus as DepositStatus;
    default:
      return 'held';
  }
}

/**
 * État de la caution à afficher : « none » quand aucune caution n'est due (montant nul, ex. Pack Confort).
 * Les contrats antérieurs à ce champ n'ont pas `depositCollected` : leur caution était enregistrée
 * comme encaissée à la création, on les considère donc « prise ».
 */
export function getDepositCollectionStatus(contract: Pick<Contract, 'depositAmount' | 'depositCollected'>): DepositCollectionStatus {
  if (!contract.depositAmount || contract.depositAmount <= 0) return 'none';
  return contract.depositCollected === false ? 'not_collected' : 'collected';
}

export function getDepositCollectionLabel(status: DepositCollectionStatus): string {
  return status === 'collected' ? 'Caution prise' : status === 'not_collected' ? 'Caution non prise' : '';
}

/** Une fiche de caution « encaissée » ne doit exister que si la caution a réellement été prise. */
export function shouldRecordDeposit(contract: Pick<Contract, 'depositAmount' | 'depositCollected'>): boolean {
  return getDepositCollectionStatus(contract) === 'collected';
}
