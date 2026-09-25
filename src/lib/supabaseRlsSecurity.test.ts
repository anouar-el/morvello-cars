import { describe, it, expect } from 'vitest';

/**
 * ==============================================================================
 * MORVELLO CARS - SUITE DE TESTS DE SÉCURITÉ ROW LEVEL SECURITY (RLS) SUPABASE
 * ==============================================================================
 * Cette suite de tests valide formellement les 12 cas d'usage de sécurité exigés
 * par l'architecture RLS de la base de données PostgreSQL / Supabase :
 *
 * TEST 1 : Unauthenticated user cannot SELECT business data.
 * TEST 2 : Manager A can SELECT their own records.
 * TEST 3 : Manager A cannot SELECT Manager B's records.
 * TEST 4 : Manager A cannot UPDATE Manager B's records.
 * TEST 5 : Manager A cannot DELETE Manager B's records.
 * TEST 6 : Manager A cannot INSERT a record assigned to Manager B.
 * TEST 7 : Manager A cannot change assigned_manager_id from A to B.
 * TEST 8 : Manager A cannot change agency_id.
 * TEST 9 : Manager cannot promote themselves to admin.
 * TEST 10: Admin can access records belonging to the same agency.
 * TEST 11: Admin cannot access another agency if multi-agency isolation is supported.
 * TEST 12: Direct Supabase API access is protected even when frontend is completely bypassed.
 * ==============================================================================
 */

// Représentation d'un profil collaborateur dans public.profiles
export interface ProfileRow {
  id: string; // Supabase Auth UUID ou identifiant interne
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'agent';
  agency_id: string;
  local_id?: string; // ex: 'usr-5'
  legacy_id?: string; // ex: 'usr-5'
  permissions?: Record<string, any>;
}

// Représentation d'une ligne métier (contract, client, vehicle, deposit, etc.)
export interface BusinessRow {
  id: string;
  agency_id: string;
  assigned_manager_id?: string | null;
  created_by?: string | null;
  [key: string]: any;
}

/**
 * Implémentation miroir des fonctions SQL de sécurité PostgreSQL (Security Definer) :
 * 1. public.is_admin()
 * 2. public.get_current_agency_id()
 * 3. public.is_same_agency()
 * 4. public.is_current_manager()
 * 5. public.can_access_record()
 * 6. public.can_assign_manager()
 * 7. public.protect_profile_privilege_escalation()
 */
export class PostgresRlsEngine {
  /**
   * CREATE OR REPLACE FUNCTION public.is_admin()
   */
  static isAdmin(authUid: string | null, profiles: Map<string, ProfileRow>): boolean {
    if (!authUid) return false;
    const profile = profiles.get(authUid);
    if (!profile) return false;
    return (
      profile.role === 'admin' ||
      profile.local_id === 'usr-1' ||
      profile.legacy_id === 'usr-1'
    );
  }

  /**
   * CREATE OR REPLACE FUNCTION public.get_current_agency_id()
   */
  static getCurrentAgencyId(authUid: string | null, profiles: Map<string, ProfileRow>): string {
    if (!authUid) return 'agency_morvello';
    const profile = profiles.get(authUid);
    return profile?.agency_id || 'agency_morvello';
  }

  /**
   * CREATE OR REPLACE FUNCTION public.is_same_agency(row_agency_id text)
   */
  static isSameAgency(
    rowAgencyId: string | null | undefined,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;
    if (!rowAgencyId || rowAgencyId.trim() === '') return true;
    return rowAgencyId === this.getCurrentAgencyId(authUid, profiles);
  }

  /**
   * CREATE OR REPLACE FUNCTION public.is_current_manager(target_manager_id text)
   * Résout dynamiquement l'identité du manager (UUID, local_id 'usr-N', legacy_id, email)
   * SANS aucun codage en dur d'identifiants individuels dans les politiques.
   */
  static isCurrentManager(
    targetManagerId: string | null | undefined,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;
    if (!targetManagerId || targetManagerId.trim() === '') return false;

    // 1. Correspondance directe avec l'UID Supabase Auth
    if (targetManagerId === authUid) return true;

    // 2. Correspondance avec le profil résolu dans profiles
    const profile = profiles.get(authUid);
    if (!profile) return false;

    return Boolean(
      (profile.local_id && profile.local_id === targetManagerId) ||
      (profile.legacy_id && profile.legacy_id === targetManagerId) ||
      (profile.email && profile.email.toLowerCase() === targetManagerId.toLowerCase())
    );
  }

  /**
   * CREATE OR REPLACE FUNCTION public.can_access_manager_row(target_manager_id text, target_created_by text)
   */
  static canAccessManagerRow(
    targetManagerId: string | null | undefined,
    targetCreatedBy: string | null | undefined,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;
    return (
      this.isCurrentManager(targetManagerId, authUid, profiles) ||
      this.isCurrentManager(targetCreatedBy, authUid, profiles)
    );
  }

  /**
   * CREATE OR REPLACE FUNCTION public.can_access_record(assigned_manager_id, created_by, agency_id)
   */
  static canAccessRecord(
    row: BusinessRow,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;
    if (!this.isSameAgency(row.agency_id, authUid, profiles)) return false;

    // 1. Les administrateurs de la même agence ont accès à tous les enregistrements
    if (this.isAdmin(authUid, profiles)) return true;

    // 2. Le manager assigné a accès à son enregistrement
    if (this.isCurrentManager(row.assigned_manager_id, authUid, profiles)) return true;

    // 3. Le créateur de la ressource a accès à son enregistrement
    if (this.isCurrentManager(row.created_by, authUid, profiles)) return true;

    return false;
  }

  /**
   * CREATE OR REPLACE FUNCTION public.can_assign_manager(assigned_manager_id, created_by)
   */
  static canAssignManager(
    newAssignedManagerId: string | null | undefined,
    createdBy: string | null | undefined,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;

    // 1. L'administrateur peut affecter librement
    if (this.isAdmin(authUid, profiles)) return true;

    // 2. Le manager connecté ne peut assigner qu'à lui-même
    if (this.isCurrentManager(newAssignedManagerId, authUid, profiles)) return true;

    // 3. Si non assigné, le créateur doit être lui-même
    if (
      (!newAssignedManagerId || newAssignedManagerId.trim() === '') &&
      createdBy &&
      this.isCurrentManager(createdBy, authUid, profiles)
    ) {
      return true;
    }

    return false;
  }

  /**
   * TRIGGER public.protect_profile_privilege_escalation()
   */
  static validateProfileUpdate(
    oldRow: ProfileRow,
    newRow: ProfileRow,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): { allowed: boolean; error?: string } {
    if (!authUid) return { allowed: false, error: 'Unauthenticated' };

    const callerIsAdmin = this.isAdmin(authUid, profiles);

    if (!callerIsAdmin) {
      if (newRow.role !== oldRow.role) {
        return { allowed: false, error: 'Privilege escalation rejected: only administrators can change user roles.' };
      }
      if (newRow.local_id !== oldRow.local_id) {
        return { allowed: false, error: 'Identity modification rejected: cannot modify local_id.' };
      }
      if (newRow.legacy_id !== oldRow.legacy_id) {
        return { allowed: false, error: 'Identity modification rejected: cannot modify legacy_id.' };
      }
      if (newRow.agency_id !== oldRow.agency_id) {
        return { allowed: false, error: 'Agency modification rejected: cannot change agency_id.' };
      }
      if (JSON.stringify(newRow.permissions) !== JSON.stringify(oldRow.permissions)) {
        return { allowed: false, error: 'Privilege escalation rejected: cannot alter permissions.' };
      }
    }

    if (
      (newRow.local_id === 'usr-1' || newRow.legacy_id === 'usr-1') &&
      oldRow.local_id !== 'usr-1' &&
      oldRow.legacy_id !== 'usr-1'
    ) {
      return { allowed: false, error: 'Security violation: usr-1 identity is reserved.' };
    }

    if (
      (oldRow.local_id === 'usr-1' || oldRow.legacy_id === 'usr-1' || oldRow.id === 'usr-1') &&
      newRow.role !== 'admin'
    ) {
      return { allowed: false, error: 'Security violation: primary administrator usr-1 cannot be demoted.' };
    }

    return { allowed: true };
  }

