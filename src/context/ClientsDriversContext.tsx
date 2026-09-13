import React, { createContext, useContext, useState, useEffect } from 'react';
import { Client, Driver, User, Contract, Vehicle } from '../types';
import { initialClients, initialDrivers } from '../data/mockData';
import { saveRemoteAgencyData } from '../lib/firestoreSync';
import { resolveClientManagerAndVehicle, ClientManagerAssignment } from '../utils/clientManagerUtils';

export interface ClientsDriversContextType {
  clients: Client[];
  drivers: Driver[];
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  addClient: (clientData: Omit<Client, 'id' | 'createdAt' | 'contractCount'>) => Client;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (
    id: string,
    currentUser?: User | null,
    activeContractCheck?: (clientId: string, docNumber?: string) => { isBlocked: boolean; contractNumber?: string }
  ) => { success: boolean; error?: string };
  addDriver: (driverData: Omit<Driver, 'id' | 'createdAt'>) => Driver;
  getClientAssignedManager: (
    client: Client,
    contracts: Contract[],
    vehicles: Vehicle[],
    users: User[]
  ) => ClientManagerAssignment;
  setClientsList: (clients: Client[]) => void;
  setClientsListByUpdater: (updater: (prev: Client[]) => Client[]) => void;
  setDriversList: (drivers: Driver[]) => void;
}

const STORAGE_KEYS = {
  CLIENTS: 'morvello_clients_v1',
  DRIVERS: 'morvello_drivers_v1',
};

const ClientsDriversContext = createContext<ClientsDriversContextType | undefined>(undefined);

export const ClientsDriversProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return saved ? JSON.parse(saved) : initialClients;
  });

  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRIVERS);
    return saved ? JSON.parse(saved) : initialDrivers;
  });

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
  }, [drivers]);

  const logAction = (action: string, targetType: any, targetId: string, details: string) => {
    if (onAuditLog) {
      onAuditLog(action, targetType, targetId, details);
    }
  };

  const addClient = (clientData: Omit<Client, 'id' | 'createdAt' | 'contractCount'>): Client => {
    const newClient: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      createdAt: new Date().toISOString(),
      contractCount: 0,
    };
    const updatedClients = [newClient, ...clients];
    setClients(updatedClients);
    saveRemoteAgencyData({ clients: updatedClients }).catch((err) =>
      console.warn('Auto-save addClient to Firestore note:', err)
    );
    logAction('Création client', 'client', newClient.id, `Nouveau client : ${newClient.firstName} ${newClient.lastName}`);
    return newClient;
  };

  const updateClient = (id: string, data: Partial<Client>) => {
    const updated = clients.map((c) => (c.id === id ? { ...c, ...data } : c));
    setClients(updated);
    saveRemoteAgencyData({ clients: updated }).catch((err) =>
      console.warn('Auto-save updateClient to Firestore note:', err)
    );
    logAction('Mise à jour client', 'client', id, `Modification fiche client #${id}`);
  };

  const deleteClient = (
    id: string,
    currentUser?: User | null,
    activeContractCheck?: (clientId: string, docNumber?: string) => { isBlocked: boolean; contractNumber?: string }
  ): { success: boolean; error?: string } => {
    const client = clients.find((c) => c.id === id);
    if (!client) {
      return { success: false, error: 'Client introuvable.' };
    }

    const isGerant = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    if (!isGerant && !isManager) {
      return {
        success: false,
        error: 'Permission refusée : vous ne disposez pas des droits pour supprimer ce client.',
      };
    }

    if (activeContractCheck) {
      const check = activeContractCheck(id, client.docNumber);
      if (check.isBlocked) {
        return {
          success: false,
          error: `Impossible de supprimer ce client : il est actuellement engagé dans le contrat actif N° ${check.contractNumber || ''}. Clôturez ou annulez d'abord le contrat.`,
        };
      }
    }

    const updatedClients = clients.filter((c) => c.id !== id);
    setClients(updatedClients);

    if (selectedClient?.id === id) {
      setSelectedClient(null);
    }

    saveRemoteAgencyData({ clients: updatedClients }).catch((err) =>
      console.warn('Auto-save deleteClient to Firestore note:', err)
    );

    logAction(
      'Suppression client',
      'client',
      id,
      `Suppression définitive de la fiche client : ${client.firstName} ${client.lastName} (${client.docNumber}) par ${currentUser?.name || 'Direction'}`
    );

    return { success: true };
  };

  const addDriver = (driverData: Omit<Driver, 'id' | 'createdAt'>): Driver => {
    const newDriver: Driver = {
      ...driverData,
      id: `drv-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updatedDrivers = [newDriver, ...drivers];
    setDrivers(updatedDrivers);
    saveRemoteAgencyData({ drivers: updatedDrivers }).catch((err) =>
      console.warn('Auto-save addDriver to Firestore note:', err)
    );
    logAction('Création conducteur', 'driver', newDriver.id, `Nouveau conducteur : ${newDriver.firstName} ${newDriver.lastName}`);
    return newDriver;
  };

  const getClientAssignedManager = (
    client: Client,
    contracts: Contract[],
    vehicles: Vehicle[],
    users: User[]
  ): ClientManagerAssignment => {
    return resolveClientManagerAndVehicle(client, contracts, vehicles, users);
  };

  const setClientsList = (newClients: Client[]) => setClients(newClients);
  const setDriversList = (newDrivers: Driver[]) => setDrivers(newDrivers);

  return (
    <ClientsDriversContext.Provider
      value={{
        clients,
        drivers,
        selectedClient,
        setSelectedClient,
        addClient,
        updateClient,
        deleteClient,
        addDriver,
        getClientAssignedManager,
        setClientsList,
        setClientsListByUpdater: setClients,
        setDriversList,
      }}
    >
      {children}
    </ClientsDriversContext.Provider>
  );
};

export const useClientsDrivers = () => {
  const context = useContext(ClientsDriversContext);
  if (!context) {
    throw new Error('useClientsDrivers must be used within a ClientsDriversProvider');
  }
  return context;
};
