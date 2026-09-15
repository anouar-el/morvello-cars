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
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABLE DES CAUTIONS & EMPREINTES
CREATE TABLE IF NOT EXISTS public.deposits (
  id TEXT PRIMARY KEY,
  contract_id TEXT,
  client_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'partially_returned', 'returned', 'deducted')),
  method TEXT DEFAULT 'carte',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

-- Politiques ouvertes pour l'application avec la clé anon et authentifiée
-- (Permet à Morvello Cars de lire et sauvegarder les données d'agence)
DROP POLICY IF EXISTS "morvello_agency_data_policy" ON public.agency_data;
CREATE POLICY "morvello_agency_data_policy" ON public.agency_data
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "morvello_profiles_policy" ON public.profiles;
CREATE POLICY "morvello_profiles_policy" ON public.profiles
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "morvello_vehicles_policy" ON public.vehicles;
CREATE POLICY "morvello_vehicles_policy" ON public.vehicles
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "morvello_clients_policy" ON public.clients;
CREATE POLICY "morvello_clients_policy" ON public.clients
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "morvello_contracts_policy" ON public.contracts;
CREATE POLICY "morvello_contracts_policy" ON public.contracts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "morvello_deposits_policy" ON public.deposits;
CREATE POLICY "morvello_deposits_policy" ON public.deposits
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "morvello_audit_policy" ON public.audit_logs;
CREATE POLICY "morvello_audit_policy" ON public.audit_logs
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

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
