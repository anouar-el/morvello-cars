-- ==============================================================================
-- MORVELLO CARS - STOCKAGE DE FICHIERS (Supabase Storage)
-- À exécuter une fois dans Supabase : SQL Editor > New Query > Coller > Run
-- (le script peut être relancé sans risque).
--
-- Pourquoi : photos de véhicules, scans CIN/permis, photos d'état des lieux et signatures étaient
-- enregistrés en entier (base64) dans chaque fiche. Une fiche client pouvait peser ~1 Mo, recopiée dans
-- chaque contrat : la copie locale du navigateur (5 Mo max sur iPhone) saturait et l'application plantait.
-- Désormais le fichier va dans Storage et la fiche ne garde qu'une courte référence.
--
-- Deux espaces :
--   vehicle-photos  PUBLIC  : photos de voitures (non sensibles), servies directement et mises en cache.
--   morvello-files  PRIVÉ   : scans d'identité, permis, signatures, photos d'état des lieux.
--                             Lecture uniquement par un utilisateur connecté, via un lien signé de courte durée.
-- Les fichiers sont nommés d'après leur empreinte (SHA-256) : le même scan n'est stocké qu'une fois.
-- ==============================================================================

-- 1. ESPACES (BUCKETS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('vehicle-photos', 'vehicle-photos', true, 2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('morvello-files', 'morvello-files', false, 8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. POLITIQUES D'ACCÈS (storage.objects a déjà RLS activée par Supabase)
DROP POLICY IF EXISTS "morvello_files_select" ON storage.objects;
DROP POLICY IF EXISTS "morvello_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "morvello_files_delete" ON storage.objects;
DROP POLICY IF EXISTS "vehicle_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "vehicle_photos_delete" ON storage.objects;

-- Fichiers privés : un utilisateur connecté lit et ajoute ; seul le gérant supprime ; personne ne modifie.
CREATE POLICY "morvello_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'morvello-files');

CREATE POLICY "morvello_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'morvello-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "morvello_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'morvello-files' AND public.is_admin());

-- Photos de véhicules : lecture publique par adresse (bucket public) ; ajout par un utilisateur connecté ; suppression par le gérant.
CREATE POLICY "vehicle_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "vehicle_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.is_admin());
