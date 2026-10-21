-- ==============================================================================
-- MORVELLO CARS - NOTIFICATIONS PUSH : abonnements des appareils
-- À exécuter une fois dans Supabase : SQL Editor > New Query > Coller > Run
-- (le script peut être relancé sans risque).
--
-- Cette table n'est lue et écrite QUE par le serveur (clé service_role).
-- RLS est activée SANS aucune politique : ni `anon` ni `authenticated` ne peuvent y accéder
-- depuis le navigateur. Les clés de chiffrement d'un abonnement (p256dh, auth) ne doivent
-- jamais être lisibles par un autre utilisateur.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  -- Date (heure du Maroc) du dernier résumé du matin envoyé à cet appareil : évite un doublon après un redémarrage du serveur
  last_digest_on DATE,
  -- Identifiants des alertes critiques déjà notifiées à cet appareil
  sent_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Retire d'éventuelles politiques créées à la main : aucune ne doit exister.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.push_subscriptions', pol.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
