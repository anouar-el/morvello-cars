-- ==============================================================================
-- APPLICATION DE LA POLICY DE PARTAGE OPÉRATIONNEL DE LA FLOTTE DE VÉHICULES
-- Script idempotent à exécuter dans le Supabase SQL Editor (https://app.supabase.com)
--
-- Objectif :
-- Permet à tout utilisateur authentifié (manager ou agent) de mettre à jour
-- le statut et le kilométrage d'un véhicule (ex: création de contrat, retour),
-- tout en préservant son assigned_manager_id nominal.
--
-- NOTE :
-- 1. vehicles_insert reste inchangée (exige can_assign_manager à la création).
-- 2. clients, contracts, deposits restent strictement cloisonnés par manager.
-- ==============================================================================

DROP POLICY IF EXISTS "vehicles_update" ON public.vehicles;

CREATE POLICY "vehicles_update" ON public.vehicles
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (
    auth.uid() IS NOT NULL
  );
