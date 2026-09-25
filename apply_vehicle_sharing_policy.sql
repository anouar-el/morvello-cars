-- ==============================================================================
-- APPLICATION DE LA POLICY SÉCURISÉE SUR LA FLOTTE DE VÉHICULES
-- Script idempotent à exécuter dans le Supabase SQL Editor (https://app.supabase.com)
--
-- Objectif :
-- Cloisonnement strict des véhicules par gestionnaire et par agence.
-- Un manager ne peut lire, modifier ou supprimer que les véhicules qui lui sont
-- assignés ou qu'il a créés. Un administrateur gère l'ensemble de la flotte de son agence.
-- ==============================================================================

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicles_agency_id ON public.vehicles(agency_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;
DROP POLICY IF EXISTS "morvello_vehicles_policy" ON public.vehicles;

CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

NOTIFY pgrst, 'reload schema';
