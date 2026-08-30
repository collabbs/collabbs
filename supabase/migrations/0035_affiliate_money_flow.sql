-- Sprint C — Circuit d'argent de l'affiliation
--
-- Problème résolu : jusqu'ici une vente d'affiliation était enregistrée avec un
-- montant de commission... et rien d'autre. Aucun statut, aucun encaissement,
-- aucun versement. Le créateur voyait des chiffres qui ne devenaient jamais de
-- l'argent.
--
-- Modèle retenu (décidé le 29/08/2026) : PROVISION.
--   La marque enregistre une carte et dépose une avance. Chaque vente réserve
--   immédiatement la commission sur cette provision, ce qui garantit le paiement
--   du créateur dès la vente. Recharge automatique sous un seuil.
--
--   Frais Collabbs : payés PAR LA MARQUE EN PLUS de la commission créateur.
--   Le créateur touche exactement le taux annoncé par la campagne.
--
--   Délai de validation : 30 jours (retours / remboursements), puis versement
--   mensuel avec un minimum de 20 €.

-- ============================================================
-- 1. Cycle de vie d'une vente d'affiliation
-- ============================================================
do $$ begin
  create type public.affiliate_event_status as enum (
    'unfunded',   -- provision insuffisante : commission due mais non couverte
    'pending',    -- réservée sur la provision, en attente de validation
    'validated',  -- délai écoulé, définitivement acquise au créateur
    'paid',       -- versée au créateur
    'refunded',   -- vente remboursée : réservation rendue à la marque
    'rejected'    -- écartée (fraude, refus motivé, données de test)
  );
exception when duplicate_object then null;
end $$;

alter table public.affiliate_events
  -- null pour les clics : le statut ne concerne que les ventes
  add column if not exists status       public.affiliate_event_status,
  -- frais Collabbs sur cette vente, payés par la marque EN PLUS de la commission
  add column if not exists platform_fee numeric(12,2) not null default 0,
  -- date à laquelle la vente devient définitive (occurred_at + délai)
  add column if not exists validate_at  timestamptz,
  add column if not exists paid_at      timestamptz,
  add column if not exists refunded_at  timestamptz,
  add column if not exists reject_reason text,
  -- versement qui a réglé cette vente
  add column if not exists payout_id    uuid references public.transactions(id) on delete set null;

-- Les ventes déjà en base datent d'avant ce circuit (tests pixel/postback du
-- 30 mai). On les écarte explicitement pour qu'aucun versement ne les ramasse.
update public.affiliate_events
   set status = 'rejected',
       reject_reason = 'antérieure au circuit de paiement (donnée de test)'
 where type = 'sale' and status is null;

-- Cohérence : une vente a toujours un statut, un clic n'en a jamais.
alter table public.affiliate_events drop constraint if exists affiliate_events_status_check;
alter table public.affiliate_events
  add constraint affiliate_events_status_check check (
    (type = 'sale' and status is not null) or (type = 'click' and status is null)
  );

create index if not exists idx_affiliate_events_to_validate
  on public.affiliate_events (validate_at) where status = 'pending';
create index if not exists idx_affiliate_events_to_pay
  on public.affiliate_events (link_id) where status = 'validated';
create index if not exists idx_affiliate_events_payout
  on public.affiliate_events (payout_id);

-- ============================================================
-- 2. Provision et moyen de paiement de la marque
-- ============================================================
alter table public.brands
  -- client Stripe : permet de débiter la carte hors session (recharge auto)
  add column if not exists stripe_customer_id       text,
  add column if not exists payment_method_id        text,
  -- solde de la provision, en euros
  add column if not exists balance                  numeric(12,2) not null default 0,
  add column if not exists autotopup_enabled        boolean not null default false,
  add column if not exists autotopup_threshold      numeric(12,2) not null default 50,
  add column if not exists autotopup_amount         numeric(12,2) not null default 200,
  -- dernier échec de recharge : sert à alerter et à couper les campagnes
  add column if not exists topup_failed_at          timestamptz;

create index if not exists idx_brands_stripe_customer
  on public.brands (stripe_customer_id) where stripe_customer_id is not null;

