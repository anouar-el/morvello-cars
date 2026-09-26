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
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by TEXT DEFAULT 'system'
);

ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_agency_data_agency_id ON public.agency_data(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_data_assigned_manager ON public.agency_data(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_agency_data_created_by ON public.agency_data(created_by);
CREATE INDEX IF NOT EXISTS idx_agency_data_updated_at ON public.agency_data(updated_at);

-- 3. TABLE DES PROFILS COLLABORATEURS ET RÔLES (RBAC & IDENTITÉ)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  permissions JSONB DEFAULT '{}'::jsonb,
  phone TEXT,
  agency TEXT DEFAULT 'Nouaceur Casablanca',
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_fleet_name TEXT,
  local_id TEXT,
  legacy_id TEXT,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legacy_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON public.profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_local_id ON public.profiles(local_id);
CREATE INDEX IF NOT EXISTS idx_profiles_legacy_id ON public.profiles(legacy_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- VUE SÉCURISÉE PUBLIQUE (SÉPARATION DES DONNÉES D'AUTORISATION SENSIBLES - PROBLEM #4)
CREATE OR REPLACE VIEW public.safe_profiles
WITH (security_barrier = true)
AS
SELECT
  p.id,
  p.name,
  p.email,
  p.phone,
  p.agency,
  p.agency_id,
  p.assigned_fleet_name,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE
  auth.uid() IS NOT NULL
  AND public.is_same_agency(p.agency_id);

GRANT SELECT ON public.safe_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_safe_team_members()
RETURNS TABLE (
  id text,
  name text,
  email text,
  phone text,
  agency text,
  agency_id text,
  assigned_fleet_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.phone,
    p.agency,
    p.agency_id,
    p.assigned_fleet_name
  FROM public.profiles p
  WHERE
    auth.uid() IS NOT NULL
    AND public.is_same_agency(p.agency_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_safe_team_members() TO authenticated;

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
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  approval_status TEXT DEFAULT 'approved',
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_vehicles_agency_id ON public.vehicles(agency_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);

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
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON public.clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);

-- 6. TABLE DES CONDUCTEURS (DRIVERS)
CREATE TABLE IF NOT EXISTS public.drivers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE,
  doc_type TEXT DEFAULT 'CIN',
  doc_number TEXT NOT NULL,
  driving_license TEXT,
  phone TEXT,
  email TEXT,
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_drivers_agency_id ON public.drivers(agency_id);
CREATE INDEX IF NOT EXISTS idx_drivers_assigned_manager ON public.drivers(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_drivers_created_by ON public.drivers(created_by);

-- 7. TABLE DES CONTRATS DE LOCATION
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
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_contracts_agency_id ON public.contracts(agency_id);
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);

-- 8. TABLE DES CAUTIONS & EMPREINTES (DEPOSITS)
CREATE TABLE IF NOT EXISTS public.deposits (
  id TEXT PRIMARY KEY,
  contract_id TEXT,
  client_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'partially_returned', 'returned', 'deducted')),
  method TEXT DEFAULT 'carte',
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_deposits_agency_id ON public.deposits(agency_id);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_by ON public.deposits(created_by);

-- 9. TABLE DES RÈGLEMENTS (PAYMENTS)
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  contract_id TEXT REFERENCES public.contracts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'cash',
  date DATE,
  receipt_number TEXT,
  notes TEXT,
  recorded_by TEXT,
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_agency_id ON public.payments(agency_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract_id ON public.payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_assigned_manager ON public.payments(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_by ON public.payments(created_by);

-- 10. TABLE DES DÉPENSES D'ENTRETIEN (VEHICLE_EXPENSES)
CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  cost_mad NUMERIC NOT NULL DEFAULT 0,
  date DATE,
  km_at_expense NUMERIC DEFAULT 0,
  provider TEXT,
  invoice_number TEXT,
  notes TEXT,
  recorded_by TEXT,
  agency_id TEXT DEFAULT 'agency_morvello',
  assigned_manager_id TEXT,
  created_by TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicle_expenses ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_agency_id ON public.vehicle_expenses(agency_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_vehicle_id ON public.vehicle_expenses(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_assigned_manager ON public.vehicle_expenses(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_created_by ON public.vehicle_expenses(created_by);

-- 11. TABLE D'AUDIT SÉCURISÉ (IMMUTABLE)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  details TEXT,
  agency_id TEXT DEFAULT 'agency_morvello',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
CREATE INDEX IF NOT EXISTS idx_audit_logs_agency_id ON public.audit_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);

-- ==============================================================================
-- 12. SÉCURITÉ ROW LEVEL SECURITY (RLS) & FONCTIONS D'AUTORISATION
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Fonctions utilitaires sécurisées (Security Definer avec search_path fixé à public)
CREATE OR REPLACE FUNCTION public.get_current_role()
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
    (SELECT (role = 'admin' OR legacy_id = 'usr-1' OR local_id = 'usr-1')
     FROM public.profiles
     WHERE id = auth.uid()::text),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(agency_id, agency, 'agency_morvello')
     FROM public.profiles
     WHERE id = auth.uid()::text),
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

-- Résolution dynamique de l'identité du manager (supporte UID, local_id, legacy_id, email)
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

-- Triggers de protection anti-usurpation / élévation de privilèges (PROBLEM #4)
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only administrators can change user roles.';
    END IF;
    IF NEW.local_id IS DISTINCT FROM OLD.local_id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify local_id.';
    END IF;
    IF NEW.legacy_id IS DISTINCT FROM OLD.legacy_id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify legacy_id.';
    END IF;
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Agency modification rejected: cannot change agency_id.';
    END IF;
    IF NEW.agency IS DISTINCT FROM OLD.agency THEN
      RAISE EXCEPTION 'Agency modification rejected: cannot change agency.';
    END IF;
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'Privilege escalation rejected: cannot alter permissions.';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot change primary id.';
    END IF;
  END IF;

  IF (NEW.local_id = 'usr-1' OR NEW.legacy_id = 'usr-1') 
     AND (OLD.local_id IS DISTINCT FROM 'usr-1' AND OLD.legacy_id IS DISTINCT FROM 'usr-1') THEN
    RAISE EXCEPTION 'Security violation: usr-1 identity is reserved.';
  END IF;

  IF (OLD.local_id = 'usr-1' OR OLD.legacy_id = 'usr-1' OR OLD.id = 'usr-1') 
     AND NEW.role <> 'admin' THEN
    RAISE EXCEPTION 'Security violation: primary administrator usr-1 cannot be demoted.';
  END IF;

  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_protect_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privilege_escalation();

CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  END IF;

  IF NEW.agency_id IS NULL OR trim(NEW.agency_id) = '' THEN
    NEW.agency_id := COALESCE(NEW.agency, public.get_current_agency_id());
  END IF;

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

CREATE OR REPLACE FUNCTION public.protect_profile_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Profile deletion rejected: only administrators can delete user accounts.';
  END IF;

  IF OLD.local_id = 'usr-1' OR OLD.legacy_id = 'usr-1' OR OLD.id = 'usr-1' THEN
    RAISE EXCEPTION 'Profile deletion rejected: primary administrator usr-1 cannot be deleted.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_deletion ON public.profiles;
CREATE TRIGGER trg_protect_profile_deletion
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_deletion();

-- Trigger de protection de mise à jour des véhicules (anti-usurpation & intégrité de périmètre)
CREATE OR REPLACE FUNCTION public.protect_vehicle_update_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Agency modification rejected: non-admin managers cannot change vehicle agency_id.';
    END IF;
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

-- Trigger de protection de suppression de véhicule lié à des contrats actifs
CREATE OR REPLACE FUNCTION public.protect_vehicle_deletion_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_contract_count integer;
BEGIN
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

-- Nettoyage des anciennes policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

DROP POLICY IF EXISTS "agency_data_select" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_insert" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_update" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_delete" ON public.agency_data;

DROP POLICY IF EXISTS "vehicles_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON public.vehicles;

DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;

DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete" ON public.contracts;

DROP POLICY IF EXISTS "deposits_select" ON public.deposits;
DROP POLICY IF EXISTS "deposits_insert" ON public.deposits;
DROP POLICY IF EXISTS "deposits_update" ON public.deposits;
DROP POLICY IF EXISTS "deposits_delete" ON public.deposits;

DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_update" ON public.payments;
DROP POLICY IF EXISTS "payments_delete" ON public.payments;

DROP POLICY IF EXISTS "vehicle_expenses_select" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "vehicle_expenses_insert" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "vehicle_expenses_update" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "vehicle_expenses_delete" ON public.vehicle_expenses;

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;

-- Policies PROFILES (Isolation stricte et protection RBAC - PROBLEM #4)
-- 1. Un utilisateur non-authentifié n'a AUCUN accès.
-- 2. Un administrateur de l'agence a accès à tous les profils de son agence.
-- 3. Un utilisateur standard / manager n'a accès qu'à son PROPRE profil sensible dans public.profiles.
-- 4. Pour l'annuaire de contact public de l'agence, utiliser la vue sécurisée public.safe_profiles.
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (public.is_admin() AND public.is_same_agency(agency_id))
    OR (
      auth.uid() IS NOT NULL
      AND (
        auth.uid()::text = id
        OR public.is_current_manager(local_id)
        OR public.is_current_manager(legacy_id)
        OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
      )
    )
  );

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() AND public.is_same_agency(agency_id))
    OR (
      auth.uid() IS NOT NULL
      AND auth.uid()::text = id
      AND role IN ('manager', 'agent')
      AND role <> 'admin'
      AND COALESCE(local_id, '') NOT IN ('usr-1', 'admin')
      AND COALESCE(legacy_id, '') NOT IN ('usr-1', 'admin')
      AND public.is_same_agency(agency_id)
    )
  );

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() AND public.is_same_agency(agency_id))
    OR (
      auth.uid() IS NOT NULL
      AND (
        auth.uid()::text = id
        OR public.is_current_manager(local_id)
        OR public.is_current_manager(legacy_id)
      )
      AND public.is_same_agency(agency_id)
    )
  )
  WITH CHECK (
    (public.is_admin() AND public.is_same_agency(agency_id))
    OR (
      auth.uid() IS NOT NULL
      AND (
        auth.uid()::text = id
        OR public.is_current_manager(local_id)
        OR public.is_current_manager(legacy_id)
      )
      AND public.is_same_agency(agency_id)
      AND role IN ('manager', 'agent')
      AND role <> 'admin'
      AND COALESCE(local_id, '') NOT IN ('usr-1', 'admin')
      AND COALESCE(legacy_id, '') NOT IN ('usr-1', 'admin')
    )
  );

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
    AND COALESCE(local_id, '') <> 'usr-1'
    AND COALESCE(legacy_id, '') <> 'usr-1'
    AND id <> 'usr-1'
  );

-- Policies AGENCY_DATA (Isolation stricte Agence et Périmètre Manager)
-- SÉCURITÉ ARCHITECTURALE (PROBLEM #2) :
-- 1. Un utilisateur non-authentifié n'a AUCUN accès.
-- 2. Un administrateur de l'agence a un accès complet aux lignes de son agence (lignes globales et lignes managers).
-- 3. Un manager authentifié n'a accès qu'aux lignes qui lui sont explicitement assignées (assigned_manager_id).
-- 4. Un manager ne peut ni lire ni modifier la configuration globale de l'agence (assigned_manager_id IS NULL).
-- 5. Un manager ne peut en aucun cas lire ou modifier la ligne d'un autre manager.
-- 6. Les tables normalisées sont l'unique source de vérité pour les entités métier (véhicules, clients, contrats, cautions).
CREATE POLICY "agency_data_select" ON public.agency_data
  FOR SELECT TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_access_manager_row(assigned_manager_id, COALESCE(created_by, updated_by))
      )
    )
  );

CREATE POLICY "agency_data_insert" ON public.agency_data
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_assign_manager(assigned_manager_id)
      )
    )
  );

