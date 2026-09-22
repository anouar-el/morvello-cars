-- ==============================================================================
-- RESTAURATION STRICTE DE LA SÉCURITÉ ROW LEVEL SECURITY (RLS) - MORVELLO CARS
-- Script idempotent à exécuter dans le Supabase SQL Editor.
--
-- 1. Neutralise définitivement les fonctions SECURITY DEFINER contournant le RLS
-- 2. Supprime toutes les policies permissives / ouvertes (TO anon)
-- 3. Rétablit l'isolation stricte par gestionnaire (RBAC & multi-tenant)
-- ==============================================================================

-- 1. SUPPRESSION DES FONCTIONS DE CONTOURNEMENT RLS (SECURITY DEFINER DANGEREUSES)
DROP FUNCTION IF EXISTS public.sync_agency_state(jsonb, text);
DROP FUNCTION IF EXISTS public.sync_agency_state(jsonb);
DROP FUNCTION IF EXISTS public.sync_agency_state();
DROP FUNCTION IF EXISTS public.sync_client_record(jsonb);
DROP FUNCTION IF EXISTS public.sync_client_record();

-- 2. ACTIVATION STRICTE DU ROW LEVEL SECURITY SUR TOUTES LES TABLES
ALTER TABLE public.agency_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. FONCTIONS D'ACCÈS SÉCURISÉES (FONCTIONS UTILITAIRES SANS BYPASS)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()::text), 'agent');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()::text), false);
$$;

-- Vérifie si l'utilisateur connecté (admin, manager ou agent) a le droit d'accéder à la ressource :
-- - Les administrateurs ont accès à tout
-- - Les lignes non assignées (NULL ou '') sont visibles par tous les collaborateurs authentifiés
-- - Les lignes assignées sont réservées au manager assigné ou au créateur
CREATE OR REPLACE FUNCTION public.can_access_manager_row(row_assigned_manager_id text, row_created_by text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL AND (
        row_assigned_manager_id IS NULL
        OR trim(row_assigned_manager_id) = ''
        OR (row_assigned_manager_id = auth.uid()::text)
        OR (row_created_by IS NOT NULL AND row_created_by = auth.uid()::text)
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

-- Empêche un manager ou agent d'affecter une ressource à un autre gestionnaire que lui-même
CREATE OR REPLACE FUNCTION public.can_assign_manager(row_assigned_manager_id text)
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
        row_assigned_manager_id IS NULL
        OR trim(row_assigned_manager_id) = ''
        OR row_assigned_manager_id = auth.uid()::text
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

-- 4. PURGE DE TOUTES LES ANCIENNES POLICIES (PERMISSIVES ET ANCIENNES VERSIONS)
-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "morvello_profiles_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- Agency Data
DROP POLICY IF EXISTS "agency_data_select" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_insert" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_update" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_delete" ON public.agency_data;
DROP POLICY IF EXISTS "morvello_agency_data_policy" ON public.agency_data;

-- Vehicles
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;
DROP POLICY IF EXISTS "morvello_vehicles_policy" ON public.vehicles;

-- Clients
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;
DROP POLICY IF EXISTS "morvello_clients_policy" ON public.clients;

-- Contracts
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
DROP POLICY IF EXISTS "morvello_contracts_policy" ON public.contracts;

-- Deposits
DROP POLICY IF EXISTS "deposits_select" ON public.deposits;
DROP POLICY IF EXISTS "deposits_insert" ON public.deposits;
DROP POLICY IF EXISTS "deposits_update" ON public.deposits;
DROP POLICY IF EXISTS "deposits_delete" ON public.deposits;
DROP POLICY IF EXISTS "morvello_deposits_policy" ON public.deposits;

-- Audit Logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "morvello_audit_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "morvello_audit_logs_policy" ON public.audit_logs;

-- 5. POLICIES STRICTES : PROFILES (Réservé aux utilisateurs authentifiés)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = id 
    AND (role = 'agent' OR public.is_admin())
  );

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = id OR public.is_admin())
  WITH CHECK (
    CASE 
      WHEN public.is_admin() THEN true
      ELSE (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()::text))
    END
  );

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 6. POLICIES STRICTES : AGENCY_DATA (Uniquement utilisateurs authentifiés)
CREATE POLICY "agency_data_select" ON public.agency_data
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "agency_data_insert" ON public.agency_data
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "agency_data_update" ON public.agency_data
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL) 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "agency_data_delete" ON public.agency_data
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 7. POLICIES STRICTES : VEHICLES
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "vehicles_insert" ON public.vehicles
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 8. POLICIES STRICTES : CLIENTS (Isolation par gestionnaire)
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by));

CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 9. POLICIES STRICTES : CONTRACTS (Isolation par gestionnaire)
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by));

CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 10. POLICIES STRICTES : DEPOSITS (Isolation par gestionnaire)
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by));

CREATE POLICY "deposits_insert" ON public.deposits
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "deposits_update" ON public.deposits
  FOR UPDATE TO authenticated 
  USING (public.can_access_manager_row(assigned_manager_id, created_by))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.can_assign_manager(assigned_manager_id)
  );

CREATE POLICY "deposits_delete" ON public.deposits
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 11. POLICIES STRICTES : AUDIT_LOGS (Append-Only)
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);