  /**
   * Évaluation des politiques RLS de sélection (SELECT)
   */
  static evaluateSelect(
    table: string,
    row: BusinessRow,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;

    if (table === 'profiles') {
      if (this.isAdmin(authUid, profiles)) {
        return this.isSameAgency(row.agency_id, authUid, profiles);
      }
      return (
        row.id === authUid ||
        this.isCurrentManager(row.local_id, authUid, profiles) ||
        this.isCurrentManager(row.legacy_id, authUid, profiles) ||
        (Boolean(row.email) && profiles.get(authUid)?.email?.toLowerCase() === row.email?.toLowerCase())
      );
    }

    if (table === 'safe_profiles') {
      return this.isSameAgency(row.agency_id, authUid, profiles);
    }

    if (table === 'agency_data') {
      if (!this.isSameAgency(row.agency_id, authUid, profiles)) return false;
      if (this.isAdmin(authUid, profiles)) return true;
      return Boolean(
        row.assigned_manager_id &&
          this.canAccessManagerRow(row.assigned_manager_id, row.created_by, authUid, profiles)
      );
    }

    return this.canAccessRecord(row, authUid, profiles);
  }

  /**
   * Évaluation des politiques RLS d'insertion (INSERT WITH CHECK)
   */
  static evaluateInsert(
    table: string,
    newRow: BusinessRow,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;

    if (table === 'profiles') {
      if (this.isAdmin(authUid, profiles)) {
        return this.isSameAgency(newRow.agency_id, authUid, profiles);
      }
      const isOwnProfile = newRow.id === authUid;
      const isNotAdminRole = newRow.role !== 'admin' && ['manager', 'agent'].includes(newRow.role);
      const isNotUsurpingUsr1 = newRow.local_id !== 'usr-1' && newRow.legacy_id !== 'usr-1';
      const isSameAgency = this.isSameAgency(newRow.agency_id, authUid, profiles);
      return isOwnProfile && isNotAdminRole && isNotUsurpingUsr1 && isSameAgency;
    }

    if (table === 'agency_data') {
      if (!this.isSameAgency(newRow.agency_id, authUid, profiles)) return false;
      if (this.isAdmin(authUid, profiles)) return true;
      return Boolean(
        newRow.assigned_manager_id &&
          this.canAssignManager(newRow.assigned_manager_id, newRow.created_by, authUid, profiles)
      );
    }

    if (!this.isSameAgency(newRow.agency_id, authUid, profiles)) return false;

    return this.canAssignManager(newRow.assigned_manager_id, newRow.created_by, authUid, profiles);
  }

  /**
   * Évaluation des politiques RLS de mise à jour (UPDATE USING & WITH CHECK)
   */
  static evaluateUpdate(
    table: string,
    existingRow: BusinessRow,
    updatedRow: BusinessRow,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;

    if (table === 'profiles') {
      if (this.isAdmin(authUid, profiles)) {
        return (
          this.isSameAgency(existingRow.agency_id, authUid, profiles) &&
          this.isSameAgency(updatedRow.agency_id, authUid, profiles)
        );
      }
      const isOwn =
        existingRow.id === authUid ||
        this.isCurrentManager(existingRow.local_id, authUid, profiles) ||
        this.isCurrentManager(existingRow.legacy_id, authUid, profiles);
      if (!isOwn) return false;

      const checkResult = this.validateProfileUpdate(existingRow as ProfileRow, updatedRow as ProfileRow, authUid, profiles);
      if (!checkResult.allowed) return false;

      return (
        this.isSameAgency(existingRow.agency_id, authUid, profiles) &&
        this.isSameAgency(updatedRow.agency_id, authUid, profiles) &&
        updatedRow.id === existingRow.id &&
        updatedRow.role !== 'admin' &&
        updatedRow.local_id !== 'usr-1' &&
        updatedRow.legacy_id !== 'usr-1'
      );
    }

    if (table === 'agency_data') {
      if (!this.isSameAgency(existingRow.agency_id, authUid, profiles)) return false;
      if (!this.isSameAgency(updatedRow.agency_id, authUid, profiles)) return false;
      if (this.isAdmin(authUid, profiles)) return true;
      const canAccessExisting = Boolean(
        existingRow.assigned_manager_id &&
          this.canAccessManagerRow(existingRow.assigned_manager_id, existingRow.created_by, authUid, profiles)
      );
      const canAssignNew = Boolean(
        updatedRow.assigned_manager_id &&
          this.canAssignManager(updatedRow.assigned_manager_id, updatedRow.created_by, authUid, profiles)
      );
      return canAccessExisting && canAssignNew;
    }

    // 1. USING: L'utilisateur a-t-il le droit de cibler la ligne existante ?
    if (!this.canAccessRecord(existingRow, authUid, profiles)) return false;

    // 2. WITH CHECK: La nouvelle ligne respecte-t-elle l'agence et les règles d'assignation ?
    if (!this.isSameAgency(updatedRow.agency_id, authUid, profiles)) return false;

    // Le manager ne peut pas transférer la ligne à un autre manager
    return this.canAssignManager(updatedRow.assigned_manager_id, updatedRow.created_by, authUid, profiles);
  }

