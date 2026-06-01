-- Enrichit le profil marque : description, niches ciblées, réseaux propres.

-- 1. description (pitch de la marque)
alter table brands
  add column if not exists description text;

-- 2. brand_niches : niches que la marque vise (M:N avec niches)
create table if not exists brand_niches (
  brand_id  uuid    not null references brands(id) on delete cascade,
  niche_id  integer not null references niches(id) on delete cascade,
  primary key (brand_id, niche_id)
);

alter table brand_niches enable row level security;

drop policy if exists "brand_niches_select_public" on brand_niches;
create policy "brand_niches_select_public" on brand_niches
  for select using (true);

drop policy if exists "brand_niches_insert_self" on brand_niches;
create policy "brand_niches_insert_self" on brand_niches
  for insert with check (brand_id = auth.uid());

drop policy if exists "brand_niches_delete_self" on brand_niches;
create policy "brand_niches_delete_self" on brand_niches
  for delete using (brand_id = auth.uid());

-- 3. brand_platforms : réseaux sociaux de la marque elle-même
--    (les créateurs vont vérifier @ig/tiktok de la marque avant d'accepter)
create table if not exists brand_platforms (
  brand_id    uuid    not null references brands(id) on delete cascade,
  platform_id integer not null references platforms(id) on delete cascade,
  handle      text,
  url         text,
  primary key (brand_id, platform_id)
);

alter table brand_platforms enable row level security;

drop policy if exists "brand_platforms_select_public" on brand_platforms;
create policy "brand_platforms_select_public" on brand_platforms
  for select using (true);

drop policy if exists "brand_platforms_insert_self" on brand_platforms;
create policy "brand_platforms_insert_self" on brand_platforms
  for insert with check (brand_id = auth.uid());

drop policy if exists "brand_platforms_update_self" on brand_platforms;
create policy "brand_platforms_update_self" on brand_platforms
  for update using (brand_id = auth.uid());

drop policy if exists "brand_platforms_delete_self" on brand_platforms;
create policy "brand_platforms_delete_self" on brand_platforms
  for delete using (brand_id = auth.uid());
