-- ==============================================================================
-- MORVELLO CARS - MIGRATION SÉCURITÉ V5 : SÉCURISATION DU MODÈLE DE PROFILS (PROBLEM #4)
-- ==============================================================================
-- OBJECTIFS CRITIQUES :
-- 1. Éliminer définitivement toute politique permissive (USING true / TO authenticated USING true)
--    sur la table `public.profiles`.
-- 2. Cloisonnement strict des profils et données d'autorisation (RBAC) :
--    - Utilisateurs non-authentifiés : Zéro accès (0 profil visible).
--    - Administrateur d'agence : Accès complet aux profils de son agence.
--    - Managers / Agents : Accès STRICTEMENT limité à leur propre profil dans `public.profiles`.
--      Ils ne peuvent en aucun cas lire les profils sensibles d'autres collaborateurs.
--    - Interdiction absolue d'auto-promotion (escalade de privilège manager -> admin).
--    - Interdiction absolue de modification de l'agence (agency_id), permissions, local_id, legacy_id.
--    - Protection stricte de l'administrateur racine usr-1 (indéboulonnable et non-supprimable).
-- 3. Séparation des données publiques et données d'autorisation sensibles :
--    - Création de la vue sécurisée `public.safe_profiles` exposant uniquement les données non-sensibles
--      (id, name, email, phone, agency, agency_id, assigned_fleet_name, created_at, updated_at)
--      sans exposer `role`, `permissions`, `legacy_id`, `local_id`.
--    - Création de la fonction `public.get_safe_team_members()`.
--
-- Exécutez ce script dans Supabase SQL Editor :
-- https://app.supabase.com -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. STRUCTURE ET INDEX DE LA TABLE PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency TEXT DEFAULT 'Nouaceur Casablanca';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_fleet_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legacy_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON public.profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_local_id ON public.profiles(local_id);
CREATE INDEX IF NOT EXISTS idx_profiles_legacy_id ON public.profiles(legacy_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. VUE SÉCURISÉE PUBLIQUE (SÉPARATION DES DONNÉES D'AUTORISATION SENSIBLES)
-- Permet aux collaborateurs d'une même agence d'afficher les informations professionnelles publiques
-- (noms, emails de contact) SANS jamais exposer les rôles, permissions ou identifiants internes.
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

-- Fonction d'accès sécurisé pour l'annuaire d'équipe
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

-- 3. TRIGGERS DE SÉCURITÉ ET ANTI-ÉLÉVATION DE PRIVILÈGES
-- 3.1 Trigger BEFORE UPDATE sur public.profiles
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si l'utilisateur n'est pas administrateur :
  IF NOT public.is_admin() THEN
    -- 1. Interdiction absolue d'auto-promotion ou de changement de rôle
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only administrators can change user roles.';
    END IF;

    -- 2. Interdiction absolue de modifier local_id / legacy_id
    IF NEW.local_id IS DISTINCT FROM OLD.local_id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify local_id.';
    END IF;
    IF NEW.legacy_id IS DISTINCT FROM OLD.legacy_id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify legacy_id.';
    END IF;

    -- 3. Interdiction absolue de changer d'agence (agency_id ou agency)
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Agency modification rejected: cannot change agency_id.';
    END IF;
    IF NEW.agency IS DISTINCT FROM OLD.agency THEN
      RAISE EXCEPTION 'Agency modification rejected: cannot change agency.';
    END IF;

    -- 4. Interdiction absolue d'altérer les permissions RBAC
    IF NEW.permissions IS DISTINCT FROM OLD.permissions THEN
      RAISE EXCEPTION 'Privilege escalation rejected: cannot alter permissions.';
    END IF;

    -- 5. Interdiction de modifier l'identifiant principal id
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot change primary id.';
    END IF;
  END IF;

  -- Protection de l'administrateur racine usr-1 :
  -- Personne ne peut s'attribuer usr-1
  IF (NEW.local_id = 'usr-1' OR NEW.legacy_id = 'usr-1') 
     AND (OLD.local_id IS DISTINCT FROM 'usr-1' AND OLD.legacy_id IS DISTINCT FROM 'usr-1') THEN
    RAISE EXCEPTION 'Security violation: usr-1 identity is reserved.';
  END IF;

  -- L'administrateur racine usr-1 ne peut pas être rétrogradé
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

-- 3.2 Trigger BEFORE INSERT sur public.profiles
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si l'utilisateur n'est pas administrateur :
  IF NOT public.is_admin() THEN
    -- Ne peut pas créer un profil avec rôle 'admin'
    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Privilege escalation rejected: cannot create an admin profile.';
    END IF;
    -- Ne peut pas usurper l'identité de l'administrateur racine usr-1
    IF NEW.local_id = 'usr-1' OR NEW.legacy_id = 'usr-1' THEN
      RAISE EXCEPTION 'Security violation: usr-1 identity is reserved.';
    END IF;
    -- Forcer le rôle par défaut
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

-- 3.3 Trigger BEFORE DELETE sur public.profiles
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

-- 4. NETTOYAGE DES ANCIENNES POLICIES
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- 5. POLITIQUES ROW LEVEL SECURITY (RLS) SUR PUBLIC.PROFILES

-- 5.1 SÉLECTION (SELECT)
-- - Utilisateur non-authentifié : ZÉRO accès.
-- - Administrateur de l'agence : Peut lire tous les profils de son agence.
-- - Collaborateur / Manager : Ne peut lire QUE son propre profil sensible.
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Cas 1 : L'administrateur de l'agence accède aux profils de son agence
    (public.is_admin() AND public.is_same_agency(agency_id))
    -- Cas 2 : L'utilisateur standard accède UNIQUEMENT à son propre profil
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

-- 5.2 INSERTION (INSERT)
-- - Administrateur : Peut insérer pour les membres de son agence.
-- - Collaborateur : Peut uniquement initialiser son propre profil avec un rôle non-admin.
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

-- 5.3 MISE À JOUR (UPDATE)
-- - Protège la ligne ciblée (USING) et la ligne résultante (WITH CHECK).
-- - Administrateur : Peut modifier les profils de son agence.
-- - Collaborateur : Ne peut modifier que son propre profil, sans changer son rôle ou son agence.
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

-- 5.4 SUPPRESSION (DELETE)
-- - Seul l'administrateur peut supprimer des comptes au sein de son agence.
-- - Impossible de supprimer le compte d'administration racine usr-1.
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND public.is_same_agency(agency_id)
    AND COALESCE(local_id, '') <> 'usr-1'
    AND COALESCE(legacy_id, '') <> 'usr-1'
    AND id <> 'usr-1'
  );

-- Notification de fin de migration
DO $$
BEGIN
  RAISE NOTICE 'Migration V5 Profiles RLS appliquée avec succès : Isolation stricte, vue safe_profiles, anti-escalade de privilèges.';
END $$;
