-- ============================================================
-- Collabbs · Schéma DB — Brique 2 : Marketplace
-- Campagnes/programmes + candidatures
-- ------------------------------------------------------------
-- Migration 0003
-- À appliquer via : Supabase Dashboard → SQL Editor → coller → Run
-- ============================================================

-- ---------- Types ----------
create type public.campaign_type        as enum ('affiliation', 'video', 'hybrid');
create type public.commission_type      as enum ('percentage', 'fixed_per_action', 'recurring');
create type public.campaign_status      as enum ('draft', 'active', 'ended');
create type public.content_tone         as enum ('authentic', 'educational', 'testimonial');
create type public.application_status    as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type public.application_initiator as enum ('creator', 'brand');

-- ============================================================
-- campaigns : une offre proposée par une marque
-- (= "programme" côté créateur, "campagne" côté marque)
-- ============================================================
create table public.campaigns (
  id               uuid primary key default gen_random_uuid(),
  brand_id         uuid not null references public.brands(id) on delete cascade,
  name             text not null,
  category         text,                              -- libellé d'affichage
  type             public.campaign_type not null,
  -- Rémunération affiliation (si type affiliation/hybrid)
  commission_type  public.commission_type,
  commission_value numeric(10,2),                     -- 8 (%) | 50 (€) | 20 (% récurrent)
  commission_unit  text,                              -- "par vente", "par inscription"...
  -- Rémunération deal vidéo (si type video/hybrid)
  fixed_amount     integer,                           -- € fixe
  -- Exigences / brief
  description      text,
  requirements     text,                              -- livrables attendus
  tone             public.content_tone,
  avoid            text,                              -- à éviter
  min_subscribers  integer,                           -- abonnés minimum requis
  spots            integer,                           -- places dispo (null = illimité)
  status           public.campaign_status not null default 'draft',
  starts_at        date,
  ends_at          date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.campaigns (brand_id);
create index on public.campaigns (status);

-- ---------- Ciblage : niches & plateformes ----------
create table public.campaign_niches (
  campaign_id uuid     not null references public.campaigns(id) on delete cascade,
  niche_id    smallint not null references public.niches(id)    on delete cascade,
  primary key (campaign_id, niche_id)
);

create table public.campaign_platforms (
  campaign_id uuid     not null references public.campaigns(id)  on delete cascade,
  platform_id smallint not null references public.platforms(id)  on delete cascade,
  primary key (campaign_id, platform_id)
);

-- ============================================================
-- applications : candidature (créateur postule) ou invitation (marque invite)
-- ============================================================
create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  creator_id   uuid not null references public.creators(id)  on delete cascade,
  status       public.application_status    not null default 'pending',
  initiated_by public.application_initiator not null,
  message      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index on public.applications (campaign_id);
create index on public.applications (creator_id);

-- ---------- Triggers updated_at ----------
create trigger trg_campaigns_updated before update on public.campaigns
  for each row execute function public.set_updated_at();
create trigger trg_applications_updated before update on public.applications
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.campaigns          enable row level security;
alter table public.campaign_niches    enable row level security;
alter table public.campaign_platforms enable row level security;
alter table public.applications       enable row level security;

-- campaigns : active = visible par tous ; la marque voit toutes les siennes
create policy "campaigns_select_active_or_own" on public.campaigns
  for select using (status = 'active' or brand_id = auth.uid());
create policy "campaigns_insert_own" on public.campaigns
  for insert with check (brand_id = auth.uid());
create policy "campaigns_update_own" on public.campaigns
  for update using (brand_id = auth.uid());
create policy "campaigns_delete_own" on public.campaigns
  for delete using (brand_id = auth.uid());

-- ciblage : lisible si la campagne l'est ; modifiable par la marque propriétaire
create policy "campaign_niches_select" on public.campaign_niches
  for select using (
    exists (select 1 from public.campaigns c
            where c.id = campaign_id and (c.status = 'active' or c.brand_id = auth.uid()))
  );
create policy "campaign_niches_write_own" on public.campaign_niches
  for all using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  );

create policy "campaign_platforms_select" on public.campaign_platforms
  for select using (
    exists (select 1 from public.campaigns c
            where c.id = campaign_id and (c.status = 'active' or c.brand_id = auth.uid()))
  );
create policy "campaign_platforms_write_own" on public.campaign_platforms
  for all using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  ) with check (
    exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  );

-- applications : créateur voit les siennes ; marque voit celles de ses campagnes
create policy "applications_select" on public.applications
  for select using (
    creator_id = auth.uid()
    or exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  );
-- insert : créateur postule (pour lui) OU marque invite (sur sa campagne)
create policy "applications_insert" on public.applications
  for insert with check (
    (initiated_by = 'creator' and creator_id = auth.uid())
    or (initiated_by = 'brand'
        and exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid()))
  );
-- update : créateur (retire) ou marque (accepte/refuse)
create policy "applications_update" on public.applications
  for update using (
    creator_id = auth.uid()
    or exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  );

-- ============================================================
-- Permissions (les default privileges de 0002 couvrent déjà les nouvelles
-- tables ; on re-grant par sécurité — idempotent)
-- ============================================================
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- Fin Brique 2
-- ============================================================
