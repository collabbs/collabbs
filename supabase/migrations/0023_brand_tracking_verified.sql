-- 0023 — État de vérification du tracking côté marque
--
-- Mis à jour automatiquement par /api/track/verify-install dès que la marque
-- a installé le script et qu'on l'a confirmé sur sa page d'accueil.
-- null = non vérifié · timestamp = dernière vérif réussie.

alter table public.brands
  add column if not exists tracking_verified_at timestamptz;