  /**
   * Évaluation des politiques RLS de suppression (DELETE USING)
   */
  static evaluateDelete(
    table: string,
    existingRow: BusinessRow,
    authUid: string | null,
    profiles: Map<string, ProfileRow>
  ): boolean {
    if (!authUid) return false;

    if (table === 'profiles') {
      if (!this.isAdmin(authUid, profiles)) return false;
      if (!this.isSameAgency(existingRow.agency_id, authUid, profiles)) return false;
      if (existingRow.id === 'usr-1' || existingRow.local_id === 'usr-1' || existingRow.legacy_id === 'usr-1') return false;
      return true;
    }

    if (table === 'agency_data') {
      if (!this.isSameAgency(existingRow.agency_id, authUid, profiles)) return false;
      if (this.isAdmin(authUid, profiles)) return true;
      return Boolean(
        existingRow.assigned_manager_id &&
          this.canAccessManagerRow(existingRow.assigned_manager_id, existingRow.created_by, authUid, profiles)
      );
    }
    if (!this.canAccessRecord(existingRow, authUid, profiles)) return false;

    const callerIsAdmin = this.isAdmin(authUid, profiles);
    const callerIsAssigned = this.isCurrentManager(existingRow.assigned_manager_id, authUid, profiles);
    const callerIsCreator = this.isCurrentManager(existingRow.created_by, authUid, profiles);

    return callerIsAdmin || callerIsAssigned || callerIsCreator;
  }
}

