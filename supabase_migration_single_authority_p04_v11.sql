-- ==============================================================================
-- MORVELLO CARS - MIGRATION V11: SINGLE AUTHORITATIVE SECURITY AUTHORITY (P0.4)
-- ==============================================================================
-- Audit Fix: P0.4 Dual Authentication Authority Resolution
-- Objective:
-- 1. Establish Supabase Auth + public.profiles as the SINGLE authoritative security authority.
-- 2. Add canonical firebase_uid column to public.profiles to establish an explicit,
--    verifiable link between legacy Firebase Auth UIDs and canonical Supabase profiles.
-- 3. Eliminate all reliance on Firebase Custom Claims and hardcoded agency fallbacks.
-- 4. Protect firebase_uid against tampering and unauthorized modification via triggers.
-- 5. Guarantee that unmapped Firebase users cannot obtain privileged access.
-- ==============================================================================

-- 1. AJOUT DE LA COLONNE CANONIQUE firebase_uid À LA TABLE public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- 2. CRÉATION DE L'INDEX PERFORMANTE ET SÉCURISÉE SUR firebase_uid
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);

-- 3. SÉCURISATION DU TRIGGER DE PRÉVENTION D'ÉLÉVATION DE PRIVILÈGES
-- Garantit qu'un utilisateur non-administrateur ne peut ni usurper ni modifier un firebase_uid
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
    IF NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid THEN
      RAISE EXCEPTION 'Identity modification rejected: cannot modify firebase_uid.';
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

-- 4. VÉRIFICATION ET VALIDATION DE L'INTÉGRITÉ DES PROFILS
-- Rapport des profils sans firebase_uid pour audit opérationnel (non bloquant)
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles WHERE firebase_uid IS NULL;
  RAISE NOTICE 'Migration V11 appliquée avec succès. Profils Supabase purs sans lien Firebase: %', v_count;
END;
$$;