CREATE POLICY "agency_data_update" ON public.agency_data
  FOR UPDATE TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_access_manager_row(assigned_manager_id, COALESCE(created_by, updated_by))
      )
    )
  )
  WITH CHECK (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_assign_manager(assigned_manager_id)
      )
    )
  );

CREATE POLICY "agency_data_delete" ON public.agency_data
  FOR DELETE TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_access_manager_row(assigned_manager_id, COALESCE(created_by, updated_by))
      )
    )
  );

-- Policies CLIENTS
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "clients_insert" ON public.clients
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "clients_delete" ON public.clients
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

-- Policies DRIVERS
CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "drivers_insert" ON public.drivers
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "drivers_update" ON public.drivers
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "drivers_delete" ON public.drivers
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

-- Policies VEHICLES
CREATE POLICY "vehicles_select" ON public.vehicles
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- Policies CONTRACTS
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "contracts_insert" ON public.contracts
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "contracts_update" ON public.contracts
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "contracts_delete" ON public.contracts
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

-- Policies DEPOSITS
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "deposits_insert" ON public.deposits
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "deposits_update" ON public.deposits
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "deposits_delete" ON public.deposits
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

-- Policies PAYMENTS
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

-- Policies VEHICLE_EXPENSES
CREATE POLICY "vehicle_expenses_select" ON public.vehicle_expenses
  FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

