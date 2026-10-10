-- ==============================================================================
-- MORVELLO CARS — Réplication temps réel : conducteurs et profils
-- À exécuter une fois dans Supabase > SQL Editor.
--
-- Contexte : l'application écoute maintenant les tables `drivers` et `profiles` en plus de
-- `contracts`, `vehicles`, `clients`, `deposits` et `agency_data`. Sans cette publication,
-- ces deux tables ne sont rafraîchies qu'au rechargement ou à la reconnexion.
-- (Les paiements et dépenses véhicules vivent dans le document JSON du contrat / véhicule,
--  déjà couverts par la réplication de `contracts` et `vehicles`.)
-- Les événements temps réel respectent la RLS : chacun ne reçoit que ses propres lignes.
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
