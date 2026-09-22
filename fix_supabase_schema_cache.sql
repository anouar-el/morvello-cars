-- ==============================================================================
-- RÉSOLUTION DU PROBLÈME DE SCHÉMA POSTGREST (PGRST204) - MORVELLO CARS
-- Exécutez ce script dans le Supabase SQL Editor (https://app.supabase.com)
--
-- Ce script :
-- 1. Ajoute les colonnes manquantes (assigned_manager_id & created_by) sur
--    toutes les tables si elles n'existent pas encore.
-- 2. Crée les index de performance pour l'isolation multi-gestionnaires.
-- 3. Force le rechargement immédiat du cache de schéma de PostgREST via NOTIFY.
-- ==============================================================================

-- 1. CONTRATS
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);

-- 2. CLIENTS
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);

-- 3. CAUTIONS (DEPOSITS)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_by ON public.deposits(created_by);

-- 4. VÉHICULES
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_created_by ON public.vehicles(created_by);

-- 5. RECHARGEMENT IMMÉDIAT DU CACHE DE SCHÉMA POSTGREST (Indispensable pour corriger PGRST204)
NOTIFY pgrst, 'reload schema';
