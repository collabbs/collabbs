-- Stats YouTube récupérées par l'auto-import : vues, likes, durée.
-- Permet d'afficher des signaux concrets sur la fiche créateur
-- (badges "X vues", "Short" pour vidéos < 60s, tri par popularité).

alter table creator_portfolio_items
  add column if not exists view_count bigint;

alter table creator_portfolio_items
  add column if not exists like_count integer;

alter table creator_portfolio_items
  add column if not exists duration_seconds integer;

alter table creator_portfolio_items
  add column if not exists is_short boolean not null default false;

-- Index utile pour le tri par popularité côté fiche publique
create index if not exists idx_creator_portfolio_views
  on creator_portfolio_items (creator_id, view_count desc nulls last);
