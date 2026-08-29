-- Réputation des marques
--
-- Jusqu'ici la notation était à sens unique : la marque note le créateur, et
-- ce dernier n'a aucun moyen de savoir à qui il a affaire. Sur une place de
-- marché où les créateurs sont le côté à convaincre, c'est l'asymétrie la plus
-- coûteuse : un créateur échaudé par une marque qui ne paie pas ne revient pas,
-- et le raconte.
--
-- Deux mécanismes complémentaires :
--
--  1. **L'avis** — subjectif, laissé par le créateur après une collaboration
--     terminée. Miroir exact de ce qui existe déjà dans l'autre sens.
--
--  2. **La fiabilité mesurée** — objective, calculée à partir de ce que la
--     plateforme constate déjà : la marque a-t-elle payé dans le délai ?
--     a-t-elle validé la livraison, ou le versement s'est-il déclenché tout
--     seul faute de réponse ? Cette seconde mesure vaut bien plus qu'une note
--     étoilée, parce qu'elle ne se déclare pas : elle se constate.

create table if not exists public.brand_reviews (
  id         uuid primary key default gen_random_uuid(),
  -- Un seul avis par collaboration, comme dans l'autre sens.
  deal_id    uuid unique references public.deals(id) on delete set null,
  brand_id   uuid not null references public.brands(id)   on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_reviews_brand
  on public.brand_reviews (brand_id, created_at desc);

alter table public.brands
  add column if not exists rating        numeric(3,2),
  add column if not exists reviews_count integer not null default 0;

-- ============================================================
-- Recalcul de la note — même principe que pour les créateurs
-- ============================================================
create or replace function public.recompute_brand_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand uuid := coalesce(new.brand_id, old.brand_id);
begin
  update public.brands b
     set rating = sub.avg_rating,
         reviews_count = sub.n
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
        from public.brand_reviews
       where brand_id = v_brand
    ) sub
   where b.id = v_brand;
  return null;
end $$;

drop trigger if exists trg_brand_reviews_recompute on public.brand_reviews;
create trigger trg_brand_reviews_recompute
  after insert or update or delete on public.brand_reviews
  for each row execute function public.recompute_brand_rating();

-- ============================================================
-- Accès
-- ============================================================
alter table public.brand_reviews enable row level security;

-- Les avis sur les marques sont publics : c'est tout leur intérêt. Un créateur
-- doit pouvoir consulter la réputation d'une marque AVANT de s'engager avec
-- elle, sans avoir besoin d'un compte ni d'une relation préalable.
drop policy if exists "brand_reviews_select_public" on public.brand_reviews;
create policy "brand_reviews_select_public" on public.brand_reviews
  for select using (true);

-- Seul le créateur concerné écrit, et seulement sur une collaboration terminée
-- à laquelle il a participé. La vérification du deal se fait côté serveur.
drop policy if exists "brand_reviews_insert_creator" on public.brand_reviews;
create policy "brand_reviews_insert_creator" on public.brand_reviews
  for insert with check (creator_id = auth.uid());

drop policy if exists "brand_reviews_update_creator" on public.brand_reviews;
create policy "brand_reviews_update_creator" on public.brand_reviews
  for update using (creator_id = auth.uid());

grant select on public.brand_reviews to anon, authenticated;
grant insert, update on public.brand_reviews to authenticated;
grant all on public.brand_reviews to service_role;

comment on table public.brand_reviews is
  'Avis laissés par les créateurs sur les marques. Miroir de `reviews`, qui va dans l''autre sens.';
comment on column public.brands.rating is
  'Note moyenne reçue des créateurs. Recalculée par trigger, jamais écrite à la main.';
