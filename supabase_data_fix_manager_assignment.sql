-- ==============================================================================
-- MORVELLO CARS — Correction ponctuelle des affectations de responsable (2026-10-10)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent : le relancer ne change rien.
--
-- Constat : 4 lignes avaient un `assigned_manager_id` incohérent avec le responsable indiqué
-- dans leur document JSON, ce qui montrait à Ouahib des contrats qui ne sont pas les siens.
--
--   Véhicules 46307 et 46682 : responsable « Mohamed Ezzay », mais UUID d'Anouar (admin)
--   Contrat MC-2026-0051     : UUID d'Ouahib  -> Mohamed Ezzay (responsable du véhicule 46307)
--   Contrat MC-2026-0052     : UUID d'Ouahib  -> Larbi Khomri  (responsable du véhicule 46306)
--   Clients TLIHA / NEMER    : UUID d'Ouahib  -> suivent leur contrat (Ezzay / Larbi)
--
-- Décisions : confirmées par le gérant (Anouar, super admin, gère toute la flotte).
-- ==============================================================================
BEGIN;

-- Véhicules 46307 et 46682 -> Mohamed Ezzay
UPDATE public.vehicles SET
  assigned_manager_id = '2904e4b9-560f-4b74-9b74-acee1e6b9607',
  data = jsonb_set(
           jsonb_set(data, '{assignedManagerId}', to_jsonb('2904e4b9-560f-4b74-9b74-acee1e6b9607'::text)),
           '{assignedManagerName}', '"Mohamed Ezzay"'::jsonb),
  updated_at = now()
WHERE id IN ('veh-46307', 'veh-46682');

-- Contrat MC-2026-0051 et son client TLIHA -> Mohamed Ezzay
UPDATE public.contracts SET
  assigned_manager_id = '2904e4b9-560f-4b74-9b74-acee1e6b9607',
  data = jsonb_set(
           jsonb_set(data, '{assignedManagerId}', to_jsonb('2904e4b9-560f-4b74-9b74-acee1e6b9607'::text)),
           '{assignedManagerName}', '"Mohamed Ezzay"'::jsonb),
  updated_at = now()
WHERE id = 'cnt-1789867444937';

UPDATE public.clients SET
  assigned_manager_id = '2904e4b9-560f-4b74-9b74-acee1e6b9607',
  data = jsonb_set(
           jsonb_set(data, '{assignedManagerId}', to_jsonb('2904e4b9-560f-4b74-9b74-acee1e6b9607'::text)),
           '{assignedManagerName}', '"Mohamed Ezzay"'::jsonb),
  updated_at = now()
WHERE id = 'cli-1789867444935';

-- Contrat MC-2026-0052 et son client NEMER -> Larbi Khomri
UPDATE public.contracts SET
  assigned_manager_id = 'fb79e7a7-0220-48f8-9581-ca4ca9d52f78',
  data = jsonb_set(
           jsonb_set(data, '{assignedManagerId}', to_jsonb('fb79e7a7-0220-48f8-9581-ca4ca9d52f78'::text)),
           '{assignedManagerName}', '"Larbi Khomri"'::jsonb),
  updated_at = now()
WHERE id = 'cnt-1789987260626';

UPDATE public.clients SET
  assigned_manager_id = 'fb79e7a7-0220-48f8-9581-ca4ca9d52f78',
  data = jsonb_set(
           jsonb_set(data, '{assignedManagerId}', to_jsonb('fb79e7a7-0220-48f8-9581-ca4ca9d52f78'::text)),
           '{assignedManagerName}', '"Larbi Khomri"'::jsonb),
  updated_at = now()
WHERE id = 'cli-1789987059946';

COMMIT;

-- Vérification : chaque ligne doit afficher le bon propriétaire.
SELECT 'vehicule ' || v.plate AS ligne, p.email AS affecte_a
FROM public.vehicles v LEFT JOIN public.profiles p ON p.id = v.assigned_manager_id
WHERE v.id IN ('veh-46307', 'veh-46682')
UNION ALL
SELECT 'contrat ' || c.contract_number, p.email
FROM public.contracts c LEFT JOIN public.profiles p ON p.id = c.assigned_manager_id
WHERE c.id IN ('cnt-1789867444937', 'cnt-1789987260626')
UNION ALL
SELECT 'client ' || cl.id, p.email
FROM public.clients cl LEFT JOIN public.profiles p ON p.id = cl.assigned_manager_id
WHERE cl.id IN ('cli-1789867444935', 'cli-1789987059946')
ORDER BY 1;