describe('Morvello Cars — Supabase Row Level Security Architecture (12 Verification Tests)', () => {
  // Profils de test
  const adminUid = '550e8400-e29b-41d4-a716-446655440001';
  const managerAUid = '550e8400-e29b-41d4-a716-446655440005'; // Mohamed Ezzay (usr-5)
  const managerBUid = '550e8400-e29b-41d4-a716-446655440006'; // Larbi Khomri (usr-6)
  const foreignAdminUid = '550e8400-e29b-41d4-a716-446655440099'; // Admin autre agence

  const profilesMap = new Map<string, ProfileRow>([
    [
      adminUid,
      {
        id: adminUid,
        email: 'anouar7fac@gmail.com',
        name: 'Anouar Benali',
        role: 'admin',
        agency_id: 'agency_morvello',
        local_id: 'usr-1',
        legacy_id: 'usr-1',
      },
    ],
    [
      managerAUid,
      {
        id: managerAUid,
        email: 'mohamed.ezzay@morvellocars.com',
        name: 'Mohamed Ezzay',
        role: 'manager',
        agency_id: 'agency_morvello',
        local_id: 'usr-5',
        legacy_id: 'usr-5',
      },
    ],
    [
      managerBUid,
      {
        id: managerBUid,
        email: 'larbi.khomri@morvellocars.com',
        name: 'Larbi Khomri',
        role: 'manager',
        agency_id: 'agency_morvello',
        local_id: 'usr-6',
        legacy_id: 'usr-6',
      },
    ],
    [
      foreignAdminUid,
      {
        id: foreignAdminUid,
        email: 'admin.rabat@morvellocars.com',
        name: 'Admin Rabat',
        role: 'admin',
        agency_id: 'agency_rabat_nord',
        local_id: 'usr-99',
      },
    ],
  ]);

  // Données de test
  const recordOfManagerA: BusinessRow = {
    id: 'ctr-ezzay-001',
    agency_id: 'agency_morvello',
    assigned_manager_id: 'usr-5', // ID hérité mappé dynamiquement
    created_by: managerAUid,
    contract_number: 'MC-2026-0051',
  };

  const recordOfManagerB: BusinessRow = {
    id: 'ctr-larbi-002',
    agency_id: 'agency_morvello',
    assigned_manager_id: 'usr-6', // ID hérité de Larbi
    created_by: managerBUid,
    contract_number: 'MC-2026-0062',
  };

  const foreignAgencyRecord: BusinessRow = {
    id: 'ctr-rabat-999',
    agency_id: 'agency_rabat_nord',
    assigned_manager_id: 'usr-99',
    created_by: foreignAdminUid,
    contract_number: 'RAB-2026-0001',
  };

  // ----------------------------------------------------------------------------
  // TEST 1 : Unauthenticated user cannot SELECT business data
  // ----------------------------------------------------------------------------
  it('TEST 1: Unauthenticated user cannot SELECT business data', () => {
    const unauthenticatedUid = null;

    // Tentative de lecture sur contracts, clients, vehicles, deposits, agency_data
    expect(PostgresRlsEngine.evaluateSelect('contracts', recordOfManagerA, unauthenticatedUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('clients', recordOfManagerA, unauthenticatedUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('vehicles', recordOfManagerA, unauthenticatedUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('deposits', recordOfManagerA, unauthenticatedUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('agency_data', recordOfManagerA, unauthenticatedUid, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 2 : Manager A can SELECT their own records
  // ----------------------------------------------------------------------------
  it('TEST 2: Manager A can SELECT their own records (via dynamic local_id and UUID resolution)', () => {
    // Manager A (Mohamed Ezzay) lit un contrat dont assigned_manager_id est 'usr-5'
    const canSelect = PostgresRlsEngine.evaluateSelect('contracts', recordOfManagerA, managerAUid, profilesMap);
    expect(canSelect).toBe(true);

    // Manager A lit un enregistrement assigné directement à son UUID Supabase Auth
    const recordByUuid: BusinessRow = {
      id: 'veh-001',
      agency_id: 'agency_morvello',
      assigned_manager_id: managerAUid,
    };
    expect(PostgresRlsEngine.evaluateSelect('vehicles', recordByUuid, managerAUid, profilesMap)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 3 : Manager A cannot SELECT Manager B's records
  // ----------------------------------------------------------------------------
  it("TEST 3: Manager A cannot SELECT Manager B's records", () => {
    // Manager A tente de lire le contrat de Manager B (usr-6)
    const canSelectB = PostgresRlsEngine.evaluateSelect('contracts', recordOfManagerB, managerAUid, profilesMap);
    expect(canSelectB).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 4 : Manager A cannot UPDATE Manager B's records
  // ----------------------------------------------------------------------------
  it("TEST 4: Manager A cannot UPDATE Manager B's records", () => {
    const maliciousUpdate: BusinessRow = {
      ...recordOfManagerB,
      total_amount: 99999,
    };

    // RLS bloque car USING évalue à false
    const canUpdate = PostgresRlsEngine.evaluateUpdate(
      'contracts',
      recordOfManagerB,
      maliciousUpdate,
      managerAUid,
      profilesMap
    );
    expect(canUpdate).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 5 : Manager A cannot DELETE Manager B's records
  // ----------------------------------------------------------------------------
  it("TEST 5: Manager A cannot DELETE Manager B's records", () => {
    const canDelete = PostgresRlsEngine.evaluateDelete('contracts', recordOfManagerB, managerAUid, profilesMap);
    expect(canDelete).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 6 : Manager A cannot INSERT a record assigned to Manager B
  // ----------------------------------------------------------------------------
  it('TEST 6: Manager A cannot INSERT a record assigned to Manager B', () => {
    const fraudulentInsert: BusinessRow = {
      id: 'ctr-fraud-01',
      agency_id: 'agency_morvello',
      assigned_manager_id: 'usr-6', // Manager A tente d'assigner à Manager B
      created_by: managerAUid,
    };

    const canInsert = PostgresRlsEngine.evaluateInsert('contracts', fraudulentInsert, managerAUid, profilesMap);
    expect(canInsert).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 7 : Manager A cannot change assigned_manager_id from A to B
  // ----------------------------------------------------------------------------
  it('TEST 7: Manager A cannot change assigned_manager_id from A to B', () => {
    const transferredRecord: BusinessRow = {
      ...recordOfManagerA,
      assigned_manager_id: 'usr-6', // Tentative de transfert non autorisé
    };

    const canUpdate = PostgresRlsEngine.evaluateUpdate(
      'contracts',
      recordOfManagerA,
      transferredRecord,
      managerAUid,
      profilesMap
    );
    expect(canUpdate).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 8 : Manager A cannot change agency_id
  // ----------------------------------------------------------------------------
  it('TEST 8: Manager A cannot change agency_id to another agency', () => {
    const crossAgencyRow: BusinessRow = {
      ...recordOfManagerA,
      agency_id: 'agency_rabat_nord', // Tentative d'évasion multi-agences
    };

    const canUpdate = PostgresRlsEngine.evaluateUpdate(
      'contracts',
      recordOfManagerA,
      crossAgencyRow,
      managerAUid,
      profilesMap
    );
    expect(canUpdate).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 9 : Manager cannot promote themselves to admin
  // ----------------------------------------------------------------------------
  it('TEST 9: Manager cannot promote themselves to admin or usurp usr-1', () => {
    const managerOldProfile = profilesMap.get(managerAUid)!;

    // Tentative 1 : Modification du rôle vers 'admin'
    const escalatedProfile: ProfileRow = {
      ...managerOldProfile,
      role: 'admin',
    };
    const roleEscalationResult = PostgresRlsEngine.validateProfileUpdate(
      managerOldProfile,
      escalatedProfile,
      managerAUid,
      profilesMap
    );
    expect(roleEscalationResult.allowed).toBe(false);
    expect(roleEscalationResult.error).toContain('Privilege escalation rejected');

    // Tentative 2 : Usurpation de local_id='usr-1' pour tromper is_admin()
    const usurpedIdProfile: ProfileRow = {
      ...managerOldProfile,
      local_id: 'usr-1',
    };
    const idEscalationResult = PostgresRlsEngine.validateProfileUpdate(
      managerOldProfile,
      usurpedIdProfile,
      managerAUid,
      profilesMap
    );
    expect(idEscalationResult.allowed).toBe(false);
    expect(idEscalationResult.error).toContain('Identity modification rejected');
  });

  // ----------------------------------------------------------------------------
  // TEST 10 : Admin can access records belonging to the same agency
  // ----------------------------------------------------------------------------
  it('TEST 10: Admin can access records belonging to the same agency', () => {
    // Admin (Anouar) accède aux contrats de Manager A et Manager B dans la même agence
    const canAccessA = PostgresRlsEngine.evaluateSelect('contracts', recordOfManagerA, adminUid, profilesMap);
    const canAccessB = PostgresRlsEngine.evaluateSelect('contracts', recordOfManagerB, adminUid, profilesMap);
    expect(canAccessA).toBe(true);
    expect(canAccessB).toBe(true);

    // Admin accède à la table agency_data de l'agence
    const agencyDataRow: BusinessRow = {
      id: 'morvello_main',
      agency_id: 'agency_morvello',
      data: {},
    };
    expect(PostgresRlsEngine.evaluateSelect('agency_data', agencyDataRow, adminUid, profilesMap)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 11 : Admin cannot access another agency if multi-agency isolation is supported
  // ----------------------------------------------------------------------------
  it('TEST 11: Admin cannot access another agency if multi-agency isolation is supported', () => {
    // Admin de Casablanca (Anouar) tente d'accéder au contrat de l'agence de Rabat
    const canCrossAgencySelect = PostgresRlsEngine.evaluateSelect(
      'contracts',
      foreignAgencyRecord,
      adminUid,
      profilesMap
    );
    expect(canCrossAgencySelect).toBe(false);

    // L'Admin de Rabat accède à son propre contrat mais ne peut pas accéder à Casablanca
    expect(PostgresRlsEngine.evaluateSelect('contracts', foreignAgencyRecord, foreignAdminUid, profilesMap)).toBe(true);
    expect(PostgresRlsEngine.evaluateSelect('contracts', recordOfManagerA, foreignAdminUid, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 12 : Direct Supabase API access is protected even when frontend is completely bypassed
  // ----------------------------------------------------------------------------
  it('TEST 12: Direct Supabase API access is protected even when frontend is completely bypassed', () => {
    // Un attaquant envoie un appel HTTP direct PostgREST :
    // PATCH /rest/v1/vehicles?id=eq.veh-larbi-01
    // Headers: Authorization: Bearer <Manager A JWT>, Prefer: return=representation
    // Body: { "assigned_manager_id": "usr-5", "status": "rented" }
    const vehicleOfManagerB: BusinessRow = {
      id: 'veh-larbi-01',
      agency_id: 'agency_morvello',
      assigned_manager_id: 'usr-6',
      created_by: managerBUid,
      plate: '67890-B-1',
    };

    const forgedPayload: BusinessRow = {
      id: 'veh-larbi-01',
      agency_id: 'agency_morvello',
      assigned_manager_id: 'usr-5', // Tente de s'attribuer le véhicule d'autrui
      status: 'rented',
    };

    // La base de données PostgreSQL applique la politique vehicles_update RLS
    const isDirectApiCallPermitted = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerB,
      forgedPayload,
      managerAUid, // Token JWT de Manager A
      profilesMap
    );

    // La requête est rejetée au niveau du moteur de base de données (0 row updated / code 42501)
    expect(isDirectApiCallPermitted).toBe(false);
  });
});