-- ============================================================
-- 3. Registre des mouvements — toute variation de solde y est tracée
-- ============================================================
-- Règle : on ne modifie JAMAIS brands.balance directement. On passe par les
-- fonctions ci-dessous, qui écrivent une ligne de registre à chaque mouvement.
-- Le solde est ainsi toujours reconstituable, ce qui est indispensable quand on
-- manipule l'argent d'autrui.
do $$ begin
  create type public.ledger_kind as enum (
    'topup',            -- la marque approvisionne (carte débitée)
    'reserve',          -- une vente réserve la commission + les frais
    'reserve_release',  -- vente remboursée ou rejetée : on rend la réservation
    'payout',           -- versement effectif au créateur
    'adjustment'        -- correction manuelle (litige, geste commercial)
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.brand_ledger (
  id                  uuid primary key default gen_random_uuid(),
  brand_id            uuid not null references public.brands(id) on delete cascade,
  kind                public.ledger_kind not null,
  -- signé : positif = crédite la provision, négatif = la débite
  amount              numeric(12,2) not null,
  balance_after       numeric(12,2) not null,
  affiliate_event_id  uuid references public.affiliate_events(id) on delete set null,
  transaction_id      uuid references public.transactions(id)     on delete set null,
  stripe_ref          text,
  label               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_brand_ledger_brand
  on public.brand_ledger (brand_id, created_at desc);

alter table public.brand_ledger enable row level security;

-- La marque lit son propre registre. Personne ne l'écrit depuis le navigateur :
-- toutes les écritures passent par le service_role côté serveur.
drop policy if exists "ledger_select_owner" on public.brand_ledger;
create policy "ledger_select_owner" on public.brand_ledger
  for select using (brand_id = auth.uid());

grant select on public.brand_ledger to authenticated;
grant all    on public.brand_ledger to service_role;

-- ============================================================
-- 4. Mouvements atomiques
-- ============================================================
-- Deux ventes peuvent arriver en même temps sur la même marque (webhook + pixel).
-- Sans verrou, les deux liraient le même solde et le débiteraient deux fois.
-- Ces fonctions verrouillent la ligne de la marque le temps du mouvement.

-- Réserve (commission + frais) sur la provision d'une marque.
-- Renvoie true si la réservation est passée, false si la provision est insuffisante.
create or replace function public.reserve_commission(
  p_brand   uuid,
  p_event   uuid,
  p_amount  numeric,
  p_label   text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(12,2);
begin
  if p_amount <= 0 then
    return true;  -- rien à réserver
  end if;

  -- verrou sur la marque : les mouvements concurrents attendent leur tour
  select balance into v_balance
    from public.brands where id = p_brand for update;

  if v_balance is null or v_balance < p_amount then
    return false;  -- provision insuffisante, l'appelant marquera 'unfunded'
  end if;

  v_balance := v_balance - p_amount;
  update public.brands set balance = v_balance where id = p_brand;

  insert into public.brand_ledger (brand_id, kind, amount, balance_after, affiliate_event_id, label)
  values (p_brand, 'reserve', -p_amount, v_balance, p_event, p_label);

  return true;
end $$;

-- Crédite la provision : approvisionnement, remboursement d'une vente, correction.
create or replace function public.credit_balance(
  p_brand      uuid,
  p_amount     numeric,
  p_kind       public.ledger_kind,
  p_event      uuid default null,
  p_stripe_ref text default null,
  p_label      text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(12,2);
begin
  if p_amount <= 0 then
    raise exception 'credit_balance : montant devant être positif (reçu %)', p_amount;
  end if;

  select balance into v_balance
    from public.brands where id = p_brand for update;

  if v_balance is null then
    raise exception 'credit_balance : marque % introuvable', p_brand;
  end if;

  v_balance := v_balance + p_amount;
  update public.brands set balance = v_balance where id = p_brand;

  insert into public.brand_ledger (brand_id, kind, amount, balance_after, affiliate_event_id, stripe_ref, label)
  values (p_brand, p_kind, p_amount, v_balance, p_event, p_stripe_ref, p_label);

  return v_balance;
end $$;

-- Ces fonctions déplacent de l'argent : elles ne doivent jamais être appelables
-- depuis le navigateur. Seul le code serveur (service_role) y a accès.
revoke execute on function public.reserve_commission(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke execute on function public.credit_balance(uuid, numeric, public.ledger_kind, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.reserve_commission(uuid, uuid, numeric, text) to service_role;
grant  execute on function public.credit_balance(uuid, numeric, public.ledger_kind, uuid, text, text) to service_role;
