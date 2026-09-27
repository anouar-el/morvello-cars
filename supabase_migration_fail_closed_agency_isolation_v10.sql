-- ==============================================================================
-- MORVELLO CARS - MIGRATION V10: FAIL-CLOSED MULTI-TENANT ISOLATION
-- ==============================================================================
-- Audit Fix: P0.1 is_same_agency() & P0.2 get_current_agency_id()
-- Objective:
-- 1. Eliminate all fail-open fallbacks to 'agency_morvello' across functions,
--    triggers, RPCs, and default column values.
-- 2. Strict fail-closed resolution: NULL / empty / whitespace / missing profiles
--    MUST NEVER inherit an agency or gain cross-tenant access.
-- 3. Strict equality comparison for row authorization: NULL / empty row agency
--    MUST NEVER evaluate to true.
-- 4. Minimum required privilege model (REVOKE EXECUTE FROM PUBLIC/anon).
-- ==============================================================================

-- 1. FONCTION STRICTE DE RÉSOLUTION DE L'AGENCE COURANTE (FAIL-CLOSED)
CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_agency_id text;
  v_agency text;
BEGIN
  v_uid := auth.uid();
  -- A. Utilisateur non-authentifié -> NULL
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- B. Recherche du profil correspondant dans public.profiles
  SELECT p.agency_id, p.agency
  INTO v_agency_id, v_agency
  FROM public.profiles p
  WHERE p.id = v_uid::text;

  -- C. Aucun profil trouvé -> NULL (fail-closed, pas de fallback silencieux)
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- D. agency_id NULL, vide ou composé uniquement d'espaces -> NULL
  IF v_agency_id IS NULL OR trim(v_agency_id) = '' THEN
    RETURN NULL;
  END IF;

  v_agency_id := trim(v_agency_id);

  -- E. Règle canonique & détection de conflit déterministe :
  -- Si le champ historique 'agency' contient un identifiant technique distinct (commençant par agency_),
  -- il y a contradiction de périmètre -> fail-closed (NULL).
  IF v_agency IS NOT NULL AND trim(v_agency) <> '' THEN
    IF trim(v_agency) LIKE 'agency_%' AND trim(v_agency) <> v_agency_id THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN v_agency_id;
END;
$$;

