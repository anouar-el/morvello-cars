-- ==============================================================================
-- MORVELLO CARS - SCHÉMA DE BASE DE DONNÉES SUPABASE (POSTGRESQL)
-- Ce script configure les tables, permissions RLS et réplication temps-réel.
-- Exécutez ce script dans Supabase : SQL Editor > New Query > Coller > Run
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE PRINCIPALE D'ÉTAT D'AGENCE (MULTI-POSTES EN TEMPS RÉEL)
CREATE TABLE IF NOT EXISTS public.agency_data (
  id TEXT PRIMARY KEY DEFAULT 'morvello_main',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by TEXT DEFAULT 'system'
);

-- Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_agency_data_updated_at ON public.agency_data(updated_at);

-- 3. TABLE DES PROFILS COLLABORATEURS ET RÔLES (RBAC)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Peut être l'UUID Supabase Auth ou l'identifiant interne
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  permissions JSONB DEFAULT '{}'::jsonb,
  phone TEXT,
  agency TEXT DEFAULT 'Nouaceur Casablanca',
  assigned_fleet_name TEXT,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE DES VÉHICULES
CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  plate TEXT NOT NULL,
  fuel_type TEXT DEFAULT 'Diesel',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'maintenance', 'inactive')),
  current_km NUMERIC NOT NULL DEFAULT 0,
  daily_rate NUMERIC DEFAULT 0,
  assigned_manager_id TEXT,
  approval_status TEXT DEFAULT 'approved',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABLE DES CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  doc_type TEXT DEFAULT 'CIN',
  doc_number TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  contract_count INTEGER DEFAULT 0,
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migration idempotente colonnes & index clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);

-- 6. TABLE DES CONTRATS DE LOCATION
CREATE TABLE IF NOT EXISTS public.contracts (
  id TEXT PRIMARY KEY,
  contract_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  total_amount NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migration idempotente colonnes & index contrats
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);

-- 7. TABLE DES CAUTIONS & EMPREINTES
CREATE TABLE IF NOT EXISTS public.deposits (
  id TEXT PRIMARY KEY,
  contract_id TEXT,
  client_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'partially_returned', 'returned', 'deducted')),
  method TEXT DEFAULT 'carte',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migration idempotente colonnes & index cautions
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_by ON public.deposits(created_by);

-- Migration idempotente colonnes & index véhicules
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);

-- 8. TABLE D'AUDIT SÉCURISÉ (IMMUTABLE)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 9. SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.agency_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Fonctions utilitaires sécurisées pour l'accès aux rôles (Security Definer)
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

-- Vérifie si l'utilisateur connecté (admin, manager ou agent) a le droit de lire une ressource
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

-- Empêche un manager ou agent d'assigner une ligne à un autre manager que lui-même
CREATE OR REPLACE FUNCTION public.can_assign_manager(row_assigned_manager_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1. Un administrateur peut affecter librement à n'importe quel manager ou laisser non affecté
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND (
        -- 2. Non assigné (NULL ou vide)
        row_assigned_manager_id IS NULL
        OR trim(row_assigned_manager_id) = ''
        -- 3. Assigné à son propre UID Supabase Auth
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

-- Nettoyage des anciennes policies permissives
DROP POLICY IF EXISTS "morvello_agency_data_policy" ON public.agency_data;
DROP POLICY IF EXISTS "morvello_profiles_policy" ON public.profiles;
DROP POLICY IF EXISTS "morvello_vehicles_policy" ON public.vehicles;
DROP POLICY IF EXISTS "morvello_clients_policy" ON public.clients;
DROP POLICY IF EXISTS "morvello_contracts_policy" ON public.contracts;
DROP POLICY IF EXISTS "morvello_deposits_policy" ON public.deposits;
DROP POLICY IF EXISTS "morvello_audit_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "morvello_audit_logs_policy" ON public.audit_logs;

-- Policies PROFILES
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = id 
    AND (role = 'agent' OR public.is_admin())
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = id OR public.is_admin())
  WITH CHECK (
    CASE 
      WHEN public.is_admin() THEN true
      ELSE (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()::text))
    END
  );

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- Policies AUDIT_LOGS (Append-Only)
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Policies CLIENTS (Lecture et écriture synchronisée)
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO anon, authenticated 
  USING (true);

DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO anon, authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO anon, authenticated 
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "clients_delete" ON public.clients;
CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE TO anon, authenticated 
  USING (true);

-- Policies CONTRACTS (Cloisonnement Manager & Agent par RLS)
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

DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;
CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE TO authenticated USING (public.is_admin());

-- Policies DEPOSITS (Cloisonnement Manager & Agent par RLS)
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

DROP POLICY IF EXISTS "deposits_delete" ON public.deposits;
CREATE POLICY "deposits_delete" ON public.deposits
  FOR DELETE TO authenticated USING (public.is_admin());

-- Policies VEHICLES
DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated USING (true);

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

DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;
CREATE POLICY "vehicles_delete" ON public.vehicles
  FOR DELETE TO authenticated USING (public.is_admin());

-- Policies AGENCY_DATA (Accessible en lecture et écriture synchronisée multi-postes)
DROP POLICY IF EXISTS "agency_data_select" ON public.agency_data;
CREATE POLICY "agency_data_select" ON public.agency_data
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "agency_data_insert" ON public.agency_data;
CREATE POLICY "agency_data_insert" ON public.agency_data
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "agency_data_update" ON public.agency_data;
CREATE POLICY "agency_data_update" ON public.agency_data
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "agency_data_delete" ON public.agency_data;
CREATE POLICY "agency_data_delete" ON public.agency_data
  FOR DELETE TO anon, authenticated USING (public.is_admin());

-- ==============================================================================
-- 10. ACTIVATION DE LA RÉPLICATION TEMPS-RÉEL (SUPABASE REALTIME)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'agency_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_data;
  END IF;
END $$;

-- Enregistrement initial d'un document d'agence par défaut si absent
INSERT INTO public.agency_data (id, data, updated_at, updated_by)
VALUES ('morvello_main', '{"initialized": true}'::jsonb, now(), 'morvello_setup')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 11. BOOTSTRAP DU PREMIER ADMINISTRATEUR
-- Si l'utilisateur anouar7fac@gmail.com existe déjà dans auth.users, il reçoit le rôle 'admin'.
-- ==============================================================================
INSERT INTO public.profiles (id, email, name, role, agency)
SELECT 
  id::text, 
  email, 
  'Anouar', 
  'admin', 
  'Nouaceur Casablanca'
FROM auth.users 
WHERE email = 'anouar7fac@gmail.com'
ON CONFLICT (id) 
DO UPDATE SET role = 'admin', name = 'Anouar';
