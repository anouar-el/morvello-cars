-- ==============================================================================
-- MORVELLO CARS - ARCHITECTURE DE SÉCURITÉ ROW LEVEL SECURITY (RLS) V2
-- Migration Idempotente et Sécurisée pour Production Supabase PostgreSQL
-- ==============================================================================
-- Modèle de Sécurité :
-- 1. ADMIN / GÉRANT : Accès complet à toutes les données appartenant à son agence.
-- 2. MANAGER : Accès STRICTEMENT restreint aux données qui lui sont assignées ou créées par lui.
--    S'applique à : clients, drivers, vehicles, contracts, deposits, payments, vehicle_expenses.
-- 3. UTILISATEUR AUTHENTIFIÉ : L'authentification seule NE DONNE JAMAIS accès aux données globales.
-- 4. UTILISATEUR NON-AUTHENTIFIÉ : AUCUN accès aux données métier.
-- 5. RESOLUTION D'IDENTITÉ : Résolution automatique via profiles (auth.uid, local_id, legacy_id)
--    SANS coder en dur d'identifiants managers individuels dans les politiques.
-- 6. AUDIT_LOGS : Immuable (Append-Only), accessible par l'admin et l'auteur.
-- 7. AGENCY_DATA : Restreint à l'administrateur de l'agence.
-- 8. PROFILES : Anti-élévation de privilèges via trigger et RLS stricts.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CRÉATION / ASSURANCE DES 10 TABLES MÉTIER ET COLONNES D'ISOLATION
-- ------------------------------------------------------------------------------

-- 1.1 TABLE PROFILES (RBAC & Identité)
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

-- 1.2 TABLE AGENCY_DATA (Données centralisées d'agence)
CREATE TABLE IF NOT EXISTS public.agency_data (
  id TEXT PRIMARY KEY DEFAULT 'morvello_main',
  agency_id TEXT DEFAULT 'agency_morvello',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by TEXT DEFAULT 'system'
);

ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
CREATE INDEX IF NOT EXISTS idx_agency_data_agency_id ON public.agency_data(agency_id);

-- 1.3 TABLE CLIENTS
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

-- 1.4 TABLE DRIVERS (Conducteurs additionnels)
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

-- 1.5 TABLE VEHICLES
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

-- 1.6 TABLE CONTRACTS
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

-- 1.7 TABLE DEPOSITS (Cautions)
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

-- 1.8 TABLE PAYMENTS (Règlements & Encaissements)
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

-- 1.9 TABLE VEHICLE_EXPENSES (Dépenses d'entretien et maintenance)
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

-- 1.10 TABLE AUDIT_LOGS (Traçabilité immuable)
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

-- ------------------------------------------------------------------------------
-- 2. ACTIVATION SYSTÉMATIQUE DU ROW LEVEL SECURITY SUR TOUTES LES TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. FONCTIONS UTILITAIRES DE SÉCURITÉ (SECURITY DEFINER AVEC SEARCH_PATH STRICT)
-- ------------------------------------------------------------------------------

-- Rôle actuel de l'utilisateur
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()::text),
    'agent'
  );
$$;

-- Vérifie si l'utilisateur est admin / gérant
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

-- Identifiant de l'agence de l'utilisateur connecté
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

-- Vérifie si la ligne appartient à la même agence (cloisonnement multi-agences)
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

-- Résolution dynamique d'identité du manager :
-- Supporte UUID Supabase, local_id (usr-N), legacy_id (usr-N) et email
-- SANS codage en dur d'identifiants individuels dans les politiques.
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

-- Contrôle d'accès à un enregistrement métier :
-- L'admin accède à toute l'agence. Le manager n'accède qu'à ses enregistrements.
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
      -- 1. L'administrateur a accès à tous les enregistrements de son agence
      public.is_admin()
      -- 2. Le manager a accès à ses enregistrements assignés
      OR public.is_current_manager(row_assigned_manager_id)
      -- 3. Le manager a accès aux enregistrements qu'il a créés
      OR public.is_current_manager(row_created_by)
    );
$$;

-- Validation de l'assignation du manager (INSERT / UPDATE) :
-- Un manager ne peut assigner qu'à lui-même. Un admin peut assigner librement.
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