CREATE POLICY "vehicle_expenses_insert" ON public.vehicle_expenses
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "vehicle_expenses_update" ON public.vehicle_expenses
  FOR UPDATE TO authenticated 
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id))
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.can_assign_manager(assigned_manager_id, created_by)
  );

CREATE POLICY "vehicle_expenses_delete" ON public.vehicle_expenses
  FOR DELETE TO authenticated 
  USING (
    public.can_access_record(assigned_manager_id, created_by, agency_id)
    AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by))
  );

-- Policies AUDIT_LOGS (Immuable)
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated 
  USING (
    public.is_same_agency(agency_id)
    AND (public.is_admin() OR public.is_current_manager(user_id))
  );

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_same_agency(agency_id)
    AND public.is_current_manager(user_id)
  );

CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE TO authenticated 
  USING (false);

CREATE POLICY "audit_logs_delete" ON public.audit_logs
  FOR DELETE TO authenticated 
  USING (public.is_admin() AND public.is_same_agency(agency_id));

-- ==============================================================================
-- 13. ACTIVATION DE LA RÉPLICATION TEMPS-RÉEL (SUPABASE REALTIME)
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

  -- Publication des tables normalisées pour la réplication temps-réel sécurisée
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vehicles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contracts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deposits') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
  END IF;
