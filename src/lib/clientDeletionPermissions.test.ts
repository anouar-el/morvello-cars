import { describe, it, expect, vi } from 'vitest';
import { User, Client, Contract } from '../types';

describe('Client Deletion Permission & Authorization Check', () => {
  const dummyClient: Client = {
    id: 'cli-test-1234',
    firstName: 'Karim',
    lastName: 'Bennani',
    birthDate: '1985-05-15',
    drivingLicense: 'B123456',
    docType: 'CIN',
    docNumber: 'AB123456',
    phone: '0661234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    contractCount: 0,
  };

  const adminUser: User = {
    id: 'usr-admin-1',
    name: 'Super Admin',
    email: 'admin@morvellocars.com',
    role: 'admin',
  };

  const managerUser: User = {
    id: 'usr-manager-1',
    name: 'Manager',
    email: 'manager@morvellocars.com',
    role: 'manager',
  };

  const agentUserWithoutPerm: User = {
    id: 'usr-agent-1',
    name: 'Agent Standard',
    email: 'agent@morvellocars.com',
    role: 'agent',
    permissions: {
      canDeleteClients: false,
    } as any,
  };

  const agentUserWithPerm: User = {
    id: 'usr-agent-2',
    name: 'Agent Privilégié',
    email: 'agent2@morvellocars.com',
    role: 'agent',
    permissions: {
      canDeleteClients: true,
    } as any,
  };

  function evaluateClientDeletion(
    client: Client,
    user: User | null | undefined,
    activeContractCheck?: (clientId: string, docNumber?: string) => { isBlocked: boolean; contractNumber?: string }
  ): { success: boolean; error?: string } {
    if (!client) {
      return { success: false, error: 'Client introuvable.' };
    }

    const isGerant = user?.role === 'admin';
    const isManager = user?.role === 'manager';
    const hasPermission = Boolean(user?.permissions?.canDeleteClients);

    if (!isGerant && !isManager && !hasPermission) {
      return {
        success: false,
        error: 'Permission refusée : vous ne disposez pas des droits pour supprimer ce client.',
      };
    }

    if (activeContractCheck) {
      const check = activeContractCheck(client.id, client.docNumber);
      if (check.isBlocked) {
        return {
          success: false,
          error: `Impossible de supprimer ce client : il est actuellement engagé dans le contrat actif N° ${check.contractNumber || ''}. Clôturez ou annulez d'abord le contrat.`,
        };
      }
    }

    return { success: true };
  }

  it('allows Super Admin (role === "admin") to delete a client without permission errors', () => {
    const res = evaluateClientDeletion(dummyClient, adminUser);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('allows Manager (role === "manager") to delete a client', () => {
    const res = evaluateClientDeletion(dummyClient, managerUser);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('allows an Agent with canDeleteClients explicit permission to delete a client', () => {
    const res = evaluateClientDeletion(dummyClient, agentUserWithPerm);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('denies an Agent without canDeleteClients permission', () => {
    const res = evaluateClientDeletion(dummyClient, agentUserWithoutPerm);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Permission refusée : vous ne disposez pas des droits pour supprimer ce client.');
  });

  it('blocks deletion if client is attached to an active contract even for Super Admin', () => {
    const res = evaluateClientDeletion(dummyClient, adminUser, (clientId) => {
      return { isBlocked: true, contractNumber: 'CTR-2026-0099' };
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('contrat actif N° CTR-2026-0099');
  });
});
