-- ==============================================================================
-- MORVELLO CARS — Numérotation atomique des contrats
-- À exécuter une fois dans Supabase > SQL Editor (idempotent).
--
-- Problème : le numéro était calculé côté navigateur à partir de la liste locale. Deux postes
-- créant un contrat en même temps obtenaient le même numéro ; la contrainte UNIQUE de
-- contracts.contract_number en rejetait un seul, après toute la saisie du contrat.
--
-- Solution : une fonction SECURITY DEFINER réserve le numéro dans une transaction, en verrouillant
-- la ligne du compteur de l'agence (préfixe + année). Le numéro attribué est strictement supérieur :
--   - au plus grand numéro existant en base (toutes lignes, indépendamment de la RLS) ;
--   - au dernier numéro déjà réservé (compteur) ;
--   - au minimum suggéré par le client (compteur de paramétrage de l'agence).
-- Un numéro réservé puis non utilisé (création échouée) laisse un trou : c'est volontaire, un
-- numéro n'est jamais réattribué.
-- L'application retombe sur le calcul local si cette fonction est absente.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.contract_counters (
  prefix        TEXT        NOT NULL,
  year          INTEGER     NOT NULL,
  last_sequence INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prefix, year)
);

-- RLS activée sans aucune policy : la table n'est accessible que via la fonction ci-dessous.
ALTER TABLE public.contract_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contract_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.allocate_contract_number(
  p_prefix       TEXT    DEFAULT 'MC',
  p_year         INTEGER DEFAULT NULL,
  p_min_sequence INTEGER DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix  TEXT;
  v_year    INTEGER;
  v_pattern TEXT;
  v_max     INTEGER;
  v_counter INTEGER;
  v_seq     INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise pour réserver un numéro de contrat';
  END IF;

  v_prefix := upper(trim(COALESCE(NULLIF(p_prefix, ''), 'MC')));
  IF v_prefix !~ '^[A-Z0-9_-]+$' THEN
    RAISE EXCEPTION 'Préfixe de contrat invalide : %', v_prefix;
  END IF;
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM now())::INTEGER);

  -- Crée la ligne du compteur si besoin, puis la verrouille jusqu'à la fin de la transaction :
  -- deux réservations simultanées sont sérialisées.
  INSERT INTO public.contract_counters (prefix, year, last_sequence)
  VALUES (v_prefix, v_year, 0)
  ON CONFLICT (prefix, year) DO NOTHING;

  SELECT last_sequence INTO v_counter
  FROM public.contract_counters
  WHERE prefix = v_prefix AND year = v_year
  FOR UPDATE;

  v_pattern := '^' || v_prefix || '-' || v_year::TEXT || '-[0-9]+$';
  SELECT COALESCE(MAX(substring(contract_number FROM '([0-9]+)$')::INTEGER), 0)
    INTO v_max
  FROM public.contracts
  WHERE upper(contract_number) ~ v_pattern;

  v_seq := GREATEST(v_max, v_counter, GREATEST(COALESCE(p_min_sequence, 1), 1) - 1) + 1;

  UPDATE public.contract_counters
     SET last_sequence = v_seq, updated_at = now()
   WHERE prefix = v_prefix AND year = v_year;

  RETURN jsonb_build_object(
    'success',         true,
    'prefix',          v_prefix,
    'year',            v_year,
    'sequence',        v_seq,
    'contract_number', v_prefix || '-' || v_year::TEXT || '-' || lpad(v_seq::TEXT, 4, '0')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_contract_number(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_contract_number(TEXT, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
