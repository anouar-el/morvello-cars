-- ==============================================================================
-- MORVELLO CARS - MIGRATION SÉCURITÉ V4 : VERROUILLAGE RLS DES VÉHICULES (PROBLEM #3)
-- ==============================================================================
-- OBJECTIFS CRITIQUES :
-- 1. Éliminer définitivement toute politique permissive (USING true / auth.uid() IS NOT NULL seul)
--    sur la table `public.vehicles`.
-- 2. Garantir le cloisonnement strict de la flotte par agence et par manager :
--    - Utilisateurs non-authentifiés : Zéro accès.
--    - Gérant / Admin : Accès complet à l'ensemble des véhicules de son agence.
--    - Manager : Accès restreint exclusivement aux véhicules qui lui sont assignés ou qu'il a créés.
--    - Un manager NE PEUT PAS lire, modifier ou supprimer le véhicule d'un autre manager.
--    - Un manager NE PEUT PAS modifier l'agency_id ou transférer un véhicule à un autre manager.
-- 3. Protection d'intégrité contractuelle (Anti-Suppression de Véhicule Engagé) :
--    - Interdiction stricte en base de données de supprimer un véhicule ayant un contrat actif ou en cours.
--    - Pour les contrats archivés/clôturés, conservation de l'historique complet (ON DELETE SET NULL).
--
-- Exécutez ce script dans Supabase SQL Editor :
-- https://app.supabase.com -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. STRUCTURE ET INDEX DE LA TABLE VÉHICULES
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_vehicles_agency_id ON public.vehicles(agency_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON public.vehicles(status);

-- 2. NETTOYAGE DES ANCIENNES POLICIES VÉHICULES
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;
DROP POLICY IF EXISTS "morvello_vehicles_policy" ON public.vehicles;

-- 3. POLITIQUES ROW LEVEL SECURITY (RLS) SUR VEHICLES

-- 3.1 SÉLECTION (SELECT)
-- Les gestionnaires ne voient que leurs véhicules assignés ou créés.
-- Les administrateurs voient tous les véhicules de leur agence.
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

-- 3.2 INSERTION (INSERT)
-- Interdit à un manager d'insérer un véhicule pour une autre agence ou attribué à un autre manager.
CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

-- 3.3 MISE À JOUR (UPDATE)
-- Protège la ligne ciblée (USING) et valide strictement l'état final (WITH CHECK).
-- Empêche le changement d'agence ou la réattribution à un autre manager pour usurper l'accès.
CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

-- 3.4 SUPPRESSION (DELETE)
-- Seuls l'administrateur de l'agence ou le gestionnaire propriétaire/créateur peuvent supprimer.
CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (
      public.is_admin()
      OR public.is_current_manager(assigned_manager_id)
      OR public.is_current_manager(created_by)
    )
  );

-- 4. TRIGGER DE PROTECTION LORS DE LA MISE À JOUR (ANTI-USURPATION)
CREATE OR REPLACE FUNCTION public.protect_vehicle_update_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si l'utilisateur n'est pas administrateur :
  IF NOT public.is_admin() THEN
    -- 1. Interdiction absolue de modifier l'agence du véhicule
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Agency modification rejected: non-admin managers cannot change vehicle agency_id.';
    END IF;

    -- 2. Interdiction absolue de réassigner le véhicule à un tiers
    IF NEW.assigned_manager_id IS DISTINCT FROM OLD.assigned_manager_id 
       AND NOT public.is_current_manager(NEW.assigned_manager_id) THEN
      RAISE EXCEPTION 'Manager reassignment rejected: cannot assign a vehicle to another manager.';
    END IF;
  END IF;

  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_vehicle_update_security ON public.vehicles;
CREATE TRIGGER trg_protect_vehicle_update_security
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_vehicle_update_security();

-- 5. TRIGGER DE PROTECTION DE SUPPRESSION LIÉE AUX CONTRATS ACTIFS
CREATE OR REPLACE FUNCTION public.protect_vehicle_deletion_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_contract_count integer;
BEGIN
  -- Vérification d'intégrité métier : Un véhicule avec contrat actif ne peut être supprimé
  SELECT COUNT(*) INTO v_active_contract_count
  FROM public.contracts
  WHERE vehicle_id = OLD.id
  AND status IN ('active', 'draft');

  IF v_active_contract_count > 0 THEN
    RAISE EXCEPTION 'Suppression interdite : le véhicule "%" (immatriculation: %) est actuellement engagé dans % contrat(s) en cours ou actif(s). Veuillez clôturer ou annuler le contrat au préalable.',
      OLD.id, OLD.plate, v_active_contract_count;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_vehicle_deletion_contracts ON public.vehicles;
CREATE TRIGGER trg_protect_vehicle_deletion_contracts
  BEFORE DELETE ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_vehicle_deletion_contracts();

-- 6. RECHARGEMENT DU CACHE DE SCHÉMA POSTGREST
NOTIFY pgrst, 'reload schema';
