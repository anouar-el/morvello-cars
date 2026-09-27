-- ==============================================================================
-- MORVELLO CARS - MIGRATION V11: STRICT MANAGER ROLE AUTHORIZATION
-- ==============================================================================
-- Audit Fix: P0.3 public.is_current_manager(target_manager_id text)
-- Objective:
-- 1. Ensure a user is NEVER considered a manager simply because an identifier matches.
-- 2. Explicitly enforce that the current user has an authorized manager (or admin) role.
-- 3. Enforce strict fail-closed agency context (missing/blank agency -> FALSE).
-- 4. Prevent cross-agency manager identifier collision/usurpation.
-- 5. Revoke public/anon execution; grant execute only to authenticated.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_current_manager(target_manager_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_current_agency text;
  v_profile record;
  v_is_admin boolean;
  v_is_manager boolean;
  v_trimmed_target text;
BEGIN
  -- 1. Utilisateur non-authentifié -> FALSE
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Paramètre cible invalide ou vide -> FALSE
  IF target_manager_id IS NULL OR trim(target_manager_id) = '' THEN
    RETURN FALSE;
  END IF;

  v_trimmed_target := trim(target_manager_id);

  -- 3. Résolution fail-closed de l'agence courante de l'utilisateur
  v_current_agency := public.get_current_agency_id();
  IF v_current_agency IS NULL OR trim(v_current_agency) = '' THEN
    RETURN FALSE;
  END IF;

  -- 4. Recherche du profil de l'utilisateur appelant dans public.profiles
  SELECT p.id, p.role, p.agency_id, p.local_id, p.legacy_id, p.email
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_uid::text;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 5. Validation du rôle : Seul un profil manager ou administrateur est habilité
  v_is_admin := (v_profile.role = 'admin' OR v_profile.local_id = 'usr-1' OR v_profile.legacy_id = 'usr-1');
  v_is_manager := (v_profile.role = 'manager');

  -- Les employés/agents/utilisateurs standards sont strictement rejetés
  IF NOT (v_is_manager OR v_is_admin) THEN
    RETURN FALSE;
  END IF;

  -- 6. Détection et blocage de périmètre inter-agence (anti cross-tenant)
  -- Si l'identifiant cible correspond à un profil d'une agence étrangère, refuser
  IF EXISTS (
    SELECT 1 FROM public.profiles tp
    WHERE (
      tp.id = v_trimmed_target
      OR (tp.local_id IS NOT NULL AND tp.local_id = v_trimmed_target)
      OR (tp.legacy_id IS NOT NULL AND tp.legacy_id = v_trimmed_target)
      OR (tp.email IS NOT NULL AND lower(tp.email) = lower(v_trimmed_target))
    )
    AND tp.agency_id IS NOT NULL
    AND trim(tp.agency_id) <> ''
    AND trim(tp.agency_id) <> v_current_agency
  ) THEN
    RETURN FALSE;
  END IF;

  -- 7. Vérification stricte que l'identifiant cible correspond à l'identité de l'appelant
  RETURN (
    v_trimmed_target = v_profile.id
    OR v_trimmed_target = v_uid::text
    OR (v_profile.local_id IS NOT NULL AND v_profile.local_id = v_trimmed_target)
    OR (v_profile.legacy_id IS NOT NULL AND v_profile.legacy_id = v_trimmed_target)
    OR (v_profile.email IS NOT NULL AND lower(v_profile.email) = lower(v_trimmed_target))
  );
END;
$$;

-- Restreindre les privilèges d'exécution au rôle authentifié uniquement
REVOKE ALL ON FUNCTION public.is_current_manager(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_manager(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_current_manager(text) TO authenticated;
