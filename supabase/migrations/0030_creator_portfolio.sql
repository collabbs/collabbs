-- Portfolio de vidéos / contenus du créateur, affiché sur sa fiche publique
-- pour que les marques voient des exemples concrets de son style.

create table if not exists creator_portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references creators(id) on delete cascade,
  url           text not null,
  title         text,
  thumbnail_url text,
  platform_slug text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_creator_portfolio_creator
  on creator_portfolio_items (creator_id, position);

alter table creator_portfolio_items enable row level security;

-- Lecture publique : tout le monde peut voir le portfolio d'un créateur
-- (cohérent avec /creators/[handle] qui est publique).
drop policy if exists "creator_portfolio_select_public" on creator_portfolio_items;
create policy "creator_portfolio_select_public" on creator_portfolio_items
  for select using (true);

-- Écriture réservée au propriétaire (le créateur lui-même).
drop policy if exists "creator_portfolio_insert_self" on creator_portfolio_items;
create policy "creator_portfolio_insert_self" on creator_portfolio_items
  for insert with check (creator_id = auth.uid());

drop policy if exists "creator_portfolio_update_self" on creator_portfolio_items;
create policy "creator_portfolio_update_self" on creator_portfolio_items
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists "creator_portfolio_delete_self" on creator_portfolio_items;
create policy "creator_portfolio_delete_self" on creator_portfolio_items
  for delete using (creator_id = auth.uid());
