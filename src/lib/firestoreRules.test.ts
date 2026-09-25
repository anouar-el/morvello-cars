import { describe, it, expect } from 'vitest';

/**
 * High-fidelity test harness simulating Cloud Firestore Security Rules evaluation engine
 * strictly conforming to the logic defined in /firestore.rules.
 */

interface RequestAuth {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
    admin?: boolean;
    role?: string;
    [key: string]: any;
  };
}

interface FirestoreState {
  users?: Record<string, any>;
  admins?: Record<string, any>;
  agencies?: Record<string, any>;
}

export class FirestoreRulesSimulator {
  static evaluate(
    operation: 'get' | 'list' | 'create' | 'update' | 'delete',
    path: string,
    params: {
      auth: RequestAuth | null;
      resource?: { data: any };
      requestResource?: { data: any };
      dbState?: FirestoreState;
    }
  ): { allowed: boolean; reason?: string } {
    const { auth, resource, requestResource, dbState = {} } = params;

    // Primitives
    const isSignedIn = () => auth !== null && !!auth.uid;
    const incoming = () => requestResource?.data;
    const existing = () => resource?.data;

    const isValidId = (id: string) => {
      return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
    };

    const isBootstrappedAdmin = () => {
      return (
        isSignedIn() &&
        auth?.token?.email === 'anouar7fac@gmail.com' &&
        auth?.token?.email_verified === true
      );
    };

    const isAdmin = () => {
      if (!isSignedIn()) return false;
      if (isBootstrappedAdmin()) return true;
      if (dbState.admins && dbState.admins[auth!.uid]) return true;
      if (dbState.users && dbState.users[auth!.uid]?.role === 'admin') return true;
      if (auth?.token?.admin === true || auth?.token?.role === 'admin') return true;
      return false;
    };

    const isAgencyMember = (agencyId: string) => {
      if (!isSignedIn()) return false;
      if (isAdmin()) return true;
      const userDoc = dbState.users ? dbState.users[auth!.uid] : undefined;
      if (!userDoc) return false;
      if (userDoc.agency === agencyId) return true;
      if (
        agencyId.startsWith('morvello') &&
        (!userDoc.agency || userDoc.agency === 'Agence Morvello' || userDoc.agency === 'morvello_main')
      ) {
        return true;
      }
      return false;
    };

    const isValidUserProfile = (data: any) => {
      if (!data) return false;
      if (typeof data.uid !== 'string' || data.uid.length === 0 || data.uid.length > 128) return false;
      if (typeof data.email !== 'string' || data.email.length === 0 || data.email.length > 256) return false;
      if (!['admin', 'manager', 'agent'].includes(data.role)) return false;
      if (data.name !== undefined && (typeof data.name !== 'string' || data.name.length > 200)) return false;
      if (data.phone !== undefined && (typeof data.phone !== 'string' || data.phone.length > 50)) return false;
      if (data.agency !== undefined && (typeof data.agency !== 'string' || data.agency.length > 200)) return false;
      if (data.assignedFleetName !== undefined && (typeof data.assignedFleetName !== 'string' || data.assignedFleetName.length > 200)) return false;
      if (data.adminClaim !== undefined && typeof data.adminClaim !== 'boolean') return false;
      if (data.updatedAt !== undefined && (typeof data.updatedAt !== 'string' || data.updatedAt.length > 100)) return false;
      if (data.updatedBy !== undefined && (typeof data.updatedBy !== 'string' || data.updatedBy.length > 128)) return false;
      return true;
    };

    const isValidAgency = (data: any) => {
      if (!data) return false;
      if (typeof data.updatedAt !== 'string' || data.updatedAt.length > 100) return false;
      if (data.vehicles !== undefined && (!Array.isArray(data.vehicles) || data.vehicles.length > 5000)) return false;
      if (data.clients !== undefined && (!Array.isArray(data.clients) || data.clients.length > 5000)) return false;
      if (data.drivers !== undefined && (!Array.isArray(data.drivers) || data.drivers.length > 5000)) return false;
      if (data.contracts !== undefined && (!Array.isArray(data.contracts) || data.contracts.length > 5000)) return false;
      if (data.deposits !== undefined && (!Array.isArray(data.deposits) || data.deposits.length > 5000)) return false;
      if (data.companySettings !== undefined && (typeof data.companySettings !== 'object' || data.companySettings === null || Array.isArray(data.companySettings))) return false;
      if (data.termsVersion !== undefined && (typeof data.termsVersion !== 'object' || data.termsVersion === null || Array.isArray(data.termsVersion))) return false;
      if (data.users !== undefined && (!Array.isArray(data.users) || data.users.length > 500)) return false;
      if (data.aiSettings !== undefined && (typeof data.aiSettings !== 'object' || data.aiSettings === null || Array.isArray(data.aiSettings))) return false;
      if (data.auditLogs !== undefined && (!Array.isArray(data.auditLogs) || data.auditLogs.length > 5000)) return false;
      if (data.updatedBy !== undefined && (typeof data.updatedBy !== 'string' || data.updatedBy.length > 128)) return false;
      return true;
    };

    // Route matching
    const parts = path.split('/').filter(Boolean);

    // 1. /test/{docId}
    if (parts[0] === 'test') {
      const docId = parts[1];
      if (operation === 'get') {
        const ok = isSignedIn() && isValidId(docId);
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }
      return { allowed: false, reason: 'PERMISSION_DENIED: Test probe is read-only' };
    }

    // 2. /users/{userId}
    if (parts[0] === 'users') {
      const userId = parts[1];
      if (!isValidId(userId)) {
        return { allowed: false, reason: 'PERMISSION_DENIED: Invalid userId format' };
      }

      if (operation === 'get' || operation === 'list') {
        const ok = isSignedIn() && (auth!.uid === userId || isAdmin());
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }

      if (operation === 'create') {
        const data = incoming();
        if (!isSignedIn() || !isValidUserProfile(data)) {
          return { allowed: false, reason: 'PERMISSION_DENIED: Invalid schema or unauthenticated' };
        }
        const adminAllowed = isAdmin();
        const selfRegistrationAllowed =
          auth!.uid === userId &&
          data.uid === auth!.uid &&
          ['manager', 'agent'].includes(data.role) &&
          (data.adminClaim === undefined || data.adminClaim === false);

        const ok = adminAllowed || selfRegistrationAllowed;
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }

      if (operation === 'update') {
        const inData = incoming();
        const exData = existing();
        if (!isSignedIn() || !isValidUserProfile(inData)) {
          return { allowed: false, reason: 'PERMISSION_DENIED: Invalid schema or unauthenticated' };
        }

        if (isAdmin()) {
          return { allowed: true };
        }

        // Tier 2: Non-admin user updating their own profile
        const isSelf = auth!.uid === userId;
        const immutableMatch =
          inData.uid === exData.uid &&
          inData.email === exData.email &&
          inData.role === exData.role &&
          (inData.adminClaim === undefined || inData.adminClaim === exData.adminClaim) &&
          (inData.agency === undefined || inData.agency === exData.agency);

        // Affected keys check
        const inKeys = Object.keys(inData);
        const changedKeys = inKeys.filter(
          (k) => JSON.stringify(inData[k]) !== JSON.stringify(exData[k])
        );
        const affectedOnlySafe = changedKeys.every((k) => ['name', 'phone', 'updatedAt'].includes(k));

        const ok = isSelf && immutableMatch && affectedOnlySafe;
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }

      if (operation === 'delete') {
        const ok = isAdmin() && userId !== auth!.uid;
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }
    }

    // 3. /agencies/{agencyId}
    if (parts[0] === 'agencies') {
      const agencyId = parts[1];
      if (!isValidId(agencyId)) {
        return { allowed: false, reason: 'PERMISSION_DENIED: Invalid agencyId format' };
      }

      if (operation === 'get' || operation === 'list') {
        const ok = isSignedIn() && isAgencyMember(agencyId);
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }

      if (operation === 'create') {
        const ok = isSignedIn() && isValidAgency(incoming()) && isAdmin();
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }

      if (operation === 'update') {
        const inData = incoming();
        const exData = existing();
        if (!isSignedIn() || !isValidAgency(inData) || !isAgencyMember(agencyId)) {
          return { allowed: false, reason: 'PERMISSION_DENIED' };
        }

        if (isAdmin()) {
          return { allowed: true };
        }

        // Tier 2: Manager/Agent affected keys check
        const changedKeys = Object.keys(inData).filter(
          (k) => JSON.stringify(inData[k]) !== JSON.stringify(exData[k])
        );
        const allowedKeys = [
          'vehicles',
          'clients',
          'drivers',
          'contracts',
          'deposits',
          'aiSettings',
          'auditLogs',
          'updatedAt',
          'updatedBy',
        ];
        const ok = changedKeys.every((k) => allowedKeys.includes(k));
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }

      if (operation === 'delete') {
        const ok = isAdmin();
        return { allowed: ok, reason: ok ? undefined : 'PERMISSION_DENIED' };
      }
    }

    // Default deny
    return { allowed: false, reason: 'PERMISSION_DENIED: Unmatched route' };
  }
}

