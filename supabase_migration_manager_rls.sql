-- ==============================================================================
-- MIGRATION SÉCURITÉ ROW LEVEL SECURITY (RLS) V2 : CLOISONNEMENT PAR MANAGER & AGENCE
-- Application : Morvello Cars
-- ==============================================================================
-- Référence canonique : supabase_migration_secure_rls_v2.sql / restore_strict_supabase_rls.sql
-- ==============================================================================

-- 1. COLONNES & INDEX
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON public.clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_contracts_agency_id ON public.contracts(agency_id);
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);

ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_deposits_agency_id ON public.deposits(agency_id);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_by ON public.deposits(created_by);

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_vehicles_agency_id ON public.vehicles(agency_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);

-- 2. FONCTIONS DE SÉCURITÉ (Security Definer)
CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(agency_id, agency, 'agency_morvello') FROM public.profiles WHERE id = auth.uid()::text),
    'agency_morvello'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_same_agency(row_agency_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() IS NOT NULL
    AND (
      row_agency_id IS NULL
      OR trim(row_agency_id) = ''
      OR row_agency_id = public.get_current_agency_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_current_manager(target_manager_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() IS NOT NULL 
    AND target_manager_id IS NOT NULL 
    AND trim(target_manager_id) <> ''
    AND (
      target_manager_id = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()::text
        AND (
          (p.local_id IS NOT NULL AND p.local_id = target_manager_id)
          OR (p.legacy_id IS NOT NULL AND p.legacy_id = target_manager_id)
          OR (p.email IS NOT NULL AND lower(p.email) = lower(target_manager_id))
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_record(
  row_assigned_manager_id text,
  row_created_by text,
  row_agency_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    auth.uid() IS NOT NULL
    AND public.is_same_agency(row_agency_id)
    AND (
      public.is_admin()
      OR public.is_current_manager(row_assigned_manager_id)
      OR public.is_current_manager(row_created_by)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_assign_manager(
  row_assigned_manager_id text,
  row_created_by text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND (
        public.is_current_manager(row_assigned_manager_id)
        OR (
          (row_assigned_manager_id IS NULL OR trim(row_assigned_manager_id) = '')
          AND row_created_by IS NOT NULL
          AND public.is_current_manager(row_created_by)
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_manager_row(row_assigned_manager_id text, row_created_by text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_record(row_assigned_manager_id, row_created_by, NULL);
$$;

-- 3. POLITIQUES RLS SUR CLIENTS
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

-- 4. POLITIQUES RLS SUR CONTRACTS
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

-- 5. POLITIQUES RLS SUR DEPOSITS
DROP POLICY IF EXISTS "deposits_select" ON public.deposits;
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

DROP POLICY IF EXISTS "deposits_insert" ON public.deposits;
CREATE POLICY "deposits_insert" ON public.deposits
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

DROP POLICY IF EXISTS "deposits_update" ON public.deposits;
CREATE POLICY "deposits_update" ON public.deposits
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

-- 6. POLITIQUES RLS SUR VEHICLES
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

NOTIFY pgrst, 'reload schema';
