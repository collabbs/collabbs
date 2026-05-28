-- ============================================================
-- Collabbs · Schéma DB — Brique 4 : Transactions / Escrow / Affiliation
-- ------------------------------------------------------------
-- Migration 0005
-- Modèle économique : commission Collabbs à 0% par défaut (réversible).
-- La structure gross/fee/net encaisse n'importe quel modèle futur.
-- Sécurité : transactions & affiliate_events sont en LECTURE pour les
-- parties, mais leur ÉCRITURE est réservée au backend (service_role qui
-- bypasse la RLS) — aucune policy insert/update pour anon/authenticated.
-- À appliquer via : Supabase Dashboard → SQL Editor → coller → Run
-- ============================================================

-- ---------- Types ----------
create type public.transaction_type    as enum ('deal_payment', 'affiliate_payout');
create type public.transaction_status  as enum ('pending', 'in_escrow', 'released', 'paid', 'refunded', 'cancelled');
create type public.affiliate_event_type as enum ('click', 'sale');

-- ============================================================
-- transactions : flux d'argent (paiement de deal via escrow, ou payout affiliation)
-- ============================================================
create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  type               public.transaction_type not null,
  deal_id            uuid references public.deals(id)    on delete set null,  -- null si affiliation
  creator_id         uuid not null references public.creators(id) on delete cascade,  -- bénéficiaire
  brand_id           uuid references public.brands(id)   on delete set null,  -- payeur (deal)
  gross_amount       numeric(12,2) not null,                 -- montant brut
  platform_fee_rate  numeric(5,2)  not null default 0,        -- % commission Collabbs (0 pour l'instant)
  platform_fee       numeric(12,2) not null default 0,        -- montant de la commission
  net_amount         numeric(12,2) not null,                  -- net pour le créateur
  currency           text not null default 'EUR',
  status             public.transaction_status not null default 'pending',
  reference          text unique,                             -- PAY-xxxx
  escrow_released_at timestamptz,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.transactions (creator_id);
create index on public.transactions (brand_id);
create index on public.transactions (deal_id);
create index on public.transactions (status);

-- ============================================================
-- affiliate_links : lien de tracking unique créateur ↔ campagne
-- ============================================================
create table public.affiliate_links (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references public.creators(id)  on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code        text not null unique,                          -- code de tracking
  created_at  timestamptz not null default now(),
  unique (creator_id, campaign_id)
);
create index on public.affiliate_links (creator_id);
create index on public.affiliate_links (campaign_id);

-- ============================================================
-- affiliate_events : chaque clic / vente sur un lien
-- ============================================================
create table public.affiliate_events (
  id                uuid primary key default gen_random_uuid(),
  link_id           uuid not null references public.affiliate_links(id) on delete cascade,
  type              public.affiliate_event_type not null,
  sale_amount       numeric(12,2),                           -- montant vente (si sale)
  commission_amount numeric(12,2),                           -- commission créateur (si sale)
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index on public.affiliate_events (link_id);
create index on public.affiliate_events (type);

-- ---------- Trigger updated_at ----------
create trigger trg_transactions_updated before update on public.transactions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.transactions     enable row level security;
alter table public.affiliate_links  enable row level security;
alter table public.affiliate_events enable row level security;

-- transactions : LECTURE par les parties uniquement.
-- Aucune policy d'écriture -> seul le backend (service_role) crée/modifie.
create policy "transactions_select_parties" on public.transactions
  for select using (creator_id = auth.uid() or brand_id = auth.uid());

-- affiliate_links : le créateur gère les siens ; la marque voit ceux de ses campagnes
create policy "affiliate_links_select" on public.affiliate_links
  for select using (
    creator_id = auth.uid()
    or exists (select 1 from public.campaigns c where c.id = campaign_id and c.brand_id = auth.uid())
  );
create policy "affiliate_links_insert_own" on public.affiliate_links
  for insert with check (creator_id = auth.uid());
create policy "affiliate_links_delete_own" on public.affiliate_links
  for delete using (creator_id = auth.uid());

-- affiliate_events : LECTURE par le créateur propriétaire du lien.
-- Aucune policy d'écriture -> tracking inséré par le backend (service_role).
create policy "affiliate_events_select" on public.affiliate_events
  for select using (
    exists (select 1 from public.affiliate_links l where l.id = link_id and l.creator_id = auth.uid())
  );

-- ---------- Permissions (idempotent) ----------
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- Fin Brique 4
-- ============================================================
