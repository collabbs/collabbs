-- 0022 — Livraison du contenu par le créateur
--
-- Le créateur peut déposer le lien (et une note) de sa publication
-- (post TikTok/Insta/YT, dossier UGC, etc.) au moment où il marque le
-- livrable comme "livré". La marque clique pour voir et valider.

alter table public.deliverables
  add column if not exists submission_url text,
  add column if not exists submission_notes text,
  add column if not exists submitted_at timestamptz;