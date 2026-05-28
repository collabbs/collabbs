-- ============================================================
-- Collabbs · Schéma DB — Brique 3 : Deals & Contrats
-- ------------------------------------------------------------
-- Migration 0004
-- À appliquer via : Supabase Dashboard → SQL Editor → coller → Run
-- ============================================================

-- ---------- Types ----------
create type public.deal_status     as enum ('negotiation', 'active', 'completed', 'cancelled');
create type public.deal_format     as enum ('video_post', 'ugc', 'story', 'reel', 'live');
create type public.contract_status as enum ('draft', 'pending_signature', 'signed', 'terminated');

-- ============================================================
-- deals : collaboration vidéo entre une marque et un créateur
-- ============================================================
create table public.deals (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references public.brands(id)    on delete cascade,
  creator_id          uuid not null references public.creators(id)  on delete cascade,
  campaign_id         uuid references public.campaigns(id) on delete set null,  -- origine éventuelle
  title               text,
  amount              integer not null,                       -- € TTC
  format              public.deal_format not null,
  platform_id         smallint references public.platforms(id),
  quantity            integer not null default 1,             -- nb de publications
  deadline            date,
  usage_rights_months smallint default 6,                     -- 0 = illimité
  exclusivity         boolean not null default false,
  exclusivity_days    smallint,
  brand_notes         text,
  status              public.deal_status not null default 'negotiation',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.deals (brand_id);
create index on public.deals (creator_id);
create index on public.deals (campaign_id);
create index on public.deals (status);

-- ============================================================
-- deliverables : livrables d'un deal (1 deal → N livrables)
-- ============================================================
create table public.deliverables (
  id                 uuid primary key default gen_random_uuid(),
  deal_id            uuid not null references public.deals(id) on delete cascade,
  label              text not null,                  -- "Vidéo TikTok 60-90s"
  position           smallint not null default 0,    -- ordre d'affichage
  done               boolean not null default false, -- soumis par le créateur
  approved           boolean not null default false, -- validé par la marque
  revision_requested boolean not null default false,
  revision_message   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.deliverables (deal_id);

-- ============================================================
-- contracts : document légal lié à un deal (1-1), snapshot immuable
-- ============================================================
create table public.contracts (
  id                uuid primary key default gen_random_uuid(),
  deal_id           uuid not null unique references public.deals(id) on delete cascade,
  reference         text not null unique,            -- CLB-xxxxx
  status            public.contract_status not null default 'draft',
  terms_snapshot    jsonb,                           -- copie figée des termes à la génération
  creator_signed_at timestamptz,
  brand_signed_at   timestamptz,
  terminated_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.contracts (deal_id);

-- ---------- Triggers updated_at ----------
create trigger trg_deals_updated before update on public.deals
  for each row execute function public.set_updated_at();
create trigger trg_deliverables_updated before update on public.deliverables
  for each row execute function public.set_updated_at();
create trigger trg_contracts_updated before update on public.contracts
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security — un deal est privé entre ses 2 parties
-- ============================================================
alter table public.deals        enable row level security;
alter table public.deliverables enable row level security;
alter table public.contracts    enable row level security;

-- deals : visibles par les 2 parties ; créés par la marque ; modifiables par les 2
create policy "deals_select_parties" on public.deals
  for select using (brand_id = auth.uid() or creator_id = auth.uid());
create policy "deals_insert_brand" on public.deals
  for insert with check (brand_id = auth.uid());
create policy "deals_update_parties" on public.deals
  for update using (brand_id = auth.uid() or creator_id = auth.uid());

-- deliverables : héritent de la confidentialité du deal parent
create policy "deliverables_select" on public.deliverables
  for select using (
    exists (select 1 from public.deals d
            where d.id = deal_id and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
  );
create policy "deliverables_write" on public.deliverables
  for all using (
    exists (select 1 from public.deals d
            where d.id = deal_id and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
  ) with check (
    exists (select 1 from public.deals d
            where d.id = deal_id and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
  );

-- contracts : idem, via le deal parent
create policy "contracts_select" on public.contracts
  for select using (
    exists (select 1 from public.deals d
            where d.id = deal_id and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
  );
create policy "contracts_write" on public.contracts
  for all using (
    exists (select 1 from public.deals d
            where d.id = deal_id and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
  ) with check (
    exists (select 1 from public.deals d
            where d.id = deal_id and (d.brand_id = auth.uid() or d.creator_id = auth.uid()))
  );

-- ---------- Permissions (idempotent) ----------
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- Fin Brique 3
-- ============================================================
