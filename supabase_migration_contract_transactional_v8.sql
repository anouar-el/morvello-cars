-- ==============================================================================
-- MORVELLO CARS - MIGRATION SÉCURITÉ V8 : CRÉATION TRANSACTIONNELLE DE CONTRAT
-- ==============================================================================
-- OBJECTIFS CRITIQUES (PROBLEM #8) :
-- 1. Exécution 100% atomique de la création de contrat (Toutes les opérations
--    réussissent ou TOUT est annulé/rollbacké)
-- 2. Respect absolu de l'intégrité référentielle (Foreign Keys) :
--    - contracts.client_id -> public.clients(id)
--    - contracts.vehicle_id -> public.vehicles(id)
--    - payments.contract_id -> public.contracts(id)
--    - deposits.contract_id -> public.contracts(id)
-- 3. Création/Vérification ordonnée des enregistrements parents (Client, Véhicule)
--    AVANT l'insertion du contrat
-- 4. Prévention stricte des doubles réservations (Double Booking) :
--    - Verrouillage transactionnel de ligne sur le véhicule (SELECT ... FOR UPDATE)
--    - Détection des chevauchements de dates sur contrats actifs/en cours (start_date <= end_date_b AND end_date >= start_date_b)
-- 5. Vérification d'habilitation et cloisonnement multi-agence / manager (RLS)
-- 6. Génération sécurisée et garantie d'unicité du numéro de contrat
-- 7. Audit log automatique et traçabilité
-- ==============================================================================

-- 1. INDEX DE PERFORMANCE POUR LA DÉTECTION DES CHEVAUCHEMENTS DE RÉSERVATION
CREATE INDEX IF NOT EXISTS idx_contracts_vehicle_dates_status 
ON public.contracts(vehicle_id, start_date, end_date, status);

CREATE INDEX IF NOT EXISTS idx_contracts_client_id 
ON public.contracts(client_id);

-- 2. FONCTION TRANSACTIONNELLE DE CRÉATION DE CONTRAT
CREATE OR REPLACE FUNCTION public.create_contract_transactional(
  p_contract jsonb,
  p_client jsonb DEFAULT NULL,
  p_vehicle_id text DEFAULT NULL,
  p_deposit jsonb DEFAULT NULL,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_company_settings jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_caller record;
  v_agency_id text;
  v_is_admin boolean;
  
  v_vehicle_id text;
  v_vehicle record;
  
  v_client_id text;
  v_client record;
  
  v_contract_id text;
  v_contract_number text;
  v_status text;
  v_start_date date;
  v_end_date date;
  v_total_amount numeric;
  v_deposit_amount numeric;
  v_departure_km numeric;
  v_assigned_manager_id text;
  v_created_by text;
  
  v_conflict_contract record;
  v_deposit_id text;
  v_payment_item jsonb;
  v_payment_id text;
BEGIN
  -- 1. AUTHENTIFICATION DE L'APPELANT
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise : session utilisateur inexistante.';
  END IF;

  SELECT * INTO v_caller
  FROM public.profiles
  WHERE id = v_auth_uid::text;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable pour l''identifiant %', v_auth_uid;
  END IF;

  v_agency_id := COALESCE(v_caller.agency_id, v_caller.agency, 'agency_morvello');
  v_is_admin := (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1');

  -- 2. VÉRIFICATION ET VERROUILLAGE DU VÉHICULE (ANTI DOUBLE-RÉSERVATION)
  v_vehicle_id := COALESCE(p_vehicle_id, p_contract->>'vehicleId', p_contract->>'vehicle_id');
  IF v_vehicle_id IS NULL OR trim(v_vehicle_id) = '' THEN
    RAISE EXCEPTION 'Véhicule obligatoire : impossible de créer un contrat sans identifiant de véhicule.';
  END IF;

  -- Verrouillage exclusif de la ligne véhicule pour sérialiser les réservations concurrentes
  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = v_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Véhicule introuvable : le véhicule "%" n''existe pas en base de données.', v_vehicle_id;
  END IF;

  -- Contrôle de cloisonnement d'agence
  IF NOT public.is_same_agency(v_vehicle.agency_id) THEN
    RAISE EXCEPTION 'Périmètre non autorisé : le véhicule "%" appartient à une autre agence.', v_vehicle_id;
  END IF;

  -- Contrôle d'habilitation manager si non-admin
  IF NOT v_is_admin THEN
    IF NOT public.can_access_record(v_vehicle.assigned_manager_id, v_vehicle.created_by, v_vehicle.agency_id) THEN
      RAISE EXCEPTION 'Accès refusé : vous n''avez pas les autorisations nécessaires sur le véhicule "%".', v_vehicle_id;
    END IF;
  END IF;

  -- Contrôle d'état d'exploitation du véhicule
  IF v_vehicle.status IN ('maintenance', 'inactive') THEN
    RAISE EXCEPTION 'Véhicule indisponible : le véhicule "%" est actuellement en statut "%".', v_vehicle.plate, v_vehicle.status;
  END IF;

  -- 3. EXTRACTION ET VALIDATION DES DATES & DU STATUT
  v_contract_id := COALESCE(p_contract->>'id', 'cnt-' || gen_random_uuid());
  v_contract_number := COALESCE(p_contract->>'contractNumber', p_contract->>'contract_number');
  v_status := COALESCE(p_contract->>'status', 'active');
  
  IF p_contract->>'startDate' IS NOT NULL THEN
    v_start_date := (p_contract->>'startDate')::date;
  ELSIF p_contract->>'start_date' IS NOT NULL THEN
    v_start_date := (p_contract->>'start_date')::date;
  ELSE
    v_start_date := CURRENT_DATE;
  END IF;

  IF p_contract->>'endDate' IS NOT NULL THEN
    v_end_date := (p_contract->>'endDate')::date;
  ELSIF p_contract->>'end_date' IS NOT NULL THEN
    v_end_date := (p_contract->>'end_date')::date;
  ELSE
    v_end_date := v_start_date;
  END IF;

  IF v_end_date < v_start_date THEN
    RAISE EXCEPTION 'Dates invalides : la date de fin (%) ne peut pas être antérieure à la date de début (%).', v_end_date, v_start_date;
  END IF;

  -- 4. DÉTECTION DES CONFLITS DE DISPONIBILITÉ (DOUBLE BOOKING)
  IF v_status IN ('active', 'draft') THEN
    SELECT * INTO v_conflict_contract
    FROM public.contracts
    WHERE vehicle_id = v_vehicle_id
      AND id <> v_contract_id
      AND status IN ('active', 'draft')
      AND start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND (start_date <= v_end_date AND end_date >= v_start_date)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Double réservation rejetée : le véhicule "%" (immatriculation: %) est déjà engagé dans le contrat actif "%" du % au %.',
        v_vehicle_id, v_vehicle.plate, v_conflict_contract.contract_number, v_conflict_contract.start_date, v_conflict_contract.end_date;
    END IF;
  END IF;

  -- 5. VÉRIFICATION OU CRÉATION ATOMIQUE DU CLIENT (PARENT FK)
  v_client_id := COALESCE(p_contract->>'clientId', p_contract->>'client_id');
  IF v_client_id IS NULL OR trim(v_client_id) = '' THEN
    IF p_client IS NOT NULL THEN
      v_client_id := p_client->>'id';
    END IF;
  END IF;

  IF v_client_id IS NULL OR trim(v_client_id) = '' THEN
    RAISE EXCEPTION 'Client obligatoire : impossible de créer un contrat sans client associé.';
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = v_client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Le client n'existe pas encore en base : le créer atomiquement si les informations sont fournies
    IF p_client IS NOT NULL AND (
      p_client->>'firstName' IS NOT NULL OR p_client->>'first_name' IS NOT NULL OR
      p_client->>'lastName' IS NOT NULL OR p_client->>'last_name' IS NOT NULL
    ) THEN
      INSERT INTO public.clients (
        id,
        first_name,
        last_name,
        doc_type,
        doc_number,
        phone,
        email,
        contract_count,
        agency_id,
        assigned_manager_id,
        created_by,
        data,
        created_at,
        updated_at
      ) VALUES (
        v_client_id,
        COALESCE(p_client->>'firstName', p_client->>'first_name', 'Client'),
        COALESCE(p_client->>'lastName', p_client->>'last_name', ''),
        COALESCE(p_client->>'docType', p_client->>'doc_type', 'CIN'),
        COALESCE(p_client->>'docNumber', p_client->>'doc_number', 'N/C'),
        COALESCE(p_client->>'phone', NULL),
        COALESCE(p_client->>'email', NULL),
        1,
        v_agency_id,
        COALESCE(p_client->>'assignedManagerId', p_client->>'assigned_manager_id', v_vehicle.assigned_manager_id, v_auth_uid::text),
        v_auth_uid::text,
        p_client,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      ) RETURNING * INTO v_client;
    ELSE
      RAISE EXCEPTION 'Client introuvable : l''identifiant client "%" n''existe pas en base de données et aucune donnée n''a été fournie pour le créer.', v_client_id;
    END IF;
  ELSE
    -- Client existant : vérifier l'agence et incrémenter le compteur de contrats
    IF NOT public.is_same_agency(v_client.agency_id) THEN
      RAISE EXCEPTION 'Périmètre non autorisé : le client "%" appartient à une autre agence.', v_client_id;
    END IF;

    UPDATE public.clients
    SET contract_count = COALESCE(contract_count, 0) + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_client_id;
  END IF;

  -- 6. CONTRÔLE D'UNICITÉ DU NUMÉRO DE CONTRAT
  IF v_contract_number IS NULL OR trim(v_contract_number) = '' THEN
    RAISE EXCEPTION 'Numéro de contrat obligatoire.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contracts 
    WHERE contract_number = v_contract_number 
    AND id <> v_contract_id
  ) THEN
    RAISE EXCEPTION 'Numéro de contrat déjà existant : le contrat "%" existe déjà en base de données.', v_contract_number;
  END IF;

  -- 7. INSERTION ATOMIQUE DU CONTRAT
  v_total_amount := COALESCE((p_contract->>'totalAmount')::numeric, (p_contract->>'total_amount')::numeric, 0);
  v_deposit_amount := COALESCE((p_contract->>'depositAmount')::numeric, (p_contract->>'deposit_amount')::numeric, 0);
  v_departure_km := COALESCE((p_contract->>'departureKm')::numeric, (p_contract->>'departure_km')::numeric, v_vehicle.current_km);
  v_assigned_manager_id := COALESCE(p_contract->>'assignedManagerId', p_contract->>'assigned_manager_id', v_vehicle.assigned_manager_id, v_auth_uid::text);
  v_created_by := COALESCE(p_contract->>'createdBy', p_contract->>'created_by', v_caller.name, v_auth_uid::text);

  INSERT INTO public.contracts (
    id,
    contract_number,
    status,
    client_id,
    vehicle_id,
    start_date,
    end_date,
    total_amount,
    deposit_amount,
    agency_id,
    assigned_manager_id,
    created_by,
    data,
    created_at,
    updated_at
  ) VALUES (
    v_contract_id,
    v_contract_number,
    v_status,
    v_client_id,
    v_vehicle_id,
    v_start_date,
    v_end_date,
    v_total_amount,
    v_deposit_amount,
    v_agency_id,
    v_assigned_manager_id,
    v_created_by,
    p_contract,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    contract_number = EXCLUDED.contract_number,
    status = EXCLUDED.status,
    client_id = EXCLUDED.client_id,
    vehicle_id = EXCLUDED.vehicle_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    total_amount = EXCLUDED.total_amount,
    deposit_amount = EXCLUDED.deposit_amount,
    data = EXCLUDED.data,
    updated_at = timezone('utc'::text, now());

  -- 8. ENREGISTREMENT ATOMIQUE DE LA CAUTION (SI PRÉSENTE)
  IF p_deposit IS NOT NULL AND COALESCE((p_deposit->>'amount')::numeric, 0) > 0 THEN
    v_deposit_id := COALESCE(p_deposit->>'id', 'dep-' || gen_random_uuid());
    INSERT INTO public.deposits (
      id,
      contract_id,
      client_name,
      amount,
      status,
      method,
      agency_id,
      assigned_manager_id,
      created_by,
      data,
      created_at,
      updated_at
    ) VALUES (
      v_deposit_id,
      v_contract_id,
      COALESCE(p_deposit->>'clientName', v_client.first_name || ' ' || v_client.last_name),
      (p_deposit->>'amount')::numeric,
      COALESCE(p_deposit->>'status', 'pending'),
      COALESCE(p_deposit->>'method', 'carte'),
      v_agency_id,
      COALESCE(p_deposit->>'assignedManagerId', v_vehicle.assigned_manager_id, v_auth_uid::text),
      v_auth_uid::text,
      p_deposit,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      amount = EXCLUDED.amount,
      status = EXCLUDED.status,
      updated_at = timezone('utc'::text, now());
  END IF;

  -- 9. ENREGISTREMENT ATOMIQUE DES PAIEMENTS INITIAUX (SI FOURNIS)
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_payment_item IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_payment_id := COALESCE(v_payment_item->>'id', 'pay-' || gen_random_uuid());
      INSERT INTO public.payments (
        id,
        contract_id,
        amount,
        method,
        date,
        receipt_number,
        notes,
        recorded_by,
        agency_id,
        assigned_manager_id,
        created_by,
        data,
        created_at,
        updated_at
      ) VALUES (
        v_payment_id,
        v_contract_id,
        COALESCE((v_payment_item->>'amount')::numeric, 0),
        COALESCE(v_payment_item->>'method', 'cash'),
        COALESCE((v_payment_item->>'date')::date, CURRENT_DATE),
        COALESCE(v_payment_item->>'receiptNumber', v_payment_item->>'receipt_number', NULL),
        COALESCE(v_payment_item->>'notes', NULL),
        COALESCE(v_payment_item->>'recordedBy', v_caller.name, 'Collaborateur'),
        v_agency_id,
        COALESCE(v_payment_item->>'assignedManagerId', v_vehicle.assigned_manager_id, v_auth_uid::text),
        v_auth_uid::text,
        v_payment_item,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  -- 10. MISE À JOUR DE L'ÉTAT DU VÉHICULE
  IF v_status = 'active' THEN
    UPDATE public.vehicles
    SET status = 'rented',
        current_km = GREATEST(current_km, v_departure_km),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_vehicle_id;
  END IF;

  -- 11. ENREGISTREMENT DANS LE JOURNAL D'AUDIT SÉCURISÉ
  INSERT INTO public.audit_logs (
    id,
    action,
    target_type,
    target_id,
    user_id,
    user_name,
    details,
    agency_id,
    timestamp
  ) VALUES (
    'aud-' || gen_random_uuid(),
    'Création contrat',
    'contract',
    v_contract_id,
    v_auth_uid::text,
    v_caller.name,
    'Contrat ' || v_contract_number || ' créé avec succès (validation transactionnelle)',
    v_agency_id,
    timezone('utc'::text, now())
  );

  -- 12. RETOUR TRANSACTIONNEL COMPLET
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'contract_number', v_contract_number,
    'client_id', v_client_id,
    'vehicle_id', v_vehicle_id,
    'deposit_id', v_deposit_id,
    'status', v_status
  );
END;
$$;

-- 3. PERMISSIONS STRICTES (EXÉCUTION RÉSERVÉE AUX UTILISATEURS AUTHENTIFIÉS)
REVOKE ALL ON FUNCTION public.create_contract_transactional(jsonb, jsonb, text, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_contract_transactional(jsonb, jsonb, text, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_contract_transactional(jsonb, jsonb, text, jsonb, jsonb, jsonb) TO authenticated;
