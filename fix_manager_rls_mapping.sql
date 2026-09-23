-- ==============================================================================
-- MISE À JOUR CIBLÉE : DÉBLOCAGE RLS DES PROFILS & GESTIONNAIRES (SAID, OUAHIB, ETC.)
-- MORVELLO CARS - Script idempotent à exécuter dans le Supabase SQL Editor
--
-- RÉSOUD L'ERREUR 42501 SUR LA TABLE "profiles" :
-- "new row violates row-level security policy for table 'profiles'"
-- Permet à tout utilisateur authentifié (y compris les managers comme Said Khomri)
-- d'insérer et mettre à jour leur propre profil utilisateur lors de leur connexion.
-- Harmonise également les identifiants locaux (usr-1 à usr-6) avec leurs comptes Supabase.
-- ==============================================================================

-- 1. Ajout de la colonne local_id sur les profils si elle n'existe pas encore
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency TEXT DEFAULT 'Nouaceur Casablanca';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_fleet_name TEXT;

-- 2. Fonction d'administration améliorée (sécurisée)
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

-- 3. POLITIQUES RLS SUR PROFILES (Résout le blocage 42501 sur Profils)
-- Tout utilisateur authentifié peut insérer son propre profil (auth.uid() = id), sans restriction sur le rôle agent/manager
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = id 
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid()::text = id 
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid()::text = id 
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated 
  USING (public.is_admin());

-- 4. Fonction sécurisée : can_access_manager_row
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

-- 5. Fonction sécurisée : can_assign_manager
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

-- 6. Rapprochement automatique des fiches existantes vers les comptes Supabase
DO $$
DECLARE
  said_uid text;
  ouahib_uid text;
  ezzay_uid text;
  larbi_uid text;
BEGIN
  -- Said Khomri (usr-2)
  SELECT id INTO said_uid FROM public.profiles WHERE name ILIKE '%said%' OR email ILIKE '%said%' LIMIT 1;
  IF said_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-2' WHERE id = said_uid;
    UPDATE public.contracts SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
    UPDATE public.vehicles SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
    UPDATE public.deposits SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
    UPDATE public.clients SET assigned_manager_id = said_uid WHERE assigned_manager_id = 'usr-2';
  END IF;

  -- Abdelkader Ouahib (usr-3)
  SELECT id INTO ouahib_uid FROM public.profiles WHERE name ILIKE '%ouahib%' OR email ILIKE '%ouahib%' LIMIT 1;
  IF ouahib_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-3' WHERE id = ouahib_uid;
    UPDATE public.contracts SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.vehicles SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.deposits SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
    UPDATE public.clients SET assigned_manager_id = ouahib_uid WHERE assigned_manager_id = 'usr-3';
  END IF;

  -- Mohamed Ezzay (usr-5)
  SELECT id INTO ezzay_uid FROM public.profiles WHERE name ILIKE '%ezzay%' OR email ILIKE '%ezzay%' LIMIT 1;
  IF ezzay_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-5' WHERE id = ezzay_uid;
    UPDATE public.contracts SET assigned_manager_id = ezzay_uid WHERE assigned_manager_id = 'usr-5';
    UPDATE public.vehicles SET assigned_manager_id = ezzay_uid WHERE assigned_manager_id = 'usr-5';
    UPDATE public.deposits SET assigned_manager_id = ezzay_uid WHERE assigned_manager_id = 'usr-5';
    UPDATE public.clients SET assigned_manager_id = ezzay_uid WHERE assigned_manager_id = 'usr-5';
  END IF;

  -- Larbi Khomri (usr-6)
  SELECT id INTO larbi_uid FROM public.profiles WHERE name ILIKE '%larbi%' OR email ILIKE '%larbi%' LIMIT 1;
  IF larbi_uid IS NOT NULL THEN
    UPDATE public.profiles SET local_id = 'usr-6' WHERE id = larbi_uid;
    UPDATE public.contracts SET assigned_manager_id = larbi_uid WHERE assigned_manager_id = 'usr-6';
    UPDATE public.vehicles SET assigned_manager_id = larbi_uid WHERE assigned_manager_id = 'usr-6';
    UPDATE public.deposits SET assigned_manager_id = larbi_uid WHERE assigned_manager_id = 'usr-6';
    UPDATE public.clients SET assigned_manager_id = larbi_uid WHERE assigned_manager_id = 'usr-6';
  END IF;
END $$;

-- 7. Notification de rechargement du cache PostgREST
NOTIFY pgrst, 'reload schema';
