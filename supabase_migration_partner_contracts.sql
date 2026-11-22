-- ==============================================================================
-- MORVELLO CARS - CONTRATS POUR D'AUTRES AGENCES : contrats enregistrés
-- À exécuter une fois dans Supabase : SQL Editor > New Query > Coller > Run
-- (le script peut être relancé sans risque).
--
-- Une ligne par contrat édité pour une agence partenaire (formulaire complet en JSON).
-- Lecture et écriture réservées à l'administrateur de l'agence.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.partner_contracts (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL DEFAULT public.get_current_agency_id(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_partner_contracts_agency_id ON public.partner_contracts(agency_id);

ALTER TABLE public.partner_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_contracts_select" ON public.partner_contracts;
DROP POLICY IF EXISTS "partner_contracts_insert" ON public.partner_contracts;
DROP POLICY IF EXISTS "partner_contracts_update" ON public.partner_contracts;
DROP POLICY IF EXISTS "partner_contracts_delete" ON public.partner_contracts;

CREATE POLICY "partner_contracts_select" ON public.partner_contracts
  FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_same_agency(agency_id));

CREATE POLICY "partner_contracts_insert" ON public.partner_contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND public.is_same_agency(agency_id));

CREATE POLICY "partner_contracts_update" ON public.partner_contracts
  FOR UPDATE TO authenticated
  USING (public.is_admin() AND public.is_same_agency(agency_id))
  WITH CHECK (public.is_admin() AND public.is_same_agency(agency_id));

CREATE POLICY "partner_contracts_delete" ON public.partner_contracts
  FOR DELETE TO authenticated
  USING (public.is_admin() AND public.is_same_agency(agency_id));

REVOKE ALL ON public.partner_contracts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_contracts TO authenticated;
