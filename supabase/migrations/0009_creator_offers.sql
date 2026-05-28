-- 0009_creator_offers.sql
-- Les 5 façons de collaborer proposées par un créateur, avec leur tarif.
-- Renseignées à l'onboarding ; lues par la marketplace /creators.

create type offer_type as enum ('ugc', 'post', 'perf', 'affil', 'story');

create table creator_offers (
  creator_id uuid not null references creators(id) on delete cascade,
  offer offer_type not null,
  price integer, -- prix de départ en euros ; null = à la performance / commission
  created_at timestamptz not null default now(),
  primary key (creator_id, offer)
);

alter table creator_offers enable row level security;

-- Lecture publique (vitrine /creators)
create policy "creator_offers_select_public"
  on creator_offers for select
  to anon, authenticated
  using (true);

-- Le créateur gère uniquement ses propres offres (creators.id = auth.uid())
create policy "creator_offers_modify_own"
  on creator_offers for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

grant select on creator_offers to anon, authenticated;
grant insert, update, delete on creator_offers to authenticated;
