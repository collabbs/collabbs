-- Exemples de contenu attendus par la marque sur une campagne.
-- Affichés aux créateurs sur /opportunities/[id] comme inspiration.

create table if not exists campaign_examples (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  url         text,
  caption     text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_campaign_examples_campaign
  on campaign_examples (campaign_id, position);

alter table campaign_examples enable row level security;

-- Lecture publique (les créateurs anonymes ou loggés peuvent voir).
drop policy if exists "campaign_examples_select_public" on campaign_examples;
create policy "campaign_examples_select_public" on campaign_examples
  for select using (true);

-- Écriture réservée à la marque propriétaire de la campagne.
drop policy if exists "campaign_examples_insert_owner" on campaign_examples;
create policy "campaign_examples_insert_owner" on campaign_examples
  for insert with check (
    exists (
      select 1 from campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );

drop policy if exists "campaign_examples_update_owner" on campaign_examples;
create policy "campaign_examples_update_owner" on campaign_examples
  for update using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );

drop policy if exists "campaign_examples_delete_owner" on campaign_examples;
create policy "campaign_examples_delete_owner" on campaign_examples
  for delete using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );
