-- ==============================================================================
-- MORVELLO CARS - Migration des Identifiants Hérités (usr-N -> UUID Supabase)
-- Script idempotent à exécuter dans Supabase SQL Editor
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- ÉTAPE 1 : AJOUT ET PEUPLEMENT DE LA COLONNE legacy_id SUR public.profiles
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legacy_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS local_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_legacy_id ON public.profiles(legacy_id);
CREATE INDEX IF NOT EXISTS idx_profiles_local_id ON public.profiles(local_id);

-- Renseigner le mapping pour chaque collaborateur historique (ponctuel & idempotent)
-- usr-1: Anouar Benali (Admin / Siège)
UPDATE public.profiles
SET legacy_id = 'usr-1', local_id = 'usr-1'
WHERE (legacy_id IS NULL OR legacy_id = '')
  AND (email ILIKE '%anouar%' OR name ILIKE '%anouar%' OR id = 'usr-1');

-- usr-2: Said Khomri (Manager Flotte A / Casablanca Centre)
UPDATE public.profiles
SET legacy_id = 'usr-2', local_id = 'usr-2'
WHERE (legacy_id IS NULL OR legacy_id = '')
  AND (email ILIKE '%said%' OR email ILIKE '%khomri%' OR name ILIKE '%said%' OR id = 'usr-2');

-- usr-3: Abdelkader Ouahib (Manager Flotte B / Aéroport Nouaceur)
UPDATE public.profiles
SET legacy_id = 'usr-3', local_id = 'usr-3'
WHERE (legacy_id IS NULL OR legacy_id = '')
  AND (email ILIKE '%ouahib%' OR name ILIKE '%ouahib%' OR id = 'usr-3');

-- usr-5: Mohamed Ezzay (Manager Flotte C / Marrakech & Région)
UPDATE public.profiles
SET legacy_id = 'usr-5', local_id = 'usr-5'
WHERE (legacy_id IS NULL OR legacy_id = '')
  AND (email ILIKE '%ezzay%' OR name ILIKE '%ezzay%' OR id = 'usr-5');

-- usr-6: Larbi Khomri (Manager Flotte D / Casablanca Littoral)
UPDATE public.profiles
SET legacy_id = 'usr-6', local_id = 'usr-6'
WHERE (legacy_id IS NULL OR legacy_id = '')
  AND (email ILIKE '%larbi%' OR name ILIKE '%larbi%' OR id = 'usr-6');

-- Synchronisation de sécurité si local_id est déjà renseigné
UPDATE public.profiles
SET legacy_id = local_id
WHERE legacy_id IS NULL AND local_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- ÉTAPE 2 : CORRECTION DES DONNÉES EXISTANTES PAR JOINTURE STRICTE SUR profiles.legacy_id
-- Remplace 'usr-N' par le véritable UUID Supabase (profiles.id)
-- ------------------------------------------------------------------------------

-- 1. Table CONTRACTS
UPDATE public.contracts c
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE (c.assigned_manager_id = p.legacy_id OR c.assigned_manager_id = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

UPDATE public.contracts c
SET created_by = p.id
FROM public.profiles p
WHERE (c.created_by = p.legacy_id OR c.created_by = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

-- 2. Table VEHICLES
UPDATE public.vehicles v
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE (v.assigned_manager_id = p.legacy_id OR v.assigned_manager_id = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

-- 3. Table CLIENTS
UPDATE public.clients c
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE (c.assigned_manager_id = p.legacy_id OR c.assigned_manager_id = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

UPDATE public.clients c
SET created_by = p.id
FROM public.profiles p
WHERE (c.created_by = p.legacy_id OR c.created_by = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

-- 4. Table DEPOSITS
UPDATE public.deposits d
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE (d.assigned_manager_id = p.legacy_id OR d.assigned_manager_id = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

UPDATE public.deposits d
SET created_by = p.id
FROM public.profiles p
WHERE (d.created_by = p.legacy_id OR d.created_by = p.local_id)
  AND p.id IS NOT NULL
  AND p.legacy_id IS NOT NULL;

-- Rafraîchir le cache PostgREST
NOTIFY pgrst, 'reload schema';
