-- ==============================================================================
-- MISE À JOUR CIBLÉE : HARMONISATION DES IDENTIFIANTS GESTIONNAIRE & RLS
-- MORVELLO CARS - Script idempotent à exécuter dans le Supabase SQL Editor
--
-- RÉSOUD L'ERREUR 42501 (violates row-level security policy) :
-- Permet au manager Ouahib (et aux autres managers) d'enregistrer et mettre
-- à jour les contrats, véhicules, cautions et clients qui leur sont attribués,
-- qu'ils soient identifiés par leur UUID Supabase Auth ou leur code local ('usr-3').
-- ==============================================================================

-- 1. Ajout de la colonne local_id sur les profils si elle n'existe pas encore
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS local_id TEXT;

-- 2. Fonction sécurisée : can_access_manager_row
-- Permet la lecture et l'édition (USING) pour le responsable assigné
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
            (row_assigned_manager_id IS NOT NULL AND (
              p.id = row_assigned_manager_id 
              OR p.name = row_assigned_manager_id
              OR (p.local_id IS NOT NULL AND p.local_id = row_assigned_manager_id)
              OR (p.name ILIKE '%ouahib%' AND (row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%'))
              OR (p.name ILIKE '%benali%' AND (row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%'))
              OR (p.name ILIKE '%mansouri%' AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%mansouri%'))
              OR (p.name ILIKE '%alami%' AND (row_assigned_manager_id ILIKE '%usr-4%' OR row_assigned_manager_id ILIKE '%alami%'))
              OR (p.name ILIKE '%tazi%' AND (row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%tazi%'))
            ))
            OR (row_created_by IS NOT NULL AND (
              p.id = row_created_by 
              OR p.name = row_created_by 
              OR p.email = row_created_by
              OR (p.local_id IS NOT NULL AND p.local_id = row_created_by)
              OR (p.name ILIKE '%ouahib%' AND (row_created_by ILIKE '%usr-3%' OR row_created_by ILIKE '%ouahib%'))
              OR (p.name ILIKE '%benali%' AND (row_created_by ILIKE '%usr-1%' OR row_created_by ILIKE '%benali%'))
              OR (p.name ILIKE '%mansouri%' AND (row_created_by ILIKE '%usr-2%' OR row_created_by ILIKE '%mansouri%'))
              OR (p.name ILIKE '%alami%' AND (row_created_by ILIKE '%usr-4%' OR row_created_by ILIKE '%alami%'))
              OR (p.name ILIKE '%tazi%' AND (row_created_by ILIKE '%usr-5%' OR row_created_by ILIKE '%tazi%'))
            ))
          )
        )
      )
    );
$$;

-- 3. Fonction sécurisée : can_assign_manager
-- Valide l'assignation (WITH CHECK) pour empêcher un manager d'affecter à autrui
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
            OR (p.local_id IS NOT NULL AND p.local_id = row_assigned_manager_id)
            OR (p.name ILIKE '%ouahib%' AND (row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%'))
            OR (p.name ILIKE '%benali%' AND (row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%'))
            OR (p.name ILIKE '%mansouri%' AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%mansouri%'))
            OR (p.name ILIKE '%alami%' AND (row_assigned_manager_id ILIKE '%usr-4%' OR row_assigned_manager_id ILIKE '%alami%'))
            OR (p.name ILIKE '%tazi%' AND (row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%tazi%'))
          )
        )
      )
    );
$$;

-- 4. Rapprochement automatique des fiches existantes de Ouahib vers son UID Supabase
DO $$
DECLARE
  ouahib_uid text;
BEGIN
  SELECT id INTO ouahib_uid FROM public.profiles WHERE name ILIKE '%ouahib%' OR email ILIKE '%ouahib%' LIMIT 1;
  IF ouahib_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-3' WHERE id = ouahib_uid;
    UPDATE public.contracts SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.vehicles SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.deposits SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.clients SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
  END IF;
END $$;

-- 5. Notification de rechargement du cache PostgREST
NOTIFY pgrst, 'reload schema';