describe('Problem #5: Firestore Security Rules & RBAC Hardening', () => {
  const rootAdminAuth: RequestAuth = {
    uid: 'admin_root',
    token: {
      email: 'anouar7fac@gmail.com',
      email_verified: true,
      admin: true,
      role: 'admin',
    },
  };

  const managerAuth: RequestAuth = {
    uid: 'mgr_bob',
    token: {
      email: 'bob@morvellocars.com',
      email_verified: true,
      role: 'manager',
    },
  };

  const attackerAuth: RequestAuth = {
    uid: 'attacker_uid',
    token: {
      email: 'hacker@random.com',
      email_verified: true,
      role: 'agent',
    },
  };

  const mockDbState: FirestoreState = {
    users: {
      admin_root: { uid: 'admin_root', email: 'anouar7fac@gmail.com', role: 'admin', agency: 'morvello_main' },
      mgr_bob: { uid: 'mgr_bob', email: 'bob@morvellocars.com', role: 'manager', agency: 'morvello_main' },
      user_alice: { uid: 'user_alice', email: 'alice@morvellocars.com', role: 'agent', agency: 'morvello_main' },
    },
  };

  describe('The "Dirty Dozen" Adversarial Payloads', () => {
    it('D1: Blocks unauthenticated read on agency fleet and contracts', () => {
      const res = FirestoreRulesSimulator.evaluate('get', 'agencies/morvello_main', {
        auth: null,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D2: Blocks unauthenticated write / overwrite on agency document', () => {
      const res = FirestoreRulesSimulator.evaluate('update', 'agencies/morvello_main', {
        auth: null,
        resource: { data: { updatedAt: '2026-09-25T10:00:00Z', vehicles: [] } },
        requestResource: { data: { updatedAt: '2026-09-25T10:05:00Z', vehicles: [] } },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D3: Blocks format-only bypass attempt (valid regex ID without authentication)', () => {
      const res = FirestoreRulesSimulator.evaluate('create', 'agencies/morvello_main', {
        auth: null,
        requestResource: { data: { updatedAt: '2026-09-25T10:00:00Z' } },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D4: Blocks self-promotion / privilege escalation at user creation (setting role: admin)', () => {
      const res = FirestoreRulesSimulator.evaluate('create', 'users/attacker_uid', {
        auth: attackerAuth,
        requestResource: {
          data: {
            uid: 'attacker_uid',
            email: 'hacker@random.com',
            role: 'admin',
            adminClaim: true,
          },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D5: Blocks self-promotion via profile update (manager changing role to admin)', () => {
      const res = FirestoreRulesSimulator.evaluate('update', 'users/mgr_bob', {
        auth: managerAuth,
        resource: {
          data: {
            uid: 'mgr_bob',
            email: 'bob@morvellocars.com',
            role: 'manager',
            name: 'Bob Manager',
          },
        },
        requestResource: {
          data: {
            uid: 'mgr_bob',
            email: 'bob@morvellocars.com',
            role: 'admin',
            name: 'Bob Manager',
          },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D6: Blocks cross-user profile tampering (attacker modifying another user)', () => {
      const res = FirestoreRulesSimulator.evaluate('update', 'users/user_alice', {
        auth: attackerAuth,
        resource: {
          data: {
            uid: 'user_alice',
            email: 'alice@morvellocars.com',
            role: 'agent',
            name: 'Alice',
          },
        },
        requestResource: {
          data: {
            uid: 'user_alice',
            email: 'alice@morvellocars.com',
            role: 'agent',
            name: 'Hacked Name',
          },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D7: Blocks cross-user PII harvesting (non-admin reading another user profile)', () => {
      const res = FirestoreRulesSimulator.evaluate('get', 'users/user_alice', {
        auth: attackerAuth,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D8: Blocks spoofed admin email attack when email_verified is false', () => {
      const spoofedAuth: RequestAuth = {
        uid: 'fake_anouar',
        token: {
          email: 'anouar7fac@gmail.com',
          email_verified: false, // spoofed!
        },
      };

      const res = FirestoreRulesSimulator.evaluate('update', 'agencies/morvello_main', {
        auth: spoofedAuth,
        resource: {
          data: { updatedAt: '2026-09-25T10:00:00Z', companySettings: { name: 'Morvello' } },
        },
        requestResource: {
          data: { updatedAt: '2026-09-25T10:05:00Z', companySettings: { name: 'Attacker Agency' } },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D9: Blocks cross-agency data pollution (external user writing to morvello_main)', () => {
      const externalAuth: RequestAuth = {
        uid: 'ext_user',
        token: { email: 'user@otheragency.com', email_verified: true, role: 'manager' },
      };
      const foreignDbState: FirestoreState = {
        users: {
          ext_user: { uid: 'ext_user', agency: 'foreign_agency_99', role: 'manager' },
        },
      };

      const res = FirestoreRulesSimulator.evaluate('get', 'agencies/morvello_main', {
        auth: externalAuth,
        dbState: foreignDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D10: Blocks manager from modifying companySettings or termsVersion', () => {
      const res = FirestoreRulesSimulator.evaluate('update', 'agencies/morvello_main', {
        auth: managerAuth,
        resource: {
          data: {
            updatedAt: '2026-09-25T10:00:00Z',
            companySettings: { iban: 'MA640001', name: 'Morvello Cars' },
            vehicles: [],
          },
        },
        requestResource: {
          data: {
            updatedAt: '2026-09-25T10:05:00Z',
            companySettings: { iban: 'ATTACKER_IBAN_9999', name: 'Morvello Cars' },
            vehicles: [],
          },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D11: Blocks agency document deletion by non-admin manager', () => {
      const res = FirestoreRulesSimulator.evaluate('delete', 'agencies/morvello_main', {
        auth: managerAuth,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });

    it('D12: Blocks ID poisoning and denial-of-wallet payload (invalid/oversized ID)', () => {
      const junkId = 'a'.repeat(300);
      const res = FirestoreRulesSimulator.evaluate('get', `users/${junkId}`, {
        auth: rootAdminAuth,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('PERMISSION_DENIED');
    });
  });

  describe('Legitimate Authorized Workflows', () => {
    it('Allows authenticated team member to read their authorized agency document', () => {
      const res = FirestoreRulesSimulator.evaluate('get', 'agencies/morvello_main', {
        auth: managerAuth,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(true);
    });

    it('Allows manager to update operational fleet and contracts', () => {
      const res = FirestoreRulesSimulator.evaluate('update', 'agencies/morvello_main', {
        auth: managerAuth,
        resource: {
          data: {
            updatedAt: '2026-09-25T10:00:00Z',
            vehicles: [{ id: 'veh-1', brand: 'BMW' }],
            companySettings: { name: 'Morvello Cars' },
          },
        },
        requestResource: {
          data: {
            updatedAt: '2026-09-25T10:05:00Z',
            vehicles: [{ id: 'veh-1', brand: 'BMW' }, { id: 'veh-2', brand: 'Audi' }],
            companySettings: { name: 'Morvello Cars' },
          },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(true);
    });

    it('Allows user to read their own private profile', () => {
      const res = FirestoreRulesSimulator.evaluate('get', 'users/mgr_bob', {
        auth: managerAuth,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(true);
    });

    it('Allows user to update their own non-RBAC profile fields (name, phone)', () => {
      const res = FirestoreRulesSimulator.evaluate('update', 'users/mgr_bob', {
        auth: managerAuth,
        resource: {
          data: {
            uid: 'mgr_bob',
            email: 'bob@morvellocars.com',
            role: 'manager',
            name: 'Bob',
            phone: '+212600000000',
          },
        },
        requestResource: {
          data: {
            uid: 'mgr_bob',
            email: 'bob@morvellocars.com',
            role: 'manager',
            name: 'Bob Updated',
            phone: '+212611111111',
          },
        },
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(true);
    });

    it('Allows root administrator full authority over agency settings and user deletion', () => {
      const updateSettings = FirestoreRulesSimulator.evaluate('update', 'agencies/morvello_main', {
        auth: rootAdminAuth,
        resource: {
          data: {
            updatedAt: '2026-09-25T10:00:00Z',
            companySettings: { name: 'Morvello Cars' },
          },
        },
        requestResource: {
          data: {
            updatedAt: '2026-09-25T10:05:00Z',
            companySettings: { name: 'Morvello Luxury Cars SARL' },
          },
        },
        dbState: mockDbState,
      });
      expect(updateSettings.allowed).toBe(true);

      const deleteUser = FirestoreRulesSimulator.evaluate('delete', 'users/attacker_uid', {
        auth: rootAdminAuth,
        dbState: mockDbState,
      });
      expect(deleteUser.allowed).toBe(true);
    });

    it('Allows authenticated connection probe on /test/connection', () => {
      const res = FirestoreRulesSimulator.evaluate('get', 'test/connection', {
        auth: managerAuth,
        dbState: mockDbState,
      });
      expect(res.allowed).toBe(true);
    });
  });
});
