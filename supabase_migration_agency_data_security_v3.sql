-- ==============================================================================
-- MORVELLO CARS - MIGRATION SÉCURITÉ V3 : ISOLATION STRICTE DE AGENCY_DATA (PROBLEM #2)
-- ==============================================================================
-- OBJECTIF CRITIQUE :
-- Neutraliser le risque de contournement de la sécurité RLS via la table `agency_data`.
-- 
-- 1. ARCHITECTURE DES SOURCES DE VÉRITÉ :
--    - Les tables normalisées (vehicles, clients, drivers, contracts, deposits, payments, vehicle_expenses)
--      sont l'UNIQUE SOURCE DE VÉRITÉ des entités métier opérationnelles.
--    - Chaque table normalisée est protégée par des politiques RLS garantissant l'isolation par agence et par manager.
--    - La table `agency_data` est réduite à la configuration générale de l'agence (companySettings, termsVersion, aiSettings)
--      et aux préférences spécifiques des managers (via assigned_manager_id).
--    - AUCUNE entité opérationnelle sensible (contrats, clients, cautions, finances) n'est autorisée
--      dans le JSONB global de agency_data.
--
-- 2. MODÈLE DE SÉCURITÉ ROW LEVEL SECURITY (RLS) :
--    - UTILISATEURS NON-AUTHENTIFIÉS : Zéro accès (rejet immédiat).
--    - ADMINISTRATEUR / GÉRANT : Accès complet aux lignes de son agence (lignes globales et lignes managers).
--    - MANAGER AUTHENTIFIÉ :
--        * Peut accéder UNIQUEMENT aux lignes qui lui sont explicitement assignées (assigned_manager_id).
--        * NE PEUT PAS accéder à la ligne de configuration globale (assigned_manager_id IS NULL).
--        * NE PEUT PAS accéder à la ligne d'un autre manager.
--        * NE PEUT PAS modifier l'agency_id ou l'assigned_manager_id pour s'évader de son périmètre.
--
-- Exécutez ce script dans Supabase SQL Editor :
-- https://app.supabase.com -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. VÉRIFICATION ET ÉVOLUTION DU SCHÉMA DE AGENCY_DATA
ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS agency_id TEXT DEFAULT 'agency_morvello';
ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.agency_data ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_agency_data_agency_id ON public.agency_data(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_data_assigned_manager ON public.agency_data(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_agency_data_created_by ON public.agency_data(created_by);
CREATE INDEX IF NOT EXISTS idx_agency_data_updated_at ON public.agency_data(updated_at);

-- 2. ACTIVATION DE LA SÉCURITÉ ROW LEVEL SECURITY (RLS)
ALTER TABLE public.agency_data ENABLE ROW LEVEL SECURITY;

-- 3. NETTOYAGE DES ANCIENNES POLICIES
DROP POLICY IF EXISTS "agency_data_select" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_insert" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_update" ON public.agency_data;
DROP POLICY IF EXISTS "agency_data_delete" ON public.agency_data;
DROP POLICY IF EXISTS "morvello_agency_data_policy" ON public.agency_data;

-- 4. CRÉATION DES NOUVELLES POLITIQUES RLS STRICTES

-- 4.1 SÉLECTION (SELECT)
CREATE POLICY "agency_data_select" ON public.agency_data
  FOR SELECT TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_access_manager_row(assigned_manager_id, COALESCE(created_by, updated_by))
      )
    )
  );

-- 4.2 INSERTION (INSERT)
CREATE POLICY "agency_data_insert" ON public.agency_data
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_assign_manager(assigned_manager_id)
      )
    )
  );

-- 4.3 MISE À JOUR (UPDATE)
CREATE POLICY "agency_data_update" ON public.agency_data
  FOR UPDATE TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_access_manager_row(assigned_manager_id, COALESCE(created_by, updated_by))
      )
    )
  )
  WITH CHECK (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_assign_manager(assigned_manager_id)
      )
    )
  );

-- 4.4 SUPPRESSION (DELETE)
CREATE POLICY "agency_data_delete" ON public.agency_data
  FOR DELETE TO authenticated
  USING (
    public.is_same_agency(agency_id)
    AND (
      public.is_admin()
      OR (
        assigned_manager_id IS NOT NULL
        AND public.can_access_manager_row(assigned_manager_id, COALESCE(created_by, updated_by))
      )
    )
  );

-- 5. NETTOYAGE DES DONNÉES SENSIBLES DANS LE BLOB AGENCY_DATA EXISTANT
-- Supprime les clés d'entités métier opérationnelles afin d'empêcher toute fuite de données
UPDATE public.agency_data
SET data = data - 'clients' - 'contracts' - 'vehicles' - 'deposits' - 'drivers' - 'payments' - 'vehicleExpenses'
WHERE id = 'morvello_main' AND data IS NOT NULL;

-- 6. PUBLICATION TEMPS-RÉEL (SUPABASE REALTIME) DES TABLES NORMALISÉES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'agency_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agency_data;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vehicles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contracts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deposits') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
  END IF;
END $$;

-- 7. RECHARGEMENT DU CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
