-- ==============================================================================
-- MORVELLO CARS - CONTRATS POUR D'AUTRES AGENCES : agences enregistrées
-- À exécuter une fois dans Supabase : SQL Editor > New Query > Coller > Run
-- (le script peut être relancé sans risque).
--
-- Une ligne par agence partenaire (identité, coordonnées, logo) pour la page
-- « Contrats autres agences ». Aucun contrat ni client n'y est stocké.
-- Lecture et écriture réservées à l'administrateur de l'agence.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.partner_agencies (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL DEFAULT public.get_current_agency_id(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_partner_agencies_agency_id ON public.partner_agencies(agency_id);

ALTER TABLE public.partner_agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_agencies_select" ON public.partner_agencies;
DROP POLICY IF EXISTS "partner_agencies_insert" ON public.partner_agencies;
DROP POLICY IF EXISTS "partner_agencies_update" ON public.partner_agencies;
DROP POLICY IF EXISTS "partner_agencies_delete" ON public.partner_agencies;

CREATE POLICY "partner_agencies_select" ON public.partner_agencies
  FOR SELECT TO authenticated
  USING (public.is_admin() AND public.is_same_agency(agency_id));

CREATE POLICY "partner_agencies_insert" ON public.partner_agencies
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND public.is_same_agency(agency_id));

CREATE POLICY "partner_agencies_update" ON public.partner_agencies
  FOR UPDATE TO authenticated
  USING (public.is_admin() AND public.is_same_agency(agency_id))
  WITH CHECK (public.is_admin() AND public.is_same_agency(agency_id));

CREATE POLICY "partner_agencies_delete" ON public.partner_agencies
  FOR DELETE TO authenticated
  USING (public.is_admin() AND public.is_same_agency(agency_id));

REVOKE ALL ON public.partner_agencies FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_agencies TO authenticated;
