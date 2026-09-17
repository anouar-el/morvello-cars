-- ==============================================================================
-- MIGRATION SÉCURITÉ ROW LEVEL SECURITY (RLS) : CLOISONNEMENT PAR MANAGER / AGENT
-- Application : Morvello Cars
-- ==============================================================================
-- Cette migration :
-- 1. Ajoute les colonnes assigned_manager_id et created_by sur clients, contracts, deposits
-- 2. Crée les index de performance B-Tree sur assigned_manager_id
-- 3. Implémente les fonctions de sécurité can_access_manager_row et can_assign_manager
-- 4. Active des politiques RLS strictes garantissant qu'aucun manager/agent ne peut
--    interroger l'API Supabase pour lire ou altérer les données d'autres managers.
-- ==============================================================================

-- 1. COLONNES & INDEX
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);

ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);

-- 2. FONCTIONS DE SÉCURITÉ (Security Definer)
CREATE OR REPLACE FUNCTION public.can_access_manager_row(row_assigned_manager_id text, row_created_by text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- 1. Les administrateurs voient l'ensemble des données
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL AND (
        -- 2. Affecté directement au manager/agent via son UID
        (row_assigned_manager_id IS NOT NULL AND row_assigned_manager_id = auth.uid()::text)
        -- 3. Ou créé par le manager/agent via son UID
        OR (row_created_by IS NOT NULL AND row_created_by = auth.uid()::text)
        -- 4. Ou correspondance avec le profil collaborateur (id interne, nom ou email)
        OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid()::text 
          AND (
            (row_assigned_manager_id IS NOT NULL AND (p.id = row_assigned_manager_id OR p.name = row_assigned_manager_id))
            OR (row_created_by IS NOT NULL AND (p.id = row_created_by OR p.name = row_created_by OR p.email = row_created_by))
          )
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_assign_manager(row_assigned_manager_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1. Un administrateur peut affecter librement
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND (
        -- 2. Non assigné
        row_assigned_manager_id IS NULL
        OR trim(row_assigned_manager_id) = ''
        -- 3. Assigné à son propre UID
        OR row_assigned_manager_id = auth.uid()::text
        -- 4. Assigné à son propre identifiant interne ou nom de profil
        OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid()::text 
          AND (
            p.id = row_assigned_manager_id
            OR p.name = row_assigned_manager_id
          )
        )
      )
    );
$$;

-- 3. POLITIQUES RLS SUR CLIENTS
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by));

DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

-- 4. POLITIQUES RLS SUR CONTRACTS
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by));

DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

-- 5. POLITIQUES RLS SUR DEPOSITS
DROP POLICY IF EXISTS "deposits_select" ON public.deposits;
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by));

DROP POLICY IF EXISTS "deposits_insert" ON public.deposits;
CREATE POLICY "deposits_insert" ON public.deposits
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

DROP POLICY IF EXISTS "deposits_update" ON public.deposits;
CREATE POLICY "deposits_update" ON public.deposits
  FOR UPDATE TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

-- 6. POLITIQUES RLS SUR VEHICLES
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );
