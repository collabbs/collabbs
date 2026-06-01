-- 0025 — Shortlist créateurs côté marque
--
-- Une marque peut sauver des créateurs qu'elle veut revoir/contacter plus tard.
-- (id, brand_id, creator_id, notes, created_at). Clé unique sur le couple
-- (brand, créateur) pour éviter les doublons.

create table if not exists public.brand_creator_saves (
  brand_id    uuid not null references public.brands(id) on delete cascade,
  creator_id  uuid not null references public.creators(id) on delete cascade,
  notes       text,
  created_at  timestamptz not null default now(),
  primary key (brand_id, creator_id)
);

alter table public.brand_creator_saves enable row level security;

-- La marque voit/écrit uniquement ses propres saves.
drop policy if exists "brand_saves_select_own" on public.brand_creator_saves;
create policy "brand_saves_select_own" on public.brand_creator_saves
  for select using (brand_id = auth.uid());

drop policy if exists "brand_saves_insert_own" on public.brand_creator_saves;
create policy "brand_saves_insert_own" on public.brand_creator_saves
  for insert with check (brand_id = auth.uid());

drop policy if exists "brand_saves_delete_own" on public.brand_creator_saves;
create policy "brand_saves_delete_own" on public.brand_creator_saves
  for delete using (brand_id = auth.uid());

-- Index sur creator_id pour lister rapidement "qui a sauvé X" (futur).
create index if not exists brand_creator_saves_creator_idx
  on public.brand_creator_saves (creator_id);