END $$;

-- Enregistrement initial d'un document d'agence par défaut si absent
INSERT INTO public.agency_data (id, agency_id, data, updated_at, updated_by)
VALUES ('morvello_main', 'agency_morvello', '{"initialized": true}'::jsonb, now(), 'morvello_setup')
ON CONFLICT (id) DO NOTHING;

-- Nettoyage de sécurité : Retrait strict des entités opérationnelles sensibles du JSONB agency_data
-- Les tables normalisées (vehicles, clients, contracts, deposits) sont l'unique source de vérité.
UPDATE public.agency_data
SET data = data - 'clients' - 'contracts' - 'vehicles' - 'deposits' - 'drivers' - 'payments' - 'vehicleExpenses'
WHERE id = 'morvello_main' AND data IS NOT NULL;

-- ==============================================================================
-- 14. BOOTSTRAP DU PREMIER ADMINISTRATEUR
-- ==============================================================================
INSERT INTO public.profiles (id, email, name, role, agency, agency_id, local_id, legacy_id)
SELECT 
  id::text, 
  email, 
  'Anouar', 
  'admin', 
  'Nouaceur Casablanca',
  'agency_morvello',
  'usr-1',
  'usr-1'
FROM auth.users 
WHERE email = 'anouar7fac@gmail.com'
ON CONFLICT (id) 
DO UPDATE SET role = 'admin', name = 'Anouar', local_id = 'usr-1', legacy_id = 'usr-1';

