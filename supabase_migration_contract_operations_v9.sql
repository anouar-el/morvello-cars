-- ==============================================================================
-- MORVELLO CARS - MIGRATION SÉCURITÉ V9 : CONTRATS, CAUTIONS, PAIEMENTS & ÉTATS
-- ==============================================================================
-- OBJECTIFS CRITIQUES (PROBLEM #9) :
-- 1. Sécurité et Habilitation au niveau base de données (PostgreSQL RLS & Triggers)
-- 2. Machine d'état stricte pour le statut des contrats :
--    - Transitions valides : draft -> active, draft -> cancelled, active -> completed, active -> cancelled
--    - Transitions interdites : completed -> active, completed -> draft, completed -> cancelled,
--                               cancelled -> active, cancelled -> completed, draft -> completed
-- 3. Procédure transactionnelle atomique pour completeContract() :
--    - Clôture du contrat + libération du véhicule (status = available, mise à jour current_km)
--    - Validation return_km >= departure_km
--    - Gestion atomique de la caution associée (restitution intégrale ou retenue)
--    - Enregistrement de l'état des lieux et journal d'audit
-- 4. Procédure transactionnelle atomique pour cancelContract() :
--    - Annulation du contrat + libération immédiate du véhicule si le contrat était actif
--    - Interdiction d'annuler un contrat déjà terminé ou déjà annulé
-- 5. Sécurité des cautions (Deposits) :
--    - Montant positif ou nul (amount >= 0)
--    - Prévention de la double restitution (no double release)
--    - Déduction strictement positive et total déductions <= montant caution
--    - Impossibilité de déduire sur une caution déjà intégralement restituée
-- 6. Sécurité des règlements (Payments) :
--    - Montant strictement positif (amount > 0)
--    - Interdiction de paiement sur un contrat annulé
--    - Recalcul serveur/base de données des totaux (paid_amount, remaining_amount, payment_status)
-- 7. Suppression de contrat (deleteContract) :
--    - Strictement réservée à l'administrateur (public.is_admin())
--    - Libération automatique du véhicule si le contrat supprimé était actif
-- ==============================================================================

-- 1. FONCTIONS DE VALIDATION DE LA MACHINE D'ÉTAT DU CONTRAT
CREATE OR REPLACE FUNCTION public.validate_contract_status_transition(
  p_old_status text,
  p_new_status text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Si aucun changement de statut, transition toujours valide
  IF p_old_status = p_new_status THEN
    RETURN true;
  END IF;

  -- 1. Un contrat clôturé (completed) est dans un état terminal
  IF p_old_status = 'completed' THEN
    RAISE EXCEPTION 'Transition de statut interdite : un contrat terminé ("completed") ne peut pas être réactivé ou modifié vers "%".', p_new_status;
  END IF;

  -- 2. Un contrat annulé (cancelled) est dans un état terminal
  IF p_old_status = 'cancelled' THEN
    RAISE EXCEPTION 'Transition de statut interdite : un contrat annulé ("cancelled") ne peut pas être réactivé vers "%".', p_new_status;
  END IF;

  -- 3. Un contrat brouillon (draft) peut passer à "active" ou "cancelled"
  IF p_old_status = 'draft' THEN
    IF p_new_status IN ('active', 'cancelled') THEN
      RETURN true;
    ELSE
      RAISE EXCEPTION 'Transition de statut invalide : un contrat brouillon ne peut pas passer directement à "%". Il doit d''abord être activé.', p_new_status;
    END IF;
  END IF;

  -- 4. Un contrat actif (active) peut passer à "completed" ou "cancelled"
  IF p_old_status = 'active' THEN
    IF p_new_status IN ('completed', 'cancelled') THEN
      RETURN true;
    ELSE
      RAISE EXCEPTION 'Transition de statut invalide : un contrat actif ne peut pas passer à "%".', p_new_status;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- 2. TRIGGER SUR CONTRACTS (PROTECTION DES TRANSITIONS & DU VÉHICULE)
CREATE OR REPLACE FUNCTION public.trg_protect_contract_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller record;
  v_is_admin boolean;
  v_departure_km numeric;
  v_return_km numeric;
BEGIN
  -- Authentification de l'appelant
  IF auth.uid() IS NOT NULL THEN
    SELECT * INTO v_caller FROM public.profiles WHERE id = auth.uid()::text;
    v_is_admin := (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1');

    -- Contrôle d'isolation d'agence
    IF NOT public.is_same_agency(OLD.agency_id) OR NOT public.is_same_agency(NEW.agency_id) THEN
      RAISE EXCEPTION 'Périmètre agence non autorisé sur le contrat %', OLD.contract_number;
    END IF;

    -- Contrôle d'habilitation manager (si non-admin)
    IF NOT v_is_admin THEN
      IF NOT public.can_access_record(OLD.assigned_manager_id, OLD.created_by, OLD.agency_id) THEN
        RAISE EXCEPTION 'Accès refusé : vous n''avez pas les autorisations nécessaires sur le contrat %', OLD.contract_number;
      END IF;

      -- Interdiction de changer l'agence ou de réassigner le manager hors de son périmètre
      IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
        RAISE EXCEPTION 'Modification non autorisée de l''agence sur le contrat.';
      END IF;
      IF NEW.assigned_manager_id IS DISTINCT FROM OLD.assigned_manager_id 
         AND NOT public.is_current_manager(NEW.assigned_manager_id) THEN
        RAISE EXCEPTION 'Réassignation non autorisée du gestionnaire sur le contrat.';
      END IF;
    END IF;
  END IF;

  -- Validation de la machine d'état
  PERFORM public.validate_contract_status_transition(OLD.status, NEW.status);

  -- Si le contrat passe à "completed"
  IF OLD.status = 'active' AND NEW.status = 'completed' THEN
    v_departure_km := COALESCE(
      (NEW.data->>'departureKm')::numeric,
      (OLD.data->>'departureKm')::numeric,
      0
    );
    v_return_km := COALESCE(
      (NEW.data->>'returnKm')::numeric,
      (NEW.data->'inspection'->>'returnKm')::numeric,
      v_departure_km
    );

    IF v_return_km < v_departure_km THEN
      RAISE EXCEPTION 'Kilométrage invalide : le kilométrage de retour (%) ne peut pas être inférieur au kilométrage de départ (%).',
        v_return_km, v_departure_km;
    END IF;

    -- Libération automatique du véhicule lié
    IF NEW.vehicle_id IS NOT NULL THEN
      UPDATE public.vehicles
      SET status = 'available',
          current_km = GREATEST(current_km, v_return_km),
          updated_at = timezone('utc'::text, now())
      WHERE id = NEW.vehicle_id;
    END IF;
  END IF;

  -- Si le contrat passe à "cancelled" depuis "active"
  IF OLD.status = 'active' AND NEW.status = 'cancelled' THEN
    IF NEW.vehicle_id IS NOT NULL THEN
      UPDATE public.vehicles
      SET status = 'available',
          updated_at = timezone('utc'::text, now())
      WHERE id = NEW.vehicle_id;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_contract_updates ON public.contracts;
CREATE TRIGGER trg_protect_contract_updates
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_contract_updates();

-- 3. TRIGGER DE PROTECTION DE SUPPRESSION DE CONTRAT (DELETE STRICTEMENT RÉSERVÉ AUX ADMINS)
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

  -- Enregistrement d'audit
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
    COALESCE(OLD.agency_id, 'agency_morvello'),
    timezone('utc'::text, now())
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_contract_deletion ON public.contracts;
CREATE TRIGGER trg_protect_contract_deletion
  BEFORE DELETE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_contract_deletion();

-- 4. TRIGGER SUR PAYMENTS (VALIDATION FINANCIÈRE & INTÉGRITÉ)
CREATE OR REPLACE FUNCTION public.trg_protect_payment_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_total_paid numeric;
  v_remaining numeric;
  v_status text;
BEGIN
  -- Montant strictement positif
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
      RAISE EXCEPTION 'Montant invalide : le montant d''un règlement doit être strictement supérieur à 0 MAD (reçu : % MAD).',
        COALESCE(NEW.amount, 0);
    END IF;

    -- Vérification du contrat associé
    SELECT * INTO v_contract
    FROM public.contracts
    WHERE id = NEW.contract_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contrat parent introuvable pour ce règlement (contract_id : %).', NEW.contract_id;
    END IF;

    -- Cloisonnement d'agence
    IF NOT public.is_same_agency(v_contract.agency_id) THEN
      RAISE EXCEPTION 'Périmètre non autorisé : le contrat associé à ce paiement appartient à une autre agence.';
    END IF;

    -- Interdiction de paiement sur un contrat annulé
    IF v_contract.status = 'cancelled' THEN
      RAISE EXCEPTION 'Paiement rejeté : impossible d''enregistrer un règlement sur un contrat annulé (%).',
        v_contract.contract_number;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_payment_operations ON public.payments;
CREATE TRIGGER trg_protect_payment_operations
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_payment_operations();

-- 5. TRIGGER SUR DEPOSITS (VALIDATION DES CAUTIONS & DÉDUCTIONS)
CREATE OR REPLACE FUNCTION public.trg_protect_deposit_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deductions jsonb;
  v_total_deductions numeric := 0;
  v_item jsonb;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.amount IS NULL OR NEW.amount < 0 THEN
      RAISE EXCEPTION 'Montant invalide : le montant de la caution ne peut pas être négatif.';
    END IF;

    -- Contrôle d'isolation d'agence
    IF NOT public.is_same_agency(NEW.agency_id) THEN
      RAISE EXCEPTION 'Périmètre agence non autorisé pour cette caution.';
    END IF;

    -- Vérification anti-double restitution
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status = 'released' AND NEW.status = 'released' AND NEW.data->>'releasedAt' IS DISTINCT FROM OLD.data->>'releasedAt' THEN
        RAISE EXCEPTION 'Double restitution rejetée : la caution % a déjà été libérée.', OLD.id;
      END IF;

      -- Validation de la somme des déductions
      v_deductions := NEW.data->'deductions';
      IF v_deductions IS NOT NULL AND jsonb_typeof(v_deductions) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_deductions)
        LOOP
          IF (v_item->>'amount')::numeric < 0 THEN
            RAISE EXCEPTION 'Montant de déduction invalide : les déductions ne peuvent pas être négatives.';
          END IF;
          v_total_deductions := v_total_deductions + COALESCE((v_item->>'amount')::numeric, 0);
        END LOOP;

        IF v_total_deductions > NEW.amount THEN
          RAISE EXCEPTION 'Montant de déduction excessif : le total des déductions (% MAD) dépasse le montant de la caution (% MAD).',
            v_total_deductions, NEW.amount;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_deposit_operations ON public.deposits;
CREATE TRIGGER trg_protect_deposit_operations
  BEFORE INSERT OR UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_deposit_operations();

-- 6. RPC TRANSACTIONNELLE ATOMIQUE : CLÔTURE DE CONTRAT (completeContract)
CREATE OR REPLACE FUNCTION public.complete_contract_transactional(
  p_contract_id text,
  p_return_km numeric,
  p_return_date date,
  p_return_time text DEFAULT '18:00',
  p_notes text DEFAULT NULL,
  p_inspection jsonb DEFAULT NULL,
  p_deposit_action text DEFAULT NULL, -- 'release' | 'deduct' | NULL
  p_deduction jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_caller record;
  v_contract record;
  v_vehicle record;
  v_departure_km numeric;
  v_deposit record;
  v_updated_contract_data jsonb;
  v_merged_notes text;
BEGIN
  -- 1. Authentification
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour clôturer un contrat.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = v_auth_uid::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  -- 2. Verrouillage du contrat
  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat introuvable (ID : %).', p_contract_id;
  END IF;

  -- 3. Habilitation
  IF NOT public.is_same_agency(v_contract.agency_id) THEN
    RAISE EXCEPTION 'Périmètre non autorisé : ce contrat appartient à une autre agence.';
  END IF;

  IF NOT (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1') THEN
    IF NOT public.can_access_record(v_contract.assigned_manager_id, v_contract.created_by, v_contract.agency_id) THEN
      RAISE EXCEPTION 'Accès refusé : vous n''avez pas le droit de clôturer le contrat %.', v_contract.contract_number;
    END IF;
  END IF;

  -- 4. Contrôle de statut (seul un contrat active peut être clôturé)
  IF v_contract.status <> 'active' THEN
    RAISE EXCEPTION 'Clôture impossible : le contrat % est actuellement en statut "%". Seul un contrat actif peut être clôturé.',
      v_contract.contract_number, v_contract.status;
  END IF;

  -- 5. Validation du kilométrage
  v_departure_km := COALESCE(
    (v_contract.data->>'departureKm')::numeric,
    0
  );
  IF p_return_km < v_departure_km THEN
    RAISE EXCEPTION 'Kilométrage invalide : le kilométrage de retour (% KM) ne peut pas être inférieur au départ (% KM).',
      p_return_km, v_departure_km;
  END IF;

  -- 6. Mise à jour du véhicule (statut -> available)
  IF v_contract.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_contract.vehicle_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.vehicles
      SET status = 'available',
          current_km = GREATEST(current_km, p_return_km),
          updated_at = timezone('utc'::text, now())
      WHERE id = v_contract.vehicle_id;
    END IF;
  END IF;

  -- 7. Gestion de la caution liée si demandée
  IF p_deposit_action IS NOT NULL THEN
    SELECT * INTO v_deposit
    FROM public.deposits
    WHERE contract_id = p_contract_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF p_deposit_action = 'release' THEN
        IF v_deposit.status = 'released' THEN
          RAISE EXCEPTION 'Double restitution : la caution du contrat % est déjà restituée.', v_contract.contract_number;
        END IF;
        UPDATE public.deposits
        SET status = 'released',
            data = jsonb_set(
              jsonb_set(
                data,
                '{status}', '"released"'::jsonb
              ),
              '{releasedAt}', to_jsonb(p_return_date || ' ' || p_return_time)
            ),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_deposit.id;
      ELSIF p_deposit_action = 'deduct' AND p_deduction IS NOT NULL THEN
        UPDATE public.deposits
        SET status = CASE 
                       WHEN COALESCE((p_deduction->>'amount')::numeric, 0) >= amount THEN 'fully_retained'
                       ELSE 'partially_deducted'
                     END,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_deposit.id;
      END IF;
    END IF;
  END IF;

  -- 8. Mise à jour du contrat
  v_merged_notes := COALESCE(v_contract.data->>'notes', '');
  IF p_notes IS NOT NULL AND trim(p_notes) <> '' THEN
    v_merged_notes := CASE WHEN trim(v_merged_notes) <> '' THEN v_merged_notes || E'\n[Clôture]: ' || p_notes ELSE '[Clôture]: ' || p_notes END;
  END IF;

  v_updated_contract_data := v_contract.data;
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{status}', '"completed"'::jsonb);
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{returnKm}', to_jsonb(p_return_km));
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{returnDate}', to_jsonb(p_return_date::text));
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{returnTime}', to_jsonb(p_return_time));
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{notes}', to_jsonb(v_merged_notes));
  IF p_inspection IS NOT NULL THEN
    v_updated_contract_data := jsonb_set(v_updated_contract_data, '{inspection}', p_inspection);
  END IF;

  UPDATE public.contracts
  SET status = 'completed',
      data = v_updated_contract_data,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_contract_id;

  -- 9. Journal d'audit
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
    'Clôture contrat',
    'contract',
    p_contract_id,
    v_auth_uid::text,
    v_caller.name,
    'Contrat ' || v_contract.contract_number || ' clôturé avec succès à ' || p_return_km || ' KM. Véhicule libéré.',
    v_contract.agency_id,
    timezone('utc'::text, now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'status', 'completed',
    'return_km', p_return_km,
    'vehicle_id', v_contract.vehicle_id
  );
END;
$$;

-- 7. RPC TRANSACTIONNELLE ATOMIQUE : ANNULATION DE CONTRAT (cancelContract)
CREATE OR REPLACE FUNCTION public.cancel_contract_transactional(
  p_contract_id text,
  p_reason text DEFAULT 'Annulation'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_caller record;
  v_contract record;
  v_updated_contract_data jsonb;
  v_merged_notes text;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour annuler un contrat.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = v_auth_uid::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat introuvable (ID : %).', p_contract_id;
  END IF;

  IF NOT public.is_same_agency(v_contract.agency_id) THEN
    RAISE EXCEPTION 'Périmètre non autorisé : ce contrat appartient à une autre agence.';
  END IF;

  IF NOT (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1') THEN
    IF NOT public.can_access_record(v_contract.assigned_manager_id, v_contract.created_by, v_contract.agency_id) THEN
      RAISE EXCEPTION 'Accès refusé : vous n''avez pas le droit d''annuler le contrat %.', v_contract.contract_number;
    END IF;
  END IF;

  -- Vérification des transitions valides
  IF v_contract.status = 'completed' THEN
    RAISE EXCEPTION 'Annulation impossible : le contrat % est déjà clôturé (completed).', v_contract.contract_number;
  END IF;

  IF v_contract.status = 'cancelled' THEN
    RAISE EXCEPTION 'Annulation impossible : le contrat % est déjà annulé.', v_contract.contract_number;
  END IF;

  -- Libération immédiate du véhicule si le contrat était actif
  IF v_contract.status = 'active' AND v_contract.vehicle_id IS NOT NULL THEN
    UPDATE public.vehicles
    SET status = 'available',
        updated_at = timezone('utc'::text, now())
    WHERE id = v_contract.vehicle_id;
  END IF;

  v_merged_notes := COALESCE(v_contract.data->>'notes', '');
  IF p_reason IS NOT NULL AND trim(p_reason) <> '' THEN
    v_merged_notes := CASE WHEN trim(v_merged_notes) <> '' THEN v_merged_notes || E'\n[Annulation]: ' || p_reason ELSE '[Annulation]: ' || p_reason END;
  END IF;

  v_updated_contract_data := v_contract.data;
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{status}', '"cancelled"'::jsonb);
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{notes}', to_jsonb(v_merged_notes));

  UPDATE public.contracts
  SET status = 'cancelled',
      data = v_updated_contract_data,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_contract_id;

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
    'Annulation contrat',
    'contract',
    p_contract_id,
    v_auth_uid::text,
    v_caller.name,
    'Contrat ' || v_contract.contract_number || ' annulé. Motif : ' || COALESCE(p_reason, 'Non spécifié'),
    v_contract.agency_id,
    timezone('utc'::text, now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'status', 'cancelled'
  );
END;
$$;

-- 8. RPC TRANSACTIONNELLE ATOMIQUE : GESTION DES CAUTIONS (manage_deposit_transactional)
CREATE OR REPLACE FUNCTION public.manage_deposit_transactional(
  p_deposit_id text,
  p_action text, -- 'release' | 'deduct' | 'update'
  p_refunded_amount numeric DEFAULT NULL,
  p_deduction jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_caller record;
  v_deposit record;
  v_updated_data jsonb;
  v_new_status text;
  v_deductions jsonb;
  v_total_deducted numeric := 0;
  v_item jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour gérer une caution.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = v_auth_uid::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  SELECT * INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caution introuvable (ID : %).', p_deposit_id;
  END IF;

  IF NOT public.is_same_agency(v_deposit.agency_id) THEN
    RAISE EXCEPTION 'Périmètre non autorisé : cette caution appartient à une autre agence.';
  END IF;

  IF NOT (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1') THEN
    IF NOT public.can_access_record(v_deposit.assigned_manager_id, v_deposit.created_by, v_deposit.agency_id) THEN
      RAISE EXCEPTION 'Accès refusé : vous n''avez pas les droits nécessaires sur la caution %.', p_deposit_id;
    END IF;
  END IF;

  v_updated_data := v_deposit.data;

  -- 1. Restitution de caution
  IF p_action = 'release' THEN
    IF v_deposit.status = 'released' THEN
      RAISE EXCEPTION 'Double restitution rejetée : la caution % est déjà restituée.', p_deposit_id;
    END IF;
    IF v_deposit.status = 'fully_retained' THEN
      RAISE EXCEPTION 'Restitution impossible : la caution % a été intégralement retenue.', p_deposit_id;
    END IF;

    v_new_status := 'released';
    v_updated_data := jsonb_set(v_updated_data, '{status}', '"released"'::jsonb);
    v_updated_data := jsonb_set(v_updated_data, '{releasedAt}', to_jsonb(timezone('utc'::text, now())::text));
    v_updated_data := jsonb_set(v_updated_data, '{releasedBy}', to_jsonb(v_caller.name));
    IF p_refunded_amount IS NOT NULL THEN
      v_updated_data := jsonb_set(v_updated_data, '{refundedAmount}', to_jsonb(p_refunded_amount));
    END IF;

  -- 2. Déduction sur caution
  ELSIF p_action = 'deduct' THEN
    IF v_deposit.status = 'released' THEN
      RAISE EXCEPTION 'Déduction rejetée : la caution % a déjà été libérée.', p_deposit_id;
    END IF;

    IF p_deduction IS NULL OR (p_deduction->>'amount')::numeric <= 0 THEN
      RAISE EXCEPTION 'Montant de déduction invalide : doit être strictement positif.';
    END IF;

    v_deductions := COALESCE(v_updated_data->'deductions', '[]'::jsonb);
    v_deductions := v_deductions || jsonb_build_array(p_deduction);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_deductions)
    LOOP
      v_total_deducted := v_total_deducted + COALESCE((v_item->>'amount')::numeric, 0);
    END LOOP;

    IF v_total_deducted > v_deposit.amount THEN
      RAISE EXCEPTION 'Total déductions (% MAD) supérieur au montant de la caution (% MAD).',
        v_total_deducted, v_deposit.amount;
    END IF;

    v_new_status := CASE WHEN v_total_deducted >= v_deposit.amount THEN 'fully_retained' ELSE 'partially_deducted' END;
    v_updated_data := jsonb_set(v_updated_data, '{deductions}', v_deductions);
    v_updated_data := jsonb_set(v_updated_data, '{status}', to_jsonb(v_new_status));
    IF p_refunded_amount IS NOT NULL THEN
      v_updated_data := jsonb_set(v_updated_data, '{refundedAmount}', to_jsonb(p_refunded_amount));
    END IF;

  ELSE
    v_new_status := v_deposit.status;
  END IF;

  IF p_notes IS NOT NULL THEN
    v_updated_data := jsonb_set(v_updated_data, '{notes}', to_jsonb(p_notes));
  END IF;

  UPDATE public.deposits
  SET status = v_new_status,
      data = v_updated_data,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_deposit_id;

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
    'Opération caution',
    'contract',
    COALESCE(v_deposit.contract_id, p_deposit_id),
    v_auth_uid::text,
    v_caller.name,
    'Action ' || p_action || ' exécutée sur la caution ' || p_deposit_id || ' (nouveau statut : ' || v_new_status || ')',
    v_deposit.agency_id,
    timezone('utc'::text, now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'deposit_id', p_deposit_id,
    'status', v_new_status
  );
END;
$$;

-- 9. RPC TRANSACTIONNELLE ATOMIQUE : GESTION DES PAIEMENTS (manage_payment_transactional)
CREATE OR REPLACE FUNCTION public.manage_payment_transactional(
  p_action text, -- 'create' | 'update' | 'delete'
  p_payment jsonb,
  p_contract_id text,
  p_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid;
  v_caller record;
  v_contract record;
  v_amount numeric;
  v_payment_id text;
  v_total_paid numeric;
  v_contract_total numeric;
  v_remaining numeric;
  v_payment_status text;
  v_updated_contract_data jsonb;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour enregistrer un paiement.';
  END IF;

  SELECT * INTO v_caller FROM public.profiles WHERE id = v_auth_uid::text;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil utilisateur introuvable.';
  END IF;

  SELECT * INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrat introuvable (ID : %).', p_contract_id;
  END IF;

  IF NOT public.is_same_agency(v_contract.agency_id) THEN
    RAISE EXCEPTION 'Périmètre non autorisé : ce contrat appartient à une autre agence.';
  END IF;

  IF NOT (v_caller.role = 'admin' OR v_caller.legacy_id = 'usr-1' OR v_caller.local_id = 'usr-1') THEN
    IF NOT public.can_access_record(v_contract.assigned_manager_id, v_contract.created_by, v_contract.agency_id) THEN
      RAISE EXCEPTION 'Accès refusé : vous n''avez pas les autorisations nécessaires sur le contrat %.', v_contract.contract_number;
    END IF;
  END IF;

  IF v_contract.status = 'cancelled' THEN
    RAISE EXCEPTION 'Paiement rejeté : impossible de modifier ou d''ajouter des règlements sur un contrat annulé (%).', v_contract.contract_number;
  END IF;

  -- 1. Action CREATE
  IF p_action = 'create' THEN
    v_amount := COALESCE((p_payment->>'amount')::numeric, 0);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Montant invalide : le montant d''un règlement doit être strictement supérieur à 0 MAD.';
    END IF;

    v_payment_id := COALESCE(p_payment->>'id', 'pay-' || gen_random_uuid());

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
      p_contract_id,
      v_amount,
      COALESCE(p_payment->>'method', 'cash'),
      COALESCE((p_payment->>'date')::date, CURRENT_DATE),
      COALESCE(p_payment->>'receiptNumber', p_payment->>'receipt_number', NULL),
      COALESCE(p_payment->>'notes', NULL),
      COALESCE(p_payment->>'recordedBy', v_caller.name, 'Direction'),
      v_contract.agency_id,
      v_contract.assigned_manager_id,
      v_auth_uid::text,
      p_payment,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    );

  -- 2. Action UPDATE
  ELSIF p_action = 'update' THEN
    v_payment_id := COALESCE(p_payment_id, p_payment->>'id');
    v_amount := COALESCE((p_payment->>'amount')::numeric, 0);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Montant invalide : le montant d''un règlement doit être strictement supérieur à 0 MAD.';
    END IF;

    UPDATE public.payments
    SET amount = v_amount,
        method = COALESCE(p_payment->>'method', method),
        notes = COALESCE(p_payment->>'notes', notes),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_payment_id AND contract_id = p_contract_id;

  -- 3. Action DELETE
  ELSIF p_action = 'delete' THEN
    v_payment_id := COALESCE(p_payment_id, p_payment->>'id');
    DELETE FROM public.payments WHERE id = v_payment_id AND contract_id = p_contract_id;
  END IF;

  -- 4. Recalcul côté serveur des soldes financiers
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments
  WHERE contract_id = p_contract_id;

  v_contract_total := COALESCE(v_contract.total_amount, (v_contract.data->>'totalAmount')::numeric, 0);
  v_remaining := GREATEST(0, v_contract_total - v_total_paid);
  v_payment_status := CASE 
                        WHEN v_contract_total = 0 OR v_remaining <= 0 THEN 'paid'
                        WHEN v_total_paid > 0 THEN 'partial'
                        ELSE 'unpaid'
                      END;

  v_updated_contract_data := v_contract.data;
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{paidAmount}', to_jsonb(v_total_paid));
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{remainingAmount}', to_jsonb(v_remaining));
  v_updated_contract_data := jsonb_set(v_updated_contract_data, '{paymentStatus}', to_jsonb(v_payment_status));

  UPDATE public.contracts
  SET data = v_updated_contract_data,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_contract_id;

  -- 5. Journal d'audit
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
    'Paiement ' || p_action,
    'contract',
    p_contract_id,
    v_auth_uid::text,
    v_caller.name,
    'Paiement #' || v_payment_id || ' (' || p_action || '). Total payé : ' || v_total_paid || ' MAD, Reste : ' || v_remaining || ' MAD.',
    v_contract.agency_id,
    timezone('utc'::text, now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'payment_id', v_payment_id,
    'total_paid', v_total_paid,
    'remaining_amount', v_remaining,
    'payment_status', v_payment_status
  );
END;
$$;

-- 10. POLITIQUES RLS RENFORCÉES
-- Un utilisateur ne peut supprimer un contrat que s'il est admin
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE TO authenticated 
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

-- Habilitations d'exécution RPC
GRANT EXECUTE ON FUNCTION public.complete_contract_transactional(text, numeric, date, text, text, jsonb, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_contract_transactional(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_deposit_transactional(text, text, numeric, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_payment_transactional(text, jsonb, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
