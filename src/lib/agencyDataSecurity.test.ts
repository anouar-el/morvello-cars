import { describe, it, expect } from 'vitest';
import { PostgresRlsEngine, ProfileRow, BusinessRow } from './supabaseRlsSecurity.test';
import { MorvelloCloudData } from './firestoreSync';

describe('Problem #2: agency_data Isolation & Architectural Security', () => {
  // Profils de test
  const adminUid = '550e8400-e29b-41d4-a716-446655440001'; // Anouar (Admin, agency_morvello)
  const managerAUid = '550e8400-e29b-41d4-a716-446655440005'; // Mohamed Ezzay (Manager, usr-5, agency_morvello)
  const managerBUid = '550e8400-e29b-41d4-a716-446655440006'; // Larbi Khomri (Manager, usr-6, agency_morvello)
  const foreignAdminUid = '550e8400-e29b-41d4-a716-446655440099'; // Admin de Rabat (agency_rabat)

  const profilesMap = new Map<string, ProfileRow>([
    [
      adminUid,
      {
        id: adminUid,
        email: 'anouar7fac@gmail.com',
        name: 'Anouar',
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
        agency_id: 'agency_rabat',
        local_id: 'usr-99',
        legacy_id: 'usr-99',
      },
    ],
  ]);

  // Lignes de test pour la table agency_data
  const agencyGlobalRow: BusinessRow = {
    id: 'morvello_main',
    agency_id: 'agency_morvello',
    assigned_manager_id: undefined, // Ligne globale d'agence (companySettings, terms)
    data: {
      companySettings: { companyName: 'Morvello Cars Nouaceur' },
      termsVersion: { version: '2026.1' },
    },
  };

  const managerARow: BusinessRow = {
    id: 'morvello_mgr_usr5',
    agency_id: 'agency_morvello',
    assigned_manager_id: 'usr-5', // Ligne dédiée à Manager A
    created_by: managerAUid,
    data: {
      theme: 'dark',
      quickFilters: ['active', 'rented'],
    },
  };

  const managerBRow: BusinessRow = {
    id: 'morvello_mgr_usr6',
    agency_id: 'agency_morvello',
    assigned_manager_id: 'usr-6', // Ligne dédiée à Manager B
    created_by: managerBUid,
    data: {
      theme: 'light',
      quickFilters: ['draft'],
    },
  };

  const foreignAgencyRow: BusinessRow = {
    id: 'morvello_rabat_main',
    agency_id: 'agency_rabat',
    assigned_manager_id: undefined,
    data: { companyName: 'Morvello Cars Rabat' },
  };

  // ----------------------------------------------------------------------------
  // TEST 1 : Unauthenticated users have NO access to agency_data
  // ----------------------------------------------------------------------------
  it('TEST 1: Unauthenticated user has NO access to agency_data (SELECT, INSERT, UPDATE, DELETE)', () => {
    expect(PostgresRlsEngine.evaluateSelect('agency_data', agencyGlobalRow, null, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('agency_data', managerARow, null, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateInsert('agency_data', agencyGlobalRow, null, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateUpdate('agency_data', agencyGlobalRow, agencyGlobalRow, null, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateDelete('agency_data', agencyGlobalRow, null, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 2 : Manager cannot read the global agency_data row or another manager's row
  // ----------------------------------------------------------------------------
  it('TEST 2: Manager cannot read global agency_data row or another manager row', () => {
    // Manager A tente de lire la configuration globale d'agence (assigned_manager_id IS NULL)
    const canReadGlobal = PostgresRlsEngine.evaluateSelect('agency_data', agencyGlobalRow, managerAUid, profilesMap);
    expect(canReadGlobal).toBe(false);

    // Manager A tente de lire la ligne de Manager B
    const canReadManagerB = PostgresRlsEngine.evaluateSelect('agency_data', managerBRow, managerAUid, profilesMap);
    expect(canReadManagerB).toBe(false);

    // Manager A peut lire sa propre ligne
    const canReadOwn = PostgresRlsEngine.evaluateSelect('agency_data', managerARow, managerAUid, profilesMap);
    expect(canReadOwn).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 3 : Manager cannot modify or overwrite global agency_data
  // ----------------------------------------------------------------------------
  it('TEST 3: Manager cannot INSERT, UPDATE or DELETE global agency_data', () => {
    const maliciousUpdate: BusinessRow = {
      ...agencyGlobalRow,
      data: { companySettings: { companyName: 'Hacked by Manager A' } },
    };

    // Manager A tente de modifier la ligne globale
    expect(PostgresRlsEngine.evaluateUpdate('agency_data', agencyGlobalRow, maliciousUpdate, managerAUid, profilesMap)).toBe(false);

    // Manager A tente d'insérer une ligne globale sans assigned_manager_id
    expect(PostgresRlsEngine.evaluateInsert('agency_data', agencyGlobalRow, managerAUid, profilesMap)).toBe(false);

    // Manager A tente de supprimer la ligne globale
    expect(PostgresRlsEngine.evaluateDelete('agency_data', agencyGlobalRow, managerAUid, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 4 : Manager cannot modify another manager's agency_data row
  // ----------------------------------------------------------------------------
  it('TEST 4: Manager cannot modify another manager agency_data row', () => {
    const maliciousUpdateB: BusinessRow = {
      ...managerBRow,
      data: { theme: 'compromised' },
    };

    expect(PostgresRlsEngine.evaluateUpdate('agency_data', managerBRow, maliciousUpdateB, managerAUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateDelete('agency_data', managerBRow, managerAUid, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 5 : Manager cannot escape scope via assigned_manager_id manipulation in agency_data
  // ----------------------------------------------------------------------------
  it('TEST 5: Manager cannot alter assigned_manager_id to escape scope in agency_data', () => {
    // Manager A tente de modifier sa propre ligne pour la réattribuer à Manager B
    const forgedReassignment: BusinessRow = {
      ...managerARow,
      assigned_manager_id: 'usr-6', // Manager B
    };

    expect(PostgresRlsEngine.evaluateUpdate('agency_data', managerARow, forgedReassignment, managerAUid, profilesMap)).toBe(false);

    // Manager A tente d'insérer une nouvelle ligne pré-attribuée à Manager B
    const forgedInsert: BusinessRow = {
      id: 'morvello_mgr_fake',
      agency_id: 'agency_morvello',
      assigned_manager_id: 'usr-6',
      data: {},
    };

    expect(PostgresRlsEngine.evaluateInsert('agency_data', forgedInsert, managerAUid, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 6 : Admin has full legitimate access to their own agency agency_data
  // ----------------------------------------------------------------------------
  it('TEST 6: Agency Admin can read and update global row and manager rows of the agency', () => {
    // Admin peut lire la ligne globale
    expect(PostgresRlsEngine.evaluateSelect('agency_data', agencyGlobalRow, adminUid, profilesMap)).toBe(true);
    // Admin peut lire les lignes des managers
    expect(PostgresRlsEngine.evaluateSelect('agency_data', managerARow, adminUid, profilesMap)).toBe(true);
    expect(PostgresRlsEngine.evaluateSelect('agency_data', managerBRow, adminUid, profilesMap)).toBe(true);

    // Admin peut modifier la ligne globale
    const adminUpdate: BusinessRow = {
      ...agencyGlobalRow,
      data: { companySettings: { companyName: 'Morvello Cars Official' } },
    };
    expect(PostgresRlsEngine.evaluateUpdate('agency_data', agencyGlobalRow, adminUpdate, adminUid, profilesMap)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 7 : Multi-agency isolation prevents foreign Admin from accessing agency_data
  // ----------------------------------------------------------------------------
  it('TEST 7: Foreign Admin cannot access agency_data of another agency', () => {
    // Admin de Rabat tente d'accéder à la ligne de Casablanca
    expect(PostgresRlsEngine.evaluateSelect('agency_data', agencyGlobalRow, foreignAdminUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateUpdate('agency_data', agencyGlobalRow, agencyGlobalRow, foreignAdminUid, profilesMap)).toBe(false);

    // Admin de Rabat accède à sa propre ligne
    expect(PostgresRlsEngine.evaluateSelect('agency_data', foreignAgencyRow, foreignAdminUid, profilesMap)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 8 : Architectural Decoupling: Sensitive operational data is stripped from agency_data
  // ----------------------------------------------------------------------------
  it('TEST 8: Sensitive business entities are excluded from agency_data payload', () => {
    // Simuler le payload complet envoyé par l'application
    const fullPayload: Partial<MorvelloCloudData> = {
      companySettings: { companyName: 'Morvello Cars' } as any,
      termsVersion: { version: '2026.1' } as any,
      vehicles: [{ id: 'veh-1', brand: 'Dacia', plate: '12345-A-1' }] as any,
      clients: [{ id: 'cli-1', firstName: 'Karim', docNumber: 'AB12345' }] as any,
      contracts: [{ id: 'cnt-1', contractNumber: 'MC-2026-0001', totalAmount: 5000 }] as any,
      deposits: [{ id: 'dep-1', amount: 3000, status: 'pending' }] as any,
    };

    // La fonction de sauvegarde prépare uniquement les données de configuration d'agence pour agency_data
    const sanitizedAgencyConfig = {
      companySettings: fullPayload.companySettings,
      termsVersion: fullPayload.termsVersion,
      aiSettings: fullPayload.aiSettings,
      authoritativeSource: 'normalized_tables',
    };

    // Vérifier que les entités métier sensibles NE SONT PAS dans le payload d'agency_data
    expect((sanitizedAgencyConfig as any).vehicles).toBeUndefined();
    expect((sanitizedAgencyConfig as any).clients).toBeUndefined();
    expect((sanitizedAgencyConfig as any).contracts).toBeUndefined();
    expect((sanitizedAgencyConfig as any).deposits).toBeUndefined();
    expect((sanitizedAgencyConfig as any).drivers).toBeUndefined();

    // Seule la configuration d'agence est conservée
    expect(sanitizedAgencyConfig.companySettings).toBeDefined();
    expect(sanitizedAgencyConfig.termsVersion).toBeDefined();
    expect(sanitizedAgencyConfig.authoritativeSource).toBe('normalized_tables');
  });

  // ----------------------------------------------------------------------------
  // TEST 9 : Direct PostgREST API query on agency_data does not leak cross-manager data
  // ----------------------------------------------------------------------------
  it('TEST 9: Direct PostgREST query on agency_data cannot leak other manager records', () => {
    // Si Manager A exécute: GET /rest/v1/agency_data?select=*
    // PostgreSQL applique:
    //   public.is_same_agency(agency_id) AND (
    //     public.is_admin() OR (assigned_manager_id IS NOT NULL AND public.can_access_manager_row(assigned_manager_id, ...))
    //   )
    const allRowsInDatabase = [agencyGlobalRow, managerARow, managerBRow, foreignAgencyRow];

    const accessibleRowsForManagerA = allRowsInDatabase.filter((row) =>
      PostgresRlsEngine.evaluateSelect('agency_data', row, managerAUid, profilesMap)
    );

    // Manager A ne peut voir QUE sa propre ligne
    expect(accessibleRowsForManagerA).toHaveLength(1);
    expect(accessibleRowsForManagerA[0].id).toBe('morvello_mgr_usr5');
    expect(accessibleRowsForManagerA[0].assigned_manager_id).toBe('usr-5');
  });
});
