import { Client, Contract, Vehicle, User } from '../types';
import { generateStableId } from './idUtils';

/**
 * Réconcilie automatiquement la liste des clients avec l'ensemble des contrats enregistrés.
 * Si un client figure dans un contrat (via clientSnapshot ou clientId) mais est absent
 * du répertoire des clients, il est automatiquement restauré avec l'ensemble de ses
 * informations d'identité, documents et rattachement d'agence.
 */
export function reconcileClientsWithContracts(
  clients: Client[],
  contracts: Contract[],
  vehicles: Vehicle[] = [],
  users: User[] = []
): Client[] {
  const result: Client[] = [...clients];

  // Helper pour trouver un client dans la liste
  const findClientIndex = (clientId?: string, docNumber?: string) => {
    return result.findIndex((c) => {
      if (clientId && c.id === clientId) return true;
      if (
        docNumber &&
        c.docNumber &&
        c.docNumber.trim().toUpperCase() === docNumber.trim().toUpperCase()
      ) {
        return true;
      }
      return false;
    });
  };

  for (const contract of contracts) {
    const snap = contract.clientSnapshot;
    const clientId = contract.clientId || snap?.id;
    const docNumber = snap?.docNumber;

    if (!snap && !clientId) continue;

    const existingIdx = findClientIndex(clientId, docNumber);

    if (existingIdx === -1 && snap) {
      // Reconstitue le client manquant à partir du snapshot du contrat
      const newClient: Client = {
        id: clientId || generateStableId('cli'),
        firstName: snap.firstName || '',
        lastName: snap.lastName || '',
        birthDate: snap.birthDate || '',
        drivingLicense: snap.drivingLicense || '',
        docType: snap.docType || 'CIN',
        docNumber: snap.docNumber || '',
        phone: snap.phone || '',
        email: snap.email || '',
        country: snap.country || '',
        address: snap.address || '',
        cinDocUrl: snap.cinDocUrl,
        cinDocName: snap.cinDocName,
        cinDocVersoUrl: snap.cinDocVersoUrl,
        cinDocVersoName: snap.cinDocVersoName,
        licenseDocUrl: snap.licenseDocUrl,
        licenseDocName: snap.licenseDocName,
        licenseDocVersoUrl: snap.licenseDocVersoUrl,
        licenseDocVersoName: snap.licenseDocVersoName,
        documents: snap.documents || [],
        notes: `Titulaire du contrat ${contract.contractNumber}`,
        createdAt: contract.createdAt || new Date().toISOString(),
        contractCount: 1,
        lastContractDate: contract.startDate,
        lastContractNumber: contract.contractNumber,
        assignedManagerId: contract.assignedManagerId,
        rentedVehicleBrand: contract.vehicleSnapshot?.brand,
        rentedVehicleModel: contract.vehicleSnapshot?.model,
        rentedVehiclePlate: contract.vehicleSnapshot?.plate,
        createdBy: contract.createdBy,
      };

      // Résolution du nom du responsable si présent
      if (contract.assignedManagerId) {
        const mgr = users.find((u) => u.id === contract.assignedManagerId);
        if (mgr) {
          newClient.assignedManagerName = mgr.name;
        }
      }

      result.push(newClient);
    } else if (existingIdx !== -1) {
      // Enrichit les documents et informations manquantes sur le client existant
      const existing = result[existingIdx];
      const updated: Client = { ...existing };

      if (!updated.cinDocUrl && snap?.cinDocUrl) {
        updated.cinDocUrl = snap.cinDocUrl;
        updated.cinDocName = snap.cinDocName;
      }
      if (!updated.cinDocVersoUrl && snap?.cinDocVersoUrl) {
        updated.cinDocVersoUrl = snap.cinDocVersoUrl;
        updated.cinDocVersoName = snap.cinDocVersoName;
      }
      if (!updated.licenseDocUrl && snap?.licenseDocUrl) {
        updated.licenseDocUrl = snap.licenseDocUrl;
        updated.licenseDocName = snap.licenseDocName;
      }
      if (!updated.licenseDocVersoUrl && snap?.licenseDocVersoUrl) {
        updated.licenseDocVersoName = snap.licenseDocVersoName;
        updated.licenseDocVersoUrl = snap.licenseDocVersoUrl;
      }

      // Mise à jour du véhicule loué si le contrat est actif
      if (contract.status === 'active') {
        updated.rentedVehicleBrand = contract.vehicleSnapshot?.brand || updated.rentedVehicleBrand;
        updated.rentedVehicleModel = contract.vehicleSnapshot?.model || updated.rentedVehicleModel;
        updated.rentedVehiclePlate = contract.vehicleSnapshot?.plate || updated.rentedVehiclePlate;
        if (contract.assignedManagerId) {
          updated.assignedManagerId = contract.assignedManagerId;
          const mgr = users.find((u) => u.id === contract.assignedManagerId);
          if (mgr) {
            updated.assignedManagerName = mgr.name;
          }
        }
      }

      result[existingIdx] = updated;
    }
  }

  // Recalcule le nombre de contrats et la date du dernier contrat pour chaque client
  for (let i = 0; i < result.length; i++) {
    const cli = result[i];
    const clientContracts = contracts.filter(
      (c) =>
        c.clientId === cli.id ||
        (c.clientSnapshot?.docNumber &&
          cli.docNumber &&
          c.clientSnapshot.docNumber.trim().toUpperCase() === cli.docNumber.trim().toUpperCase())
    );

    if (clientContracts.length > 0) {
      const sorted = [...clientContracts].sort(
        (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      const latest = sorted[0];
      const activeContract = sorted.find((c) => c.status === 'active');

      result[i] = {
        ...cli,
        contractCount: clientContracts.length,
        lastContractDate: latest.startDate,
        lastContractNumber: latest.contractNumber,
        rentedVehicleBrand: activeContract
          ? activeContract.vehicleSnapshot?.brand
          : cli.rentedVehicleBrand,
        rentedVehicleModel: activeContract
          ? activeContract.vehicleSnapshot?.model
          : cli.rentedVehicleModel,
        rentedVehiclePlate: activeContract
          ? activeContract.vehicleSnapshot?.plate
          : cli.rentedVehiclePlate,
      };
    }
  }

  return result;
}