-- 2. FONCTION STRICTE DE COMPARAISON D'AGENCE (FAIL-CLOSED)
CREATE OR REPLACE FUNCTION public.is_same_agency(row_agency_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_agency text;
  v_cleaned_row_agency text;
BEGIN
  -- A. Utilisateur non-authentifié -> FALSE
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- B. Ligne avec agency_id NULL, vide ou whitespace -> FALSE (Interdiction absolue de fail-open)
  IF row_agency_id IS NULL OR trim(row_agency_id) = '' THEN
    RETURN FALSE;
  END IF;

  v_cleaned_row_agency := trim(row_agency_id);

  -- C. Résolution de l'agence courante de l'utilisateur
  v_current_agency := public.get_current_agency_id();

  -- D. Utilisateur sans agence valide -> FALSE
  IF v_current_agency IS NULL OR trim(v_current_agency) = '' THEN
    RETURN FALSE;
  END IF;

  -- E. Égalité stricte des identifiants d'agence
  RETURN v_cleaned_row_agency = v_current_agency;
END;
$$;

-- 3. MINIMUM PRIVILEGE MODEL SUR LES FONCTIONS DE SÉCURITÉ
REVOKE ALL ON FUNCTION public.get_current_agency_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_agency_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_agency_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_same_agency(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_same_agency(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_same_agency(text) TO authenticated;

-- 4. SÉCURISATION DU TRIGGER DE CRÉATION DE PROFIL (AUCUN FALLBACK SILENCIEUX)
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency text;
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Privilege escalation rejected: cannot create an admin profile.';
    END IF;
    IF NEW.local_id = 'usr-1' OR NEW.legacy_id = 'usr-1' THEN
      RAISE EXCEPTION 'Security violation: usr-1 identity is reserved.';
    END IF;
    IF NEW.role IS NULL OR trim(NEW.role) = '' THEN
      NEW.role := 'agent';
    END IF;

    -- Non-admin : l'agence DOIT être explicitement fournie et non vide
    IF NEW.agency_id IS NULL OR trim(NEW.agency_id) = '' THEN
      RAISE EXCEPTION 'Agency required: profile creation must specify an authorized agency.';
    END IF;
  ELSE
    -- Admin créant un profil : si agency_id est omis, dériver de l'agence de l'admin
    IF NEW.agency_id IS NULL OR trim(NEW.agency_id) = '' THEN
      v_caller_agency := public.get_current_agency_id();
      IF v_caller_agency IS NULL OR trim(v_caller_agency) = '' THEN
        RAISE EXCEPTION 'Agency required: active admin profile must have an assigned agency.';
      END IF;
      NEW.agency_id := v_caller_agency;
    END IF;
  END IF;

  NEW.agency_id := trim(NEW.agency_id);
  NEW.created_at := timezone('utc'::text, now());
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_insert();

-- 5. SÉCURISATION DU JOURNAL D'AUDIT SUR SUPPRESSION DE CONTRAT (PAS DE FABRICATION D'AGENCE)
CREATE OR REPLACE FUNCTION public.trg_protect_contract_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
  v_caller record;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid()::text;
    v_is_admin := (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1');
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Action non autorisée : seul le Gérant / Administrateur est habilité à supprimer définitivement un contrat (contrat %).',
        OLD.contract_number;
    END IF;
  END IF;

  -- Libération automatique du véhicule si le contrat supprimé était actif
  IF OLD.status = 'active' AND OLD.vehicle_id IS NOT NULL THEN
    UPDATE public.vehicles
    SET status = 'available',
        updated_at = timezone('utc'::text, now())
    WHERE id = OLD.vehicle_id;
  END IF;

  -- Enregistrement d'audit : conserver OLD.agency_id réel, AUCUNE fabrication d'agence_morvello
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
    'Suppression contrat',
    'contract',
    OLD.id,
    COALESCE(auth.uid()::text, 'system'),
    COALESCE(v_caller.name, 'Direction'),
    'Contrat ' || OLD.contract_number || ' supprimé définitivement de la base de données.',
    OLD.agency_id,
    timezone('utc'::text, now())
  );

  RETURN OLD;
END;
$$;

-- 6. SUPPRESSION DES DÉFAUTS D'AGENCE NON SÉCURISÉS (ANTI IMPLICIT MULTI-TENANT LEAK)
ALTER TABLE public.profiles ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.vehicles ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.clients ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.drivers ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.contracts ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.deposits ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.payments ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.vehicle_expenses ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.audit_logs ALTER COLUMN agency_id DROP DEFAULT;
ALTER TABLE public.agency_data ALTER COLUMN agency_id DROP DEFAULT;

-- 7. MISE À JOUR DE CREATE_CONTRACT_TRANSACTIONAL (FAIL-CLOSED SANS COALESCE MORVELLO)
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

  -- Résolution stricte et fail-closed de l'agence (AUCUN fallback agency_morvello)
  v_agency_id := public.get_current_agency_id();
  IF v_agency_id IS NULL OR trim(v_agency_id) = '' THEN
    RAISE EXCEPTION 'Accès refusé : aucun identifiant d''agence valide associé à votre profil utilisateur.';
  END IF;

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
    vehicle_id,
    client_id,
    start_date,
    end_date,
    status,
    total_amount,
    deposit_amount,
    departure_km,
    agency_id,
    assigned_manager_id,
    created_by,
    data,
    created_at,
    updated_at
  ) VALUES (
    v_contract_id,
    v_contract_number,
    v_vehicle_id,
    v_client_id,
    v_start_date,
    v_end_date,
    v_status,
    v_total_amount,
    v_deposit_amount,
    v_departure_km,
    v_agency_id,
    v_assigned_manager_id,
    v_created_by,
    p_contract,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  -- 8. MISE À JOUR ATOMIQUE DU STATUT ET DU KILOMÉTRAGE DU VÉHICULE
  IF v_status = 'active' THEN
    UPDATE public.vehicles
    SET status = 'rented',
        current_km = GREATEST(current_km, v_departure_km),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_vehicle_id;
  END IF;

  -- 9. GESTION ATOMIQUE DE LA CAUTION (DEPOSIT)
  IF p_deposit IS NOT NULL OR v_deposit_amount > 0 THEN
    v_deposit_id := COALESCE(p_deposit->>'id', 'dep-' || gen_random_uuid());
    INSERT INTO public.deposits (
      id,
      contract_id,
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
      v_deposit_amount,
      COALESCE(p_deposit->>'status', 'pending'),
      COALESCE(p_deposit->>'method', 'preauth'),
      v_agency_id,
      v_assigned_manager_id,
      v_auth_uid::text,
      COALESCE(p_deposit, jsonb_build_object('amount', v_deposit_amount, 'status', 'pending')),
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    );
  END IF;

  -- 10. ENREGISTREMENT ATOMIQUE DES PAIEMENTS INITIAUX
  IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_payment_item IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_payment_id := COALESCE(v_payment_item->>'id', 'pay-' || gen_random_uuid());
      INSERT INTO public.payments (
        id,
        contract_id,
        amount,
        method,
        status,
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
        COALESCE(v_payment_item->>'status', 'completed'),
        v_agency_id,
        v_assigned_manager_id,
        v_auth_uid::text,
        v_payment_item,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      );
    END LOOP;
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

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'contract_number', v_contract_number,
    'vehicle_id', v_vehicle_id,
    'client_id', v_client_id,
    'agency_id', v_agency_id,
    'status', v_status
  );
END;
$$;
