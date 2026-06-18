-- Sprint B v2 — Refonte architecture campagne
-- Plus de types exclusifs : une campagne a (1) un modèle de paiement créateur
-- et (2) un ou plusieurs assets activés (lien d'affi, code promo, concours).
-- Chaque asset a son propre tracking. Permet le cas Revolut : payer le créateur
-- à la palier d'inscriptions + offrir 20€ à chaque inscrit + concours pour
-- gagner 5000€.
-- Appliqué via MCP Supabase (apply_migration).

-- ============================================================
-- 1. Nouveaux modèles de paiement créateur
-- ============================================================
-- cpa_flat   : X€ par action (inscription, achat, lead…)
-- cpa_tiers  : paliers d'actions (1000 inscrits = 200€, 5000 = 1000€, …)
alter type campaign_type add value if not exists 'cpa_flat';
alter type campaign_type add value if not exists 'cpa_tiers';

-- Note : les valeurs 'promo_code' et 'giveaway' du sprint précédent restent
-- dans l'enum (Postgres ne supprime pas facilement une valeur d'enum sans
-- drop+recreate). Elles ne sont plus utilisées comme TYPE — elles deviennent
-- des ASSETS (cf flags with_* ci-dessous).

-- ============================================================
-- 2. Flags d'assets activés sur la campagne
-- ============================================================
alter table campaigns
  add column if not exists with_promo_code boolean not null default false,
  add column if not exists with_giveaway boolean not null default false;

-- Commission spécifique aux ventes via code promo (en %).
alter table campaigns
  add column if not exists promo_commission_pct smallint;

-- CPA flat : libellé de l'action + montant par action
alter table campaigns
  add column if not exists cpa_action_label text,
  add column if not exists cpa_value_per_action integer;

-- ============================================================
-- 3. Table des paliers CPA (cas Revolut)
-- ============================================================
create table if not exists campaign_cpa_tiers (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  min_actions  integer not null check (min_actions > 0),
  payout       integer not null check (payout > 0),
  label        text,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cpa_tiers_campaign
  on campaign_cpa_tiers (campaign_id, min_actions);

alter table campaign_cpa_tiers enable row level security;

drop policy if exists "cpa_tiers_select_public" on campaign_cpa_tiers;
create policy "cpa_tiers_select_public" on campaign_cpa_tiers
  for select using (true);

drop policy if exists "cpa_tiers_insert_owner" on campaign_cpa_tiers;
create policy "cpa_tiers_insert_owner" on campaign_cpa_tiers
  for insert with check (
    exists (
      select 1 from campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );

drop policy if exists "cpa_tiers_update_owner" on campaign_cpa_tiers;
create policy "cpa_tiers_update_owner" on campaign_cpa_tiers
  for update using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );

drop policy if exists "cpa_tiers_delete_owner" on campaign_cpa_tiers;
create policy "cpa_tiers_delete_owner" on campaign_cpa_tiers
  for delete using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_id and c.brand_id = auth.uid()
    )
  );

-- ============================================================
-- 4. Tracking code promo : on étend affiliate_links + affiliate_events
-- ============================================================
alter table affiliate_links
  add column if not exists promo_code text;

create index if not exists idx_affiliate_links_promo_code
  on affiliate_links (promo_code) where promo_code is not null;

alter table affiliate_events
  add column if not exists source text not null default 'link';

alter table affiliate_events drop constraint if exists affiliate_events_source_check;
alter table affiliate_events
  add constraint affiliate_events_source_check
  check (source in ('link', 'promo_code', 'cpa_action'));

alter table affiliate_events
  add column if not exists action_count integer not null default 1
  check (action_count >= 0);
