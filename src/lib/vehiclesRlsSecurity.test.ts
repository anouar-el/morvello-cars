import { describe, it, expect } from 'vitest';
import { PostgresRlsEngine, ProfileRow, BusinessRow } from './supabaseRlsSecurity.test';

describe('Problem #3: Comprehensive Row Level Security (RLS) for public.vehicles (16 Tests)', () => {
  // Profils utilisateurs
  const adminUid = '550e8400-e29b-41d4-a716-446655440001'; // Anouar (Admin, agency_morvello)
  const managerAUid = '550e8400-e29b-41d4-a716-446655440005'; // Mohamed Ezzay (Manager, usr-5, agency_morvello)
  const managerBUid = '550e8400-e29b-41d4-a716-446655440006'; // Larbi Khomri (Manager, usr-6, agency_morvello)
  const foreignAdminUid = '550e8400-e29b-41d4-a716-446655440099'; // Admin Rabat (agency_rabat)
  const foreignManagerUid = '550e8400-e29b-41d4-a716-446655440098'; // Manager Rabat (agency_rabat)

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
      },
    ],
  ]);

  // Véhicules de test
  const vehicleOfManagerA: BusinessRow = {
    id: 'veh-ezzay-01',
    brand: 'Dacia',
    model: 'Logan',
    plate: '12345-A-1',
    agency_id: 'agency_morvello',
    assigned_manager_id: 'usr-5',
    created_by: managerAUid,
    status: 'available',
    current_km: 45000,
    daily_rate: 350,
    data: {
      purchasePrice: 140000,
      internalNotes: 'Révision des 40 000 km effectuée',
      gpsDeviceId: 'GPS-LOGAN-001',
      insurancePolicy: 'AXA-99283-A',
    },
  };

  const vehicleOfManagerB: BusinessRow = {
    id: 'veh-larbi-01',
    brand: 'Renault',
    model: 'Clio 5',
    plate: '67890-B-1',
    agency_id: 'agency_morvello',
    assigned_manager_id: 'usr-6',
    created_by: managerBUid,
    status: 'available',
    current_km: 28000,
    daily_rate: 420,
    data: {
      purchasePrice: 195000,
      internalNotes: 'Véhicule premium assigné Larbi',
      gpsDeviceId: 'GPS-CLIO-002',
      insurancePolicy: 'WAFA-77182-B',
    },
  };

  const foreignAgencyVehicle: BusinessRow = {
    id: 'veh-rabat-01',
    brand: 'Peugeot',
    model: '208',
    plate: '33333-C-1',
    agency_id: 'agency_rabat',
    assigned_manager_id: 'usr-98',
    created_by: foreignManagerUid,
    status: 'available',
    data: { purchasePrice: 175000 },
  };

  // Contrats liés pour les tests d'intégrité contractuelle
  const activeContracts = [
    {
      id: 'cnt-active-01',
      contractNumber: 'MC-2026-0001',
      vehicle_id: 'veh-ezzay-01',
      status: 'active',
    },
    {
      id: 'cnt-completed-02',
      contractNumber: 'MC-2026-0002',
      vehicle_id: 'veh-larbi-01',
      status: 'completed', // Clôturé
    },
  ];

  // Simulation du trigger PostgreSQL public.protect_vehicle_deletion_contracts()
  function simulateVehicleDeleteWithContractTrigger(
    vehicle: BusinessRow,
    callerUid: string | null,
    contracts: typeof activeContracts
  ): { permitted: boolean; error?: string } {
    // 1. Évaluation de la politique RLS "vehicles_delete"
    const rlsPermitted = PostgresRlsEngine.evaluateDelete('vehicles', vehicle, callerUid, profilesMap);
    if (!rlsPermitted) {
      return { permitted: false, error: 'RLS: 42501 permission denied' };
    }

    // 2. Évaluation du trigger PostgreSQL d'intégrité contractuelle
    const hasActiveContract = contracts.some(
      (c) => c.vehicle_id === vehicle.id && (c.status === 'active' || c.status === 'draft')
    );
    if (hasActiveContract) {
      return {
        permitted: false,
        error: `Suppression interdite : le véhicule "${vehicle.id}" (${vehicle.plate}) est actuellement engagé dans un contrat actif ou en cours.`,
      };
    }

    return { permitted: true };
  }

  // ----------------------------------------------------------------------------
  // TEST 1 : Anonymous user cannot SELECT vehicles
  // ----------------------------------------------------------------------------
  it('TEST 1: Anonymous user cannot SELECT vehicles', () => {
    expect(PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerA, null, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerB, null, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateSelect('vehicles', foreignAgencyVehicle, null, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 2 : Manager A can SELECT their authorized vehicles
  // ----------------------------------------------------------------------------
  it('TEST 2: Manager A can SELECT their authorized vehicles', () => {
    // Manager A accède à son propre véhicule (assigned_manager_id = 'usr-5')
    const canSelectOwn = PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerA, managerAUid, profilesMap);
    expect(canSelectOwn).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 3 : Manager A cannot SELECT Manager B's private vehicles
  // ----------------------------------------------------------------------------
  it("TEST 3: Manager A cannot SELECT Manager B's private vehicles", () => {
    const canSelectB = PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerB, managerAUid, profilesMap);
    expect(canSelectB).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 4 : Manager A cannot SELECT another agency's vehicles
  // ----------------------------------------------------------------------------
  it("TEST 4: Manager A cannot SELECT another agency's vehicles", () => {
    const canSelectForeign = PostgresRlsEngine.evaluateSelect('vehicles', foreignAgencyVehicle, managerAUid, profilesMap);
    expect(canSelectForeign).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 5 : Manager A cannot UPDATE Manager B's vehicle
  // ----------------------------------------------------------------------------
  it("TEST 5: Manager A cannot UPDATE Manager B's vehicle", () => {
    const forgedUpdate: BusinessRow = {
      ...vehicleOfManagerB,
      current_km: 99999,
    };
    const canUpdateB = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerB,
      forgedUpdate,
      managerAUid,
      profilesMap
    );
    expect(canUpdateB).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 6 : Manager A cannot DELETE Manager B's vehicle
  // ----------------------------------------------------------------------------
  it("TEST 6: Manager A cannot DELETE Manager B's vehicle", () => {
    const canDeleteB = PostgresRlsEngine.evaluateDelete('vehicles', vehicleOfManagerB, managerAUid, profilesMap);
    expect(canDeleteB).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 7 : Manager A cannot INSERT a vehicle assigned to Manager B unless explicitly authorized
  // ----------------------------------------------------------------------------
  it('TEST 7: Manager A cannot INSERT a vehicle assigned to Manager B unless explicitly authorized', () => {
    const forgedInsert: BusinessRow = {
      id: 'veh-new-forged',
      brand: 'Hyundai',
      model: 'i20',
      plate: '99999-A-1',
      agency_id: 'agency_morvello',
      assigned_manager_id: 'usr-6', // Attribué à Manager B
      created_by: managerAUid,
      status: 'available',
    };
    const canInsertB = PostgresRlsEngine.evaluateInsert('vehicles', forgedInsert, managerAUid, profilesMap);
    expect(canInsertB).toBe(false);

    // Insertion attribuée à soi-même est autorisée
    const legitimateInsert: BusinessRow = {
      ...forgedInsert,
      assigned_manager_id: 'usr-5',
    };
    const canInsertOwn = PostgresRlsEngine.evaluateInsert('vehicles', legitimateInsert, managerAUid, profilesMap);
    expect(canInsertOwn).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 8 : Manager A cannot INSERT a vehicle belonging to another agency
  // ----------------------------------------------------------------------------
  it('TEST 8: Manager A cannot INSERT a vehicle belonging to another agency', () => {
    const foreignInsert: BusinessRow = {
      id: 'veh-new-foreign',
      brand: 'Dacia',
      model: 'Duster',
      plate: '88888-A-1',
      agency_id: 'agency_rabat', // Autre agence
      assigned_manager_id: 'usr-5',
      created_by: managerAUid,
      status: 'available',
    };
    const canInsertForeign = PostgresRlsEngine.evaluateInsert('vehicles', foreignInsert, managerAUid, profilesMap);
    expect(canInsertForeign).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 9 : Manager A cannot change their vehicle's agency_id to another agency
  // ----------------------------------------------------------------------------
  it("TEST 9: Manager A cannot change their vehicle's agency_id to another agency", () => {
    const agencyHijackUpdate: BusinessRow = {
      ...vehicleOfManagerA,
      agency_id: 'agency_rabat', // Tente de transférer le véhicule à une autre agence
    };
    // Rejeté par la clause WITH CHECK de la policy vehicles_update
    const canHijackAgency = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerA,
      agencyHijackUpdate,
      managerAUid,
      profilesMap
    );
    expect(canHijackAgency).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 10 : Manager A cannot change assigned_manager_id to Manager B to bypass authorization
  // ----------------------------------------------------------------------------
  it('TEST 10: Manager A cannot change assigned_manager_id to Manager B to bypass authorization', () => {
    const managerReassignUpdate: BusinessRow = {
      ...vehicleOfManagerA,
      assigned_manager_id: 'usr-6', // Tente de réassigner à Manager B
    };
    // Rejeté par WITH CHECK car un non-administrateur ne peut pas assigner à un tiers
    const canReassign = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerA,
      managerReassignUpdate,
      managerAUid,
      profilesMap
    );
    expect(canReassign).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 11 : Manager A cannot modify vehicle status of Manager B's vehicle
  // ----------------------------------------------------------------------------
  it("TEST 11: Manager A cannot modify vehicle status of Manager B's vehicle", () => {
    const statusAttack: BusinessRow = {
      ...vehicleOfManagerB,
      status: 'maintenance', // Tente d'immobiliser le véhicule de Manager B
    };
    const canTamperStatus = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerB,
      statusAttack,
      managerAUid,
      profilesMap
    );
    expect(canTamperStatus).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 12 : Manager A cannot modify sensitive vehicle JSONB data belonging to Manager B
  // ----------------------------------------------------------------------------
  it("TEST 12: Manager A cannot modify sensitive vehicle JSONB data belonging to Manager B", () => {
    const jsonbAttack: BusinessRow = {
      ...vehicleOfManagerB,
      data: {
        ...vehicleOfManagerB.data,
        purchasePrice: 0,
        gpsDeviceId: 'GPS-HIJACKED',
      },
    };
    const canTamperJsonb = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerB,
      jsonbAttack,
      managerAUid,
      profilesMap
    );
    expect(canTamperJsonb).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 13 : Admin can access authorized vehicles
  // ----------------------------------------------------------------------------
  it('TEST 13: Admin can access authorized vehicles', () => {
    // Admin peut lire tous les véhicules de son agence
    expect(PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerA, adminUid, profilesMap)).toBe(true);
    expect(PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerB, adminUid, profilesMap)).toBe(true);

    // Admin peut modifier et réassigner des véhicules au sein de son agence
    const adminReassign: BusinessRow = {
      ...vehicleOfManagerA,
      assigned_manager_id: 'usr-6',
    };
    expect(PostgresRlsEngine.evaluateUpdate('vehicles', vehicleOfManagerA, adminReassign, adminUid, profilesMap)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // TEST 14 : Admin cannot access another agency's vehicles if agency isolation applies
  // ----------------------------------------------------------------------------
  it("TEST 14: Admin cannot access another agency's vehicles if agency isolation applies", () => {
    // L'Admin de Casablanca (Anouar) ne peut ni lire ni modifier les véhicules de Rabat
    expect(PostgresRlsEngine.evaluateSelect('vehicles', foreignAgencyVehicle, adminUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateUpdate('vehicles', foreignAgencyVehicle, foreignAgencyVehicle, adminUid, profilesMap)).toBe(false);
    expect(PostgresRlsEngine.evaluateDelete('vehicles', foreignAgencyVehicle, adminUid, profilesMap)).toBe(false);

    // L'Admin de Rabat accède à son véhicule mais pas à ceux de Casablanca
    expect(PostgresRlsEngine.evaluateSelect('vehicles', foreignAgencyVehicle, foreignAdminUid, profilesMap)).toBe(true);
    expect(PostgresRlsEngine.evaluateSelect('vehicles', vehicleOfManagerA, foreignAdminUid, profilesMap)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 15 : Direct Supabase REST/API access is protected when the frontend is bypassed
  // ----------------------------------------------------------------------------
  it('TEST 15: Direct Supabase REST/API access is protected when the frontend is bypassed', () => {
    // Attaquant envoyant une requête PostgREST directe :
    // PATCH /rest/v1/vehicles?id=eq.veh-larbi-01
    // Authorization: Bearer <Manager A Token>
    // Body: { "daily_rate": 10 }
    const directApiPayload: BusinessRow = {
      ...vehicleOfManagerB,
      daily_rate: 10,
    };

    const isPermittedByPostgres = PostgresRlsEngine.evaluateUpdate(
      'vehicles',
      vehicleOfManagerB,
      directApiPayload,
      managerAUid, // Token de Manager A
      profilesMap
    );

    // Le moteur de sécurité PostgreSQL RLS bloque immédiatement la requête
    expect(isPermittedByPostgres).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // TEST 16 : A vehicle linked to an active contract cannot be accidentally deleted if business rules prohibit it
  // ----------------------------------------------------------------------------
  it('TEST 16: A vehicle linked to an active contract cannot be accidentally deleted if business rules prohibit it', () => {
    // Véhicule A est engagé dans un contrat actif (cnt-active-01)
    const deleteAttemptActiveVeh = simulateVehicleDeleteWithContractTrigger(
      vehicleOfManagerA,
      managerAUid,
      activeContracts
    );
    expect(deleteAttemptActiveVeh.permitted).toBe(false);
    expect(deleteAttemptActiveVeh.error).toContain('actuellement engagé dans un contrat actif');

    // Même l'administrateur est protégé par le trigger d'intégrité contractuelle
    const adminDeleteAttempt = simulateVehicleDeleteWithContractTrigger(
      vehicleOfManagerA,
      adminUid,
      activeContracts
    );
    expect(adminDeleteAttempt.permitted).toBe(false);
    expect(adminDeleteAttempt.error).toContain('actuellement engagé dans un contrat actif');

    // Véhicule B n'a qu'un contrat clôturé/archivé -> suppression permise pour l'administrateur
    const adminDeleteCompletedVeh = simulateVehicleDeleteWithContractTrigger(
      vehicleOfManagerB,
      adminUid,
      activeContracts
    );
    expect(adminDeleteCompletedVeh.permitted).toBe(true);
  });
});
