-- 0018 — Champs marketplace sur creators
--
-- `engagement` : taux d'engagement moyen (%), affiché sur la marketplace.
-- `is_demo`    : marque les créateurs de démonstration (données fictives),
--                pour pouvoir tout supprimer d'une requête avant la prod.
alter table public.creators
  add column if not exists engagement numeric(4, 1),
  add column if not exists is_demo boolean not null default false;