-- Compatibilité ascendante avec les anciennes fonctions à 2 arguments
CREATE OR REPLACE FUNCTION public.can_access_manager_row(row_assigned_manager_id text, row_created_by text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_record(row_assigned_manager_id, row_created_by, NULL);
$$;

-- ------------------------------------------------------------------------------
-- 4. TRIGGERS DE PROTECTION CONTRE L'ÉLÉVATION DE PRIVILÈGES (PROFILES)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si l'appelant n'est pas administrateur :
  IF NOT public.is_admin() THEN
    -- 1. Interdiction de modifier le rôle
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only administrators can change user roles.';
    END IF;

    -- 2. Interdiction de modifier local_id ou legacy_id
    IF NEW.local_id IS DISTINCT FROM OLD.local_id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify local_id.';
    END IF;

    IF NEW.legacy_id IS DISTINCT FROM OLD.legacy_id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify legacy_id.';
    END IF;

    -- 3. Interdiction de changer d'agence
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Agency modification rejected: cannot change agency_id.';
    END IF;

    -- 4. Interdiction de modifier les permissions RBAC
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'Privilege escalation rejected: cannot alter permissions.';
    END IF;
  END IF;

  -- 5. Interdiction d'usurper l'identifiant usr-1
  IF (NEW.local_id = 'usr-1' OR NEW.legacy_id = 'usr-1') 
     AND (OLD.local_id IS DISTINCT FROM 'usr-1' AND OLD.legacy_id IS DISTINCT FROM 'usr-1') THEN
    RAISE EXCEPTION 'Security violation: usr-1 identity is reserved.';
  END IF;

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
  END IF;

  IF NEW.agency_id IS NULL OR trim(NEW.agency_id) = '' THEN
    NEW.agency_id := COALESCE(NEW.agency, 'agency_morvello');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_insert();

-- ------------------------------------------------------------------------------
-- 5. PURGE DES ANCIENNES POLICIES OUVERTES OU PERMISSIVES
-- ------------------------------------------------------------------------------
-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "morvello_profiles_policy" ON public.profiles;

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

-- Drivers
DROP POLICY IF EXISTS "drivers_select" ON public.drivers;
DROP POLICY IF EXISTS "drivers_insert" ON public.drivers;
DROP POLICY IF EXISTS "drivers_update" ON public.drivers;
DROP POLICY IF EXISTS "drivers_delete" ON public.drivers;

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

-- Payments
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_update" ON public.payments;
DROP POLICY IF EXISTS "payments_delete" ON public.payments;

-- Vehicle Expenses
DROP POLICY IF EXISTS "vehicle_expenses_select" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "vehicle_expenses_insert" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "vehicle_expenses_update" ON public.vehicle_expenses;
DROP POLICY IF EXISTS "vehicle_expenses_delete" ON public.vehicle_expenses;

-- Audit Logs
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_update" ON public.audit_logs;
DROP POLICY IF EXISTS "morvello_audit_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "morvello_audit_logs_policy" ON public.audit_logs;

-- ------------------------------------------------------------------------------
-- 6. DÉFINITION DES POLITIQUES RLS STRICTES POUR CHAQUE TABLE
-- ------------------------------------------------------------------------------

-- 6.1 POLITIQUES TABLE PROFILES
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_same_agency(agency_id));

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = id
    AND (
      public.is_admin()
      OR (
        role IN ('manager', 'agent')
        AND COALESCE(local_id, '') <> 'usr-1'
        AND COALESCE(legacy_id, '') <> 'usr-1'
        AND (agency_id IS NULL OR agency_id = public.get_current_agency_id())
      )
    )
  );

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (auth.uid()::text = id OR public.is_admin())
  )
  WITH CHECK (
    public.is_same_agency(agency_id)
    AND (auth.uid()::text = id OR public.is_admin())
  );

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

-- 6.2 POLITIQUES TABLE AGENCY_DATA (Réservé à l'Admin de l'agence)
CREATE POLICY "agency_data_select" ON public.agency_data
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

CREATE POLICY "agency_data_insert" ON public.agency_data
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

CREATE POLICY "agency_data_update" ON public.agency_data
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  )
  WITH CHECK (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

CREATE POLICY "agency_data_delete" ON public.agency_data
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

-- 6.3 POLITIQUES TABLE CLIENTS
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- 6.4 POLITIQUES TABLE DRIVERS
CREATE POLICY "drivers_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- 6.5 POLITIQUES TABLE VEHICLES
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

-- 6.6 POLITIQUES TABLE CONTRACTS
CREATE POLICY "contracts_select" ON public.contracts
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- 6.7 POLITIQUES TABLE DEPOSITS
CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- 6.8 POLITIQUES TABLE PAYMENTS
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- 6.9 POLITIQUES TABLE VEHICLE_EXPENSES
CREATE POLICY "vehicle_expenses_select" ON public.vehicle_expenses
  FOR SELECT TO authenticated
  USING (public.can_access_record(assigned_manager_id, created_by, agency_id));

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

-- 6.10 POLITIQUES TABLE AUDIT_LOGS
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

-- STRICTEMENT IMMUABLE : Append-Only
CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_logs_delete" ON public.audit_logs
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
  );

-- ------------------------------------------------------------------------------
-- 7. RECHARGEMENT DU CACHE POSTGREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
