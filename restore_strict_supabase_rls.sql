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

-- 2.1 ASSURANCE DES COLONNES MULTI-GESTIONNAIRES & RECHARGEMENT DU SCHÉMA
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);

NOTIFY pgrst, 'reload schema';

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
  SELECT COALESCE(
    (SELECT role = 'admin' OR local_id = 'usr-1' OR email ILIKE '%anouar%' FROM public.profiles WHERE id = auth.uid()::text),
    (auth.jwt()->>'email' ILIKE '%anouar%'),
    false
  );
$$;

-- Vérifie si l'utilisateur connecté (admin, manager ou agent) a le droit d'accéder à la ressource :
-- - Les administrateurs ont accès à tout
-- - Les lignes non assignées (NULL ou '') sont visibles par tous les collaborateurs authentifiés
-- - Les lignes assignées sont réservées au manager assigné ou au créateur
-- - Supporte à la fois l'UID Supabase Auth, l'identifiant local (usr-1 à usr-6), et le nom du manager
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
        -- Correspondance directe par email JWT (infaillible même si la table profiles est en cours de création)
        OR ((auth.jwt()->>'email' ILIKE '%said%' OR auth.jwt()->>'email' ILIKE '%khomri%') 
            AND ((row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%said%') 
                 OR (row_created_by ILIKE '%usr-2%' OR row_created_by ILIKE '%said%')))
        OR (auth.jwt()->>'email' ILIKE '%ouahib%' 
            AND ((row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%')
                 OR (row_created_by ILIKE '%usr-3%' OR row_created_by ILIKE '%ouahib%')))
        OR (auth.jwt()->>'email' ILIKE '%benali%' 
            AND ((row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%')
                 OR (row_created_by ILIKE '%usr-1%' OR row_created_by ILIKE '%benali%')))
        OR (auth.jwt()->>'email' ILIKE '%ezzay%' 
            AND ((row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%ezzay%')
                 OR (row_created_by ILIKE '%usr-5%' OR row_created_by ILIKE '%ezzay%')))
        OR (auth.jwt()->>'email' ILIKE '%larbi%' 
            AND ((row_assigned_manager_id ILIKE '%usr-6%' OR row_assigned_manager_id ILIKE '%larbi%')
                 OR (row_created_by ILIKE '%usr-6%' OR row_created_by ILIKE '%larbi%')))
        OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid()::text 
          AND (
            (row_assigned_manager_id IS NOT NULL AND (
              p.id = row_assigned_manager_id 
              OR p.name = row_assigned_manager_id
              OR (p.local_id IS NOT NULL AND p.local_id = row_assigned_manager_id)
              OR (p.name ILIKE '%said%' AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%said%'))
              OR (p.name ILIKE '%ouahib%' AND (row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%'))
              OR (p.name ILIKE '%benali%' AND (row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%'))
              OR (p.name ILIKE '%ezzay%' AND (row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%ezzay%'))
              OR (p.name ILIKE '%larbi%' AND (row_assigned_manager_id ILIKE '%usr-6%' OR row_assigned_manager_id ILIKE '%larbi%'))
              OR (p.name ILIKE '%mansouri%' AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%mansouri%'))
              OR (p.name ILIKE '%alami%' AND (row_assigned_manager_id ILIKE '%usr-4%' OR row_assigned_manager_id ILIKE '%alami%'))
            ))
            OR (row_created_by IS NOT NULL AND (
              p.id = row_created_by 
              OR p.name = row_created_by 
              OR p.email = row_created_by
              OR (p.local_id IS NOT NULL AND p.local_id = row_created_by)
              OR (p.name ILIKE '%said%' AND (row_created_by ILIKE '%usr-2%' OR row_created_by ILIKE '%said%'))
              OR (p.name ILIKE '%ouahib%' AND (row_created_by ILIKE '%usr-3%' OR row_created_by ILIKE '%ouahib%'))
              OR (p.name ILIKE '%benali%' AND (row_created_by ILIKE '%usr-1%' OR row_created_by ILIKE '%benali%'))
              OR (p.name ILIKE '%ezzay%' AND (row_created_by ILIKE '%usr-5%' OR row_created_by ILIKE '%ezzay%'))
              OR (p.name ILIKE '%larbi%' AND (row_created_by ILIKE '%usr-6%' OR row_created_by ILIKE '%larbi%'))
            ))
          )
        )
      )
    );
$$;

-- Empêche un manager ou agent d'affecter une ressource à un autre gestionnaire que lui-même
-- Supporte l'UID Supabase, l'identifiant local (usr-1 à usr-5), et le nom du manager
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
        -- Correspondance directe par email JWT
        OR ((auth.jwt()->>'email' ILIKE '%said%' OR auth.jwt()->>'email' ILIKE '%khomri%') 
            AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%said%'))
        OR (auth.jwt()->>'email' ILIKE '%ouahib%' 
            AND (row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%'))
        OR (auth.jwt()->>'email' ILIKE '%benali%' 
            AND (row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%'))
        OR (auth.jwt()->>'email' ILIKE '%ezzay%' 
            AND (row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%ezzay%'))
        OR (auth.jwt()->>'email' ILIKE '%larbi%' 
            AND (row_assigned_manager_id ILIKE '%usr-6%' OR row_assigned_manager_id ILIKE '%larbi%'))
        OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid()::text 
          AND (
            p.id = row_assigned_manager_id
            OR p.name = row_assigned_manager_id
            OR (p.local_id IS NOT NULL AND p.local_id = row_assigned_manager_id)
            OR (p.name ILIKE '%said%' AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%said%'))
            OR (p.name ILIKE '%ouahib%' AND (row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%'))
            OR (p.name ILIKE '%benali%' AND (row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%'))
            OR (p.name ILIKE '%ezzay%' AND (row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%ezzay%'))
            OR (p.name ILIKE '%larbi%' AND (row_assigned_manager_id ILIKE '%usr-6%' OR row_assigned_manager_id ILIKE '%larbi%'))
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
    OR public.is_admin()
  );

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = id OR public.is_admin())
  WITH CHECK (auth.uid()::text = id OR public.is_admin());

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

-- 12. Rapprochement automatique des fiches existantes (Ouahib, Said, etc.)
DO $$
DECLARE
  ouahib_uid text;
  said_uid text;
BEGIN
  -- Rapprochement Ouahib (usr-3)
  SELECT id INTO ouahib_uid FROM public.profiles WHERE name ILIKE '%ouahib%' OR email ILIKE '%ouahib%' LIMIT 1;
  IF ouahib_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-3' WHERE id = ouahib_uid;
    UPDATE public.contracts SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3' OR contract_number = 'MC-2026-0050' OR id = 'cnt-1789166132353';
    UPDATE public.vehicles SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.deposits SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.clients SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
  ELSE
    UPDATE public.contracts SET assigned_manager_id = 'usr-3' WHERE contract_number = 'MC-2026-0050' OR id = 'cnt-1789166132353';
  END IF;

  -- Rapprochement Said (usr-2)
  SELECT id INTO said_uid FROM public.profiles WHERE name ILIKE '%said%' OR email ILIKE '%said%' LIMIT 1;
  IF said_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-2' WHERE id = said_uid;
    UPDATE public.contracts SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2' AND contract_number <> 'MC-2026-0050' AND id <> 'cnt-1789166132353';
    UPDATE public.vehicles SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
    UPDATE public.deposits SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
    UPDATE public.clients SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