-- ==============================================================================
-- 15. FONCTION TRANSACTIONNELLE DE CRÉATION DE CONTRAT (PROBLEM #8)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_contracts_vehicle_dates_status 
ON public.contracts(vehicle_id, start_date, end_date, status);

CREATE INDEX IF NOT EXISTS idx_contracts_client_id 
ON public.contracts(client_id);

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

  v_agency_id := COALESCE(v_caller.agency_id, v_caller.agency, 'agency_morvello');
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
    -- Le client n'existe pas encore en base : le créer atomiquement si les informations sont fournies
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
    -- Client existant : vérifier l'agence et incrémenter le compteur de contrats
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
    status,
    client_id,
    vehicle_id,
    start_date,
    end_date,
    total_amount,
    deposit_amount,
    agency_id,
    assigned_manager_id,
    created_by,
    data,
    created_at,
    updated_at
  ) VALUES (
    v_contract_id,
    v_contract_number,
    v_status,
    v_client_id,
    v_vehicle_id,
    v_start_date,
    v_end_date,
    v_total_amount,
    v_deposit_amount,
    v_agency_id,
    v_assigned_manager_id,
    v_created_by,
    p_contract,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    contract_number = EXCLUDED.contract_number,
    status = EXCLUDED.status,
    client_id = EXCLUDED.client_id,
    vehicle_id = EXCLUDED.vehicle_id,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    total_amount = EXCLUDED.total_amount,
    deposit_amount = EXCLUDED.deposit_amount,
    data = EXCLUDED.data,
    updated_at = timezone('utc'::text, now());

  -- 8. ENREGISTREMENT ATOMIQUE DE LA CAUTION (SI PRÉSENTE)
  IF p_deposit IS NOT NULL AND COALESCE((p_deposit->>'amount')::numeric, 0) > 0 THEN
    v_deposit_id := COALESCE(p_deposit->>'id', 'dep-' || gen_random_uuid());
    INSERT INTO public.deposits (
      id,
      contract_id,
      client_name,
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
      COALESCE(p_deposit->>'clientName', v_client.first_name || ' ' || v_client.last_name),
      (p_deposit->>'amount')::numeric,
      COALESCE(p_deposit->>'status', 'pending'),
      COALESCE(p_deposit->>'method', 'carte'),
      v_agency_id,
      COALESCE(p_deposit->>'assignedManagerId', v_vehicle.assigned_manager_id, v_auth_uid::text),
      v_auth_uid::text,
      p_deposit,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      amount = EXCLUDED.amount,
      status = EXCLUDED.status,
      updated_at = timezone('utc'::text, now());
  END IF;

  -- 9. ENREGISTREMENT ATOMIQUE DES PAIEMENTS INITIAUX (SI FOURNIS)
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) = 'array' AND jsonb_array_length(p_payments) > 0 THEN
    FOR v_payment_item IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_payment_id := COALESCE(v_payment_item->>'id', 'pay-' || gen_random_uuid());
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
        v_contract_id,
        COALESCE((v_payment_item->>'amount')::numeric, 0),
        COALESCE(v_payment_item->>'method', 'cash'),
        COALESCE((v_payment_item->>'date')::date, CURRENT_DATE),
        COALESCE(v_payment_item->>'receiptNumber', v_payment_item->>'receipt_number', NULL),
        COALESCE(v_payment_item->>'notes', NULL),
        COALESCE(v_payment_item->>'recordedBy', v_caller.name, 'Collaborateur'),
        v_agency_id,
        COALESCE(v_payment_item->>'assignedManagerId', v_vehicle.assigned_manager_id, v_auth_uid::text),
        v_auth_uid::text,
        v_payment_item,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  -- 10. MISE À JOUR DE L'ÉTAT DU VÉHICULE
  IF v_status = 'active' THEN
    UPDATE public.vehicles
    SET status = 'rented',
        current_km = GREATEST(current_km, v_departure_km),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_vehicle_id;
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

  -- 12. RETOUR TRANSACTIONNEL COMPLET
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract_id,
    'contract_number', v_contract_number,
    'client_id', v_client_id,
    'vehicle_id', v_vehicle_id,
    'deposit_id', v_deposit_id,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_contract_transactional(jsonb, jsonb, text, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_contract_transactional(jsonb, jsonb, text, jsonb, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_contract_transactional(jsonb, jsonb, text, jsonb, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

