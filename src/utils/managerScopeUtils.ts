import { Vehicle, Contract, DepositRecord, Client, User } from '../types';
import { resolveClientManagerAndVehicle } from './clientManagerUtils';

/**
 * Vérifie si un véhicule est affecté à un responsable spécifique.
 */
export function isVehicleOwnedByManager(
  vehicle: Vehicle,
  managerId: string,
  managerName?: string,
  managerUid?: string
): boolean {
  if (!vehicle || !managerId) return false;
  if (vehicle.assignedManagerId === managerId) return true;
  if (managerUid && vehicle.assignedManagerId === managerUid) return true;

  // Rapprochement Ouahib (usr-3)
  if (
    (managerId === 'usr-3' || (managerName && managerName.toLowerCase().includes('ouahib'))) &&
    (vehicle.assignedManagerId === 'usr-3' ||
      (vehicle.assignedManagerName && vehicle.assignedManagerName.toLowerCase().includes('ouahib')))
  ) {
    return true;
  }

  if (
    vehicle.proposedBy &&
    managerName &&
    vehicle.proposedBy.trim().toLowerCase() === managerName.trim().toLowerCase()
  ) {
    return true;
  }
  if (
    vehicle.assignedManagerName &&
    managerName &&
    vehicle.assignedManagerName.trim().toLowerCase() === managerName.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Vérifie si un contrat est sous la responsabilité d'un responsable spécifique :
 * - Soit le contrat est directement affecté au responsable (assignedManagerId === managerId ou managerUid)
 * - Soit le véhicule associé au contrat appartient au responsable
 * - Soit le contrat a été créé par le responsable (createdBy === managerName)
 */
export function isContractOwnedByManager(
  contract: Contract,
  managerId: string,
  vehicles: Vehicle[],
  managerName?: string,
  managerUid?: string
): boolean {
  if (!contract || !managerId) return false;

  // 1. Affectation directe sur le contrat
  if (contract.assignedManagerId === managerId) return true;
  if (managerUid && contract.assignedManagerId === managerUid) return true;

  // Rapprochement Ouahib (usr-3)
  if (
    (managerId === 'usr-3' || (managerName && managerName.toLowerCase().includes('ouahib'))) &&
    (contract.assignedManagerId === 'usr-3' ||
      (contract.assignedManagerName && contract.assignedManagerName.toLowerCase().includes('ouahib')))
  ) {
    return true;
  }

  // 2. Recherche du véhicule loué dans le parc
  const matchedVeh = vehicles.find(
    (v) =>
      (contract.vehicleId && v.id === contract.vehicleId) ||
      (contract.vehicleSnapshot?.plate && v.plate && v.plate.trim() === contract.vehicleSnapshot.plate.trim())
  );
  if (matchedVeh && isVehicleOwnedByManager(matchedVeh, managerId, managerName, managerUid)) {
    return true;
  }

  // 3. Auteur de la création du contrat
  if (
    managerName &&
    contract.createdBy &&
    contract.createdBy.trim().toLowerCase() === managerName.trim().toLowerCase()
  ) {
    return true;
  }

  // 4. Nom du responsable spécifié sur le contrat
  if (
    managerName &&
    contract.assignedManagerName &&
    contract.assignedManagerName.trim().toLowerCase() === managerName.trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}

/**
 * Vérifie si un dépôt de garantie (caution) appartient au périmètre d'un responsable :
 * - Soit lié à un contrat appartenant au responsable
 * - Soit lié à un véhicule appartenant au responsable
 * - Soit reçu par le responsable (receivedBy === managerName)
 */
export function isDepositOwnedByManager(
  deposit: DepositRecord,
  managerId: string,
  contracts: Contract[],
  vehicles: Vehicle[],
  managerName?: string,
  managerUid?: string
): boolean {
  if (!deposit || !managerId) return false;

  // Affectation directe ou par UID
  if (deposit.assignedManagerId === managerId) return true;
  if (managerUid && deposit.assignedManagerId === managerUid) return true;

  // Rapprochement Ouahib (usr-3)
  if (
    (managerId === 'usr-3' || (managerName && managerName.toLowerCase().includes('ouahib'))) &&
    (deposit.assignedManagerId === 'usr-3' ||
      (deposit.assignedManagerName && deposit.assignedManagerName.toLowerCase().includes('ouahib')))
  ) {
    return true;
  }

  // 1. Contrat correspondant
  const matchedContract = contracts.find(
    (c) =>
      (deposit.contractId && c.id === deposit.contractId) ||
      (deposit.contractNumber &&
        c.contractNumber &&
        deposit.contractNumber.trim() === c.contractNumber.trim())
  );
  if (matchedContract) {
    return isContractOwnedByManager(matchedContract, managerId, vehicles, managerName, managerUid);
  }

  // 2. Véhicule correspondant par plaque
  if (deposit.vehiclePlate) {
    const matchedVeh = vehicles.find(
      (v) => v.plate && v.plate.trim() === deposit.vehiclePlate!.trim()
    );
    if (matchedVeh && isVehicleOwnedByManager(matchedVeh, managerId, managerName, managerUid)) {
      return true;
    }
  }

  // 3. Reçu par ce responsable
  if (
    managerName &&
    deposit.receivedBy &&
    deposit.receivedBy.trim().toLowerCase() === managerName.trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}

/**
 * Vérifie si un client appartient au périmètre d'un responsable :
 * - N'appartient pas à un autre responsable
 */
export function isClientOwnedByManager(
  client: Client,
  managerId: string,
  contracts: Contract[],
  vehicles: Vehicle[],
  users: User[] = []
): boolean {
  if (!client || !managerId) return false;
  const mgrInfo = resolveClientManagerAndVehicle(client, contracts, vehicles, users);
  if (mgrInfo.managerId && mgrInfo.managerId !== managerId) {
    return false;
  }
  return true;
}

/**
 * Retourne les données filtrées selon le rôle de l'utilisateur connecté :
 * - Si Admin : voit l'ensemble de la flotte, tous les contrats, toutes les cautions et tous les clients.
 * - Si Responsable (Manager) : cloisonnement strict à ses véhicules, ses contrats, ses cautions et ses clients.
 */
export function getScopedDataForUser(
  currentUser: User | null,
  allVehicles: Vehicle[],
  allContracts: Contract[],
  allDeposits: DepositRecord[],
  allClients: Client[],
  allUsers: User[] = []
) {
  if (!currentUser || currentUser.role === 'admin') {
    return {
      scopedVehicles: allVehicles,
      scopedContracts: allContracts,
      scopedDeposits: allDeposits,
      scopedClients: allClients,
      isRestricted: false,
    };
  }

  const managerId = currentUser.id;
  const managerName = currentUser.name;
  const managerUid = currentUser.firebaseUid;

  const scopedVehicles = allVehicles.filter((v) =>
    isVehicleOwnedByManager(v, managerId, managerName, managerUid)
  );

  const scopedContracts = allContracts.filter((c) =>
    isContractOwnedByManager(c, managerId, allVehicles, managerName, managerUid)
  );

  const scopedDeposits = allDeposits.filter((d) =>
    isDepositOwnedByManager(d, managerId, allContracts, allVehicles, managerName, managerUid)
  );

  const scopedClients = allClients.filter((cli) => {
    const mgrInfo = resolveClientManagerAndVehicle(cli, allContracts, allVehicles, allUsers);
    // Si le client est lié à une location active ou passée avec un autre manager, strict masquage
    if (mgrInfo.managerId && mgrInfo.managerId !== managerId) {
      return false;
    }
    return true;
  });

  return {
    scopedVehicles,
    scopedContracts,
    scopedDeposits,
    scopedClients,
    isRestricted: true,
  };
}
