import { Client, Contract, Vehicle, User, ContractStatus } from '../types';

export interface ClientManagerAssignment {
  managerId?: string;
  managerName?: string;
  managerAgency?: string;
  vehicleName?: string;
  vehiclePlate?: string;
  contractNumber?: string;
  contractStatus?: ContractStatus;
  isActiveRental: boolean;
}

/**
 * Règle métier : Chaque client est affecté au manager qui possède le véhicule loué par ce même client.
 * En priorité, on regarde le contrat de location actif en cours, sinon le dernier contrat en date.
 */
export function resolveClientManagerAndVehicle(
  client: Client,
  contracts: Contract[],
  vehicles: Vehicle[],
  users: User[]
): ClientManagerAssignment {
  // Recherche des contrats du client
  const clientCin = (client.docNumber || '').trim().toUpperCase();
  const matchedContracts = contracts.filter((c) => {
    if (c.clientId === client.id) return true;
    if (c.clientSnapshot?.id === client.id) return true;
    if (clientCin && c.clientSnapshot?.docNumber) {
      if (c.clientSnapshot.docNumber.trim().toUpperCase() === clientCin) return true;
    }
    return false;
  });

  if (matchedContracts.length > 0) {
    // Trier : actif en premier, puis date la plus récente
    const sorted = [...matchedContracts].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      const dateA = a.startDate || a.createdAt || '';
      const dateB = b.startDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    const targetContract = sorted[0];

    // Trouver le véhicule loué
    const matchedVehicle = vehicles.find(
      (v) =>
        v.id === targetContract.vehicleId ||
        (targetContract.vehicleSnapshot?.plate && v.plate === targetContract.vehicleSnapshot.plate)
    );

    // Le manager qui possède le véhicule loué
    let managerId = matchedVehicle?.assignedManagerId || targetContract.assignedManagerId || client.assignedManagerId;
    let managerName = matchedVehicle?.assignedManagerName || targetContract.assignedManagerName || client.assignedManagerName;
    let managerAgency: string | undefined;

    if (managerId) {
      const matchedUser = users.find((u) => u.id === managerId);
      if (matchedUser) {
        managerName = managerName || matchedUser.name;
        managerAgency = matchedUser.agency || matchedUser.assignedFleetName;
      }
    }

    const vehicleName = matchedVehicle
      ? `${matchedVehicle.brand} ${matchedVehicle.model}`
      : targetContract.vehicleSnapshot
      ? `${targetContract.vehicleSnapshot.brand} ${targetContract.vehicleSnapshot.model}`
      : client.rentedVehicleBrand && client.rentedVehicleModel
      ? `${client.rentedVehicleBrand} ${client.rentedVehicleModel}`
      : undefined;

    const vehiclePlate = matchedVehicle?.plate || targetContract.vehicleSnapshot?.plate || client.rentedVehiclePlate;

    return {
      managerId,
      managerName,
      managerAgency,
      vehicleName,
      vehiclePlate,
      contractNumber: targetContract.contractNumber,
      contractStatus: targetContract.status,
      isActiveRental: targetContract.status === 'active',
    };
  }

  // Si aucun contrat n'a encore été créé pour ce client
  let managerId = client.assignedManagerId;
  let managerName = client.assignedManagerName;

  // Si pas encore de manager direct, chercher le véhicule associé à la fiche client
  if (!managerId && (client.rentedVehiclePlate || (client.rentedVehicleBrand && client.rentedVehicleModel))) {
    const matchedVeh = vehicles.find(
      (v) =>
        (client.rentedVehiclePlate && v.plate.trim() === client.rentedVehiclePlate.trim()) ||
        (client.rentedVehicleBrand &&
          client.rentedVehicleModel &&
          v.brand.trim().toUpperCase() === client.rentedVehicleBrand.trim().toUpperCase() &&
          v.model.trim().toUpperCase().includes(client.rentedVehicleModel.trim().toUpperCase()))
    );
    if (matchedVeh?.assignedManagerId) {
      managerId = matchedVeh.assignedManagerId;
      managerName = matchedVeh.assignedManagerName;
    }
  }

  let managerAgency: string | undefined;

  if (managerId) {
    const matchedUser = users.find((u) => u.id === managerId);
    if (matchedUser) {
      managerName = managerName || matchedUser.name;
      managerAgency = matchedUser.agency || matchedUser.assignedFleetName;
    }
  }

  const vehicleName =
    client.rentedVehicleBrand && client.rentedVehicleModel
      ? `${client.rentedVehicleBrand} ${client.rentedVehicleModel}`
      : undefined;

  return {
    managerId,
    managerName,
    managerAgency,
    vehicleName,
    vehiclePlate: client.rentedVehiclePlate,
    isActiveRental: false,
  };
}
