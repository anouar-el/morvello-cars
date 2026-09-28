import { Contract } from '../types';

export type DepositCollectionStatus = 'collected' | 'not_collected' | 'none';

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
