import { describe, it, expect } from 'vitest';
import { PostgresRlsEngine, ProfileRow, BusinessRow } from './supabaseRlsSecurity.test';

describe('MORVELLO CARS — Public Profiles RLS & RBAC Security Suite (Problem #4)', () => {
  // Profils de test
  const adminUid = '550e8400-e29b-41d4-a716-446655440001'; // Anouar (usr-1)
  const managerAUid = '550e8400-e29b-41d4-a716-446655440005'; // Mohamed Ezzay (usr-5)
  const managerBUid = '550e8400-e29b-41d4-a716-446655440006'; // Larbi Khomri (usr-6)
  const foreignAdminUid = '550e8400-e29b-41d4-a716-446655440099'; // Admin autre agence (Rabat)
  const foreignManagerUid = '550e8400-e29b-41d4-a716-446655440098'; // Manager autre agence

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
        permissions: { all: true },
      },
    ],
    [
      managerAUid,
      {
        id: managerAUid,
        email: 'ezzay.location@gmail.com',
        name: 'Mohamed Ezzay',
        role: 'manager',
        agency_id: 'agency_morvello',
        local_id: 'usr-5',
        legacy_id: 'usr-5',
        permissions: { canCreateContracts: true },
      },
    ],
    [
      managerBUid,
      {
        id: managerBUid,
        email: 'larbi.khomri@gmail.com',
        name: 'Larbi Khomri',
        role: 'manager',
        agency_id: 'agency_morvello',
        local_id: 'usr-6',
        legacy_id: 'usr-6',
        permissions: { canCreateContracts: true },
      },
    ],
    [
      foreignAdminUid,
      {
        id: foreignAdminUid,
        email: 'admin.rabat@morvellocars.com',
        name: 'Admin Rabat',
        role: 'admin',
        agency_id: 'agency_rabat',
        local_id: 'usr-99',
        legacy_id: 'usr-99',
        permissions: { all: true },
      },
    ],
    [
      foreignManagerUid,
      {
        id: foreignManagerUid,
        email: 'manager.rabat@morvellocars.com',
        name: 'Manager Rabat',
        role: 'manager',
        agency_id: 'agency_rabat',
        local_id: 'usr-98',
        legacy_id: 'usr-98',
        permissions: { canCreateContracts: true },
      },
    ],
  ]);

  const profileAdmin = profilesMap.get(adminUid)!;
  const profileManagerA = profilesMap.get(managerAUid)!;
  const profileManagerB = profilesMap.get(managerBUid)!;
  const profileForeignAdmin = profilesMap.get(foreignAdminUid)!;
  const profileForeignManager = profilesMap.get(foreignManagerUid)!;

  // ============================================================================
  // 1. UTILISATEURS NON-AUTHENTIFIÉS (ANONYMES)
  // ============================================================================
  describe('1. Unauthenticated (Anonymous) User Isolation', () => {
    it('rejects SELECT on public.profiles for anonymous caller', () => {
      expect(PostgresRlsEngine.evaluateSelect('profiles', profileAdmin, null, profilesMap)).toBe(false);
      expect(PostgresRlsEngine.evaluateSelect('profiles', profileManagerA, null, profilesMap)).toBe(false);
      expect(PostgresRlsEngine.evaluateSelect('profiles', profileManagerB, null, profilesMap)).toBe(false);
    });

    it('rejects SELECT on public.safe_profiles for anonymous caller', () => {
      expect(PostgresRlsEngine.evaluateSelect('safe_profiles', profileAdmin, null, profilesMap)).toBe(false);
      expect(PostgresRlsEngine.evaluateSelect('safe_profiles', profileManagerA, null, profilesMap)).toBe(false);
    });

    it('rejects INSERT on public.profiles for anonymous caller', () => {
      const newProfile: BusinessRow = {
        id: 'anon-001',
        email: 'anon@test.com',
        name: 'Hacker',
        role: 'agent',
        agency_id: 'agency_morvello',
      };
      expect(PostgresRlsEngine.evaluateInsert('profiles', newProfile, null, profilesMap)).toBe(false);
    });

    it('rejects UPDATE on public.profiles for anonymous caller', () => {
      expect(
        PostgresRlsEngine.evaluateUpdate('profiles', profileManagerA, profileManagerA, null, profilesMap)
      ).toBe(false);
    });

    it('rejects DELETE on public.profiles for anonymous caller', () => {
      expect(PostgresRlsEngine.evaluateDelete('profiles', profileManagerA, null, profilesMap)).toBe(false);
    });
  });

  // ============================================================================
  // 2. GESTIONNAIRES (MANAGERS) — SÉLECTIVITÉ STRICTE ET CLOISONNEMENT
  // ============================================================================
  describe('2. Manager Operational Scope & Isolation on public.profiles', () => {
    it('allows Manager A to SELECT their own sensitive profile', () => {
      const canSelectOwn = PostgresRlsEngine.evaluateSelect('profiles', profileManagerA, managerAUid, profilesMap);
      expect(canSelectOwn).toBe(true);
    });

    it('blocks Manager A from SELECTING Manager B profile on public.profiles', () => {
      const canSelectB = PostgresRlsEngine.evaluateSelect('profiles', profileManagerB, managerAUid, profilesMap);
      expect(canSelectB).toBe(false);
    });

    it('blocks Manager A from SELECTING Admin profile on public.profiles', () => {
      const canSelectAdmin = PostgresRlsEngine.evaluateSelect('profiles', profileAdmin, managerAUid, profilesMap);
      expect(canSelectAdmin).toBe(false);
    });

    it('blocks Manager A from SELECTING any profile from a foreign agency', () => {
      const canSelectForeignMgr = PostgresRlsEngine.evaluateSelect(
        'profiles',
        profileForeignManager,
        managerAUid,
        profilesMap
      );
      expect(canSelectForeignMgr).toBe(false);

      const canSelectForeignAdmin = PostgresRlsEngine.evaluateSelect(
        'profiles',
        profileForeignAdmin,
        managerAUid,
        profilesMap
      );
      expect(canSelectForeignAdmin).toBe(false);
    });

    it('allows Manager A to read colleagues in the SAME agency via public.safe_profiles', () => {
      const safeRowB: BusinessRow = {
        id: managerBUid,
        name: 'Larbi Khomri',
        email: 'larbi.khomri@gmail.com',
        agency_id: 'agency_morvello',
      };
      expect(PostgresRlsEngine.evaluateSelect('safe_profiles', safeRowB, managerAUid, profilesMap)).toBe(true);
    });

    it('blocks Manager A from reading safe_profiles of a FOREIGN agency', () => {
      const foreignSafeRow: BusinessRow = {
        id: foreignManagerUid,
        name: 'Manager Rabat',
        email: 'manager.rabat@morvellocars.com',
        agency_id: 'agency_rabat',
      };
      expect(
        PostgresRlsEngine.evaluateSelect('safe_profiles', foreignSafeRow, managerAUid, profilesMap)
      ).toBe(false);
    });
  });

  // ============================================================================
  // 3. PRÉVENTION DES ATTAQUES D'ÉLÉVATION DE PRIVILÈGES & USURPATION
  // ============================================================================
  describe('3. Privilege Escalation & Modification Protection', () => {
    it('blocks Manager A from promoting themselves to admin (role escalation)', () => {
      const escalatedProfile: ProfileRow = {
        ...profileManagerA,
        role: 'admin',
      };

      // 1. Validation au niveau du Trigger PostgreSQL
      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileManagerA,
        escalatedProfile,
        managerAUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(false);
      expect(triggerResult.error).toContain('Privilege escalation rejected');

      // 2. Validation au niveau de la Policy RLS UPDATE
      const rlsResult = PostgresRlsEngine.evaluateUpdate(
        'profiles',
        profileManagerA,
        escalatedProfile,
        managerAUid,
        profilesMap
      );
      expect(rlsResult).toBe(false);
    });

    it('blocks Manager A from altering their permissions JSONB', () => {
      const maliciousPermissionsProfile: ProfileRow = {
        ...profileManagerA,
        permissions: { all: true, superuser: true },
      };

      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileManagerA,
        maliciousPermissionsProfile,
        managerAUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(false);
      expect(triggerResult.error).toContain('Privilege escalation rejected: cannot alter permissions');

      expect(
        PostgresRlsEngine.evaluateUpdate(
          'profiles',
          profileManagerA,
          maliciousPermissionsProfile,
          managerAUid,
          profilesMap
        )
      ).toBe(false);
    });

    it('blocks Manager A from altering their agency_id', () => {
      const maliciousAgencyProfile: ProfileRow = {
        ...profileManagerA,
        agency_id: 'agency_rabat',
      };

      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileManagerA,
        maliciousAgencyProfile,
        managerAUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(false);
      expect(triggerResult.error).toContain('Agency modification rejected');

      expect(
        PostgresRlsEngine.evaluateUpdate(
          'profiles',
          profileManagerA,
          maliciousAgencyProfile,
          managerAUid,
          profilesMap
        )
      ).toBe(false);
    });

    it('blocks Manager A from modifying local_id or legacy_id', () => {
      const stolenIdProfile: ProfileRow = {
        ...profileManagerA,
        local_id: 'usr-6', // Tente d'usurper le manager B
      };

      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileManagerA,
        stolenIdProfile,
        managerAUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(false);
      expect(triggerResult.error).toContain('Identity modification rejected');

      expect(
        PostgresRlsEngine.evaluateUpdate(
          'profiles',
          profileManagerA,
          stolenIdProfile,
          managerAUid,
          profilesMap
        )
      ).toBe(false);
    });

    it('blocks Manager A from claiming the root admin identity usr-1', () => {
      const usurpedUsr1Profile: ProfileRow = {
        ...profileManagerA,
        local_id: 'usr-1',
      };

      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileManagerA,
        usurpedUsr1Profile,
        managerAUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(false);
      expect(triggerResult.error).toContain('Identity modification rejected');
    });

    it('blocks Manager A from modifying Manager B profile', () => {
      const maliciousUpdateB: BusinessRow = {
        ...profileManagerB,
        name: 'Compromised by Manager A',
      };

      const canUpdateB = PostgresRlsEngine.evaluateUpdate(
        'profiles',
        profileManagerB,
        maliciousUpdateB,
        managerAUid,
        profilesMap
      );
      expect(canUpdateB).toBe(false);
    });

    it('allows Manager A to update their legitimate non-sensitive personal info (name, phone)', () => {
      const legitimateUpdate: ProfileRow = {
        ...profileManagerA,
        name: 'Mohamed Ezzay Updated',
        // Rôle, agence, permissions, local_id et legacy_id inchangés
      };

      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileManagerA,
        legitimateUpdate,
        managerAUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(true);

      const rlsResult = PostgresRlsEngine.evaluateUpdate(
        'profiles',
        profileManagerA,
        legitimateUpdate,
        managerAUid,
        profilesMap
      );
      expect(rlsResult).toBe(true);
    });

    it('blocks Manager A from inserting an admin profile', () => {
      const forgedAdminInsert: BusinessRow = {
        id: managerAUid,
        email: 'newadmin@morvellocars.com',
        name: 'Forged Admin',
        role: 'admin',
        agency_id: 'agency_morvello',
      };

      expect(
        PostgresRlsEngine.evaluateInsert('profiles', forgedAdminInsert, managerAUid, profilesMap)
      ).toBe(false);
    });

    it('blocks Manager A from inserting a profile with an ID other than their own', () => {
      const forgedOtherUserInsert: BusinessRow = {
        id: 'some-other-uuid',
        email: 'other@morvellocars.com',
        name: 'Other Person',
        role: 'manager',
        agency_id: 'agency_morvello',
      };

      expect(
        PostgresRlsEngine.evaluateInsert('profiles', forgedOtherUserInsert, managerAUid, profilesMap)
      ).toBe(false);
    });

    it('blocks Manager A from deleting any profile (including their own)', () => {
      // Tente de supprimer le profil de Manager B
      expect(PostgresRlsEngine.evaluateDelete('profiles', profileManagerB, managerAUid, profilesMap)).toBe(false);

      // Tente de supprimer son propre profil (action réservée aux administrateurs)
      expect(PostgresRlsEngine.evaluateDelete('profiles', profileManagerA, managerAUid, profilesMap)).toBe(false);
    });
  });

  // ============================================================================
  // 4. DROITS D'ADMINISTRATION DE L'AGENCE (GÉRANT / ADMIN)
  // ============================================================================
  describe('4. Agency Administrator Capabilities & Security Bounds', () => {
    it('allows Admin to SELECT all profiles within their agency', () => {
      expect(PostgresRlsEngine.evaluateSelect('profiles', profileAdmin, adminUid, profilesMap)).toBe(true);
      expect(PostgresRlsEngine.evaluateSelect('profiles', profileManagerA, adminUid, profilesMap)).toBe(true);
      expect(PostgresRlsEngine.evaluateSelect('profiles', profileManagerB, adminUid, profilesMap)).toBe(true);
    });

    it('blocks Admin from SELECTING profiles in another agency', () => {
      expect(
        PostgresRlsEngine.evaluateSelect('profiles', profileForeignAdmin, adminUid, profilesMap)
      ).toBe(false);
      expect(
        PostgresRlsEngine.evaluateSelect('profiles', profileForeignManager, adminUid, profilesMap)
      ).toBe(false);
    });

    it('allows Admin to UPDATE profiles within their agency (role, permissions)', () => {
      const updatedManagerA: ProfileRow = {
        ...profileManagerA,
        name: 'Mohamed Ezzay Promoted',
        permissions: { canCreateContracts: true, canApproveVehicles: true },
      };

      expect(
        PostgresRlsEngine.evaluateUpdate('profiles', profileManagerA, updatedManagerA, adminUid, profilesMap)
      ).toBe(true);
    });

    it('blocks Admin from UPDATING profiles in another agency', () => {
      const maliciousForeignUpdate: ProfileRow = {
        ...profileForeignManager,
        name: 'Hijacked by Foreign Admin',
      };

      expect(
        PostgresRlsEngine.evaluateUpdate(
          'profiles',
          profileForeignManager,
          maliciousForeignUpdate,
          adminUid,
          profilesMap
        )
      ).toBe(false);
    });

    it('allows Admin to DELETE profiles within their agency', () => {
      expect(PostgresRlsEngine.evaluateDelete('profiles', profileManagerB, adminUid, profilesMap)).toBe(true);
    });

    it('blocks Admin from deleting the root administrator usr-1', () => {
      expect(PostgresRlsEngine.evaluateDelete('profiles', profileAdmin, adminUid, profilesMap)).toBe(false);
    });

    it('blocks anyone (including admins) from demoting root admin usr-1', () => {
      const demotedRootAdmin: ProfileRow = {
        ...profileAdmin,
        role: 'manager',
      };

      const triggerResult = PostgresRlsEngine.validateProfileUpdate(
        profileAdmin,
        demotedRootAdmin,
        adminUid,
        profilesMap
      );
      expect(triggerResult.allowed).toBe(false);
      expect(triggerResult.error).toContain('primary administrator usr-1 cannot be demoted');
    });
  });
});
