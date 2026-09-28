-- ==============================================================================
-- MIGRATION: supabase_migration_p04_final_security_hardening_v12.sql
-- DESCRIPTION: P0.4.3 Final Security Remediation
-- 1. Correct can_access_manager_row() to resolve authoritative agency without NULL failure.
-- 2. Validate and enforce UNIQUE constraint on public.profiles.firebase_uid.
-- 3. Protect firebase_uid on profile insertion (protect_profile_insert).
-- ==============================================================================

-- 1. CORRECTION FONCTIONNELLE DE can_access_manager_row()
-- Résout de manière sécurisée l'autorisation d'accès pour les lignes agency_data
-- Comportement requis:
-- - Si l'appelant est administrateur: autorisé
-- - Si l'appelant est le manager assigné ou le créateur:
--     autorisé SEULEMENT SI le manager cible correspond à l'identité de l'appelant
--     ET que l'agence cible concorde avec l'agence de l'appelant (fail-closed, anti-cross-tenant)
-- - Rejette tout appelant sans identité valide, sans agence ou de rôle non-manager
CREATE OR REPLACE FUNCTION public.can_access_manager_row(
  row_assigned_manager_id text,
  row_created_by text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_current_agency text;
BEGIN
  -- 1. Utilisateur non-authentifié -> FALSE
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Agence courante de l'utilisateur requise (fail-closed)
  v_current_agency := public.get_current_agency_id();
  IF v_current_agency IS NULL OR trim(v_current_agency) = '' THEN
    RETURN FALSE;
  END IF;

  -- 3. Administrateur de l'agence autorisé
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- 4. Manager vérifié sur assigned_manager_id ou created_by
  RETURN (
    (row_assigned_manager_id IS NOT NULL AND public.is_current_manager(row_assigned_manager_id))
    OR (
      (row_assigned_manager_id IS NULL OR trim(row_assigned_manager_id) = '')
      AND row_created_by IS NOT NULL
      AND public.is_current_manager(row_created_by)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_manager_row(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_manager_row(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_manager_row(text, text) TO authenticated;

-- 2. VÉRIFICATION D'UNICITÉ ET CRÉATION DE L'INDEX UNIQUE SUR firebase_uid
-- Détection fail-closed des doublons avant l'application de la contrainte unique
DO $$
DECLARE
  v_duplicate_count integer;
  v_duplicate_uids text;
BEGIN
  SELECT count(*), string_agg(firebase_uid, ', ')
  INTO v_duplicate_count, v_duplicate_uids
  FROM (
    SELECT firebase_uid
    FROM public.profiles
    WHERE firebase_uid IS NOT NULL AND trim(firebase_uid) <> ''
    GROUP BY firebase_uid
    HAVING count(*) > 1
  ) dups;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Duplicate firebase_uid values detected: %', v_duplicate_uids;
  ELSE
    RAISE NOTICE 'No duplicate firebase_uid detected. Proceeding to create unique index.';
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.idx_profiles_firebase_uid;
DROP INDEX IF EXISTS public.idx_profiles_firebase_uid_unique;
CREATE UNIQUE INDEX idx_profiles_firebase_uid_unique
  ON public.profiles(firebase_uid)
  WHERE firebase_uid IS NOT NULL AND trim(firebase_uid) <> '';

-- 3. RENFORCEMENT DU TRIGGER D'INSERTION protect_profile_insert()
-- Empêche l'usurpation de firebase_uid ou la création de profils avec des firebase_uid déjà attribués
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency text;
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

    IF NEW.agency_id IS NULL OR trim(NEW.agency_id) = '' THEN
      RAISE EXCEPTION 'Agency required: profile creation must specify an authorized agency.';
    END IF;

    -- Les utilisateurs non-administrateurs ne peuvent pas définir arbitrairement un firebase_uid
    IF NEW.firebase_uid IS NOT NULL AND trim(NEW.firebase_uid) <> '' THEN
      RAISE EXCEPTION 'Identity violation: non-admins cannot assign firebase_uid on insert.';
    END IF;
  ELSE
    IF NEW.agency_id IS NULL OR trim(NEW.agency_id) = '' THEN
      v_caller_agency := public.get_current_agency_id();
      IF v_caller_agency IS NULL OR trim(v_caller_agency) = '' THEN
        RAISE EXCEPTION 'Agency required: active admin profile must have an assigned agency.';
      END IF;
      NEW.agency_id := v_caller_agency;
    END IF;
  END IF;

  -- Vérification d'unicité stricte pour firebase_uid si spécifié
  IF NEW.firebase_uid IS NOT NULL AND trim(NEW.firebase_uid) <> '' THEN
    NEW.firebase_uid := trim(NEW.firebase_uid);
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.firebase_uid = NEW.firebase_uid
        AND p.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Duplicate identity rejected: firebase_uid already associated with another profile.';
    END IF;
  END IF;

  NEW.agency_id := trim(NEW.agency_id);
  NEW.created_at := timezone('utc'::text, now());
  NEW.updated_at := timezone('utc'::text, now());

  RETURN NEW;
END;
$$;
