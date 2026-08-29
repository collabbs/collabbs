-- Intégrité du rail d'affiliation
--
-- Deux trous constatés une fois l'argent mis en circulation.
--
-- 1. LES CLICS NE SONT PAS DÉDUPLIQUÉS. La route /r/{code} insérait un clic à
--    chaque appel, sans aucune empreinte du visiteur. Rafraîchir la page
--    trente fois créait trente clics. Conséquence : les taux de conversion
--    affichés aux marques ne valent rien, et un créateur peut gonfler ses
--    statistiques sans effort. Ce n'est pas un vol d'argent — seules les ventes
--    rémunèrent — mais c'est une perte de confiance dans le seul chiffre que la
--    marque regarde avant de reconduire une campagne.
--
-- 2. UNE VENTE REMBOURSÉE APRÈS VERSEMENT N'A AUCUN RECOURS. La commission est
--    partie chez le créateur, la marque a remboursé son client, et rien ne
--    permettait de régulariser. On ne peut pas reprendre de l'argent déjà
--    versé ; la pratique du secteur est de le déduire du versement suivant.

-- ============================================================
-- 1. Déduplication des clics
-- ============================================================
alter table public.affiliate_events
  -- Empreinte non réversible du visiteur (IP + agent + lien, signée par un
  -- secret serveur). Propre à chaque lien : impossible de recouper un même
  -- visiteur entre deux marques. Cohérent avec la politique de confidentialité,
  -- qui annonce des adresses IP conservées uniquement sous forme empreintée.
  add column if not exists visitor_hash text,
  -- Jour du clic, pour borner l'unicité à la journée.
  add column if not exists click_day date;

-- Un visiteur, un lien, un jour = un clic. Rafraîchir ne compte plus.
-- Index partiel : ne concerne que les clics, jamais les ventes.
create unique index if not exists uniq_click_visitor_day
  on public.affiliate_events (link_id, visitor_hash, click_day)
  where type = 'click' and visitor_hash is not null;

-- ============================================================
-- 2. Fenêtre d'attribution configurable
-- ============================================================
alter table public.campaigns
  -- Durée pendant laquelle un clic reste attribuable à une vente. 30 jours par
  -- défaut, comme le standard du secteur, mais certaines marques au cycle
  -- d'achat long en veulent davantage.
  add column if not exists attribution_days smallint not null default 30
    check (attribution_days between 1 and 365);

-- ============================================================
-- 3. Régularisations après remboursement
-- ============================================================
-- Quand une vente est remboursée APRÈS que la commission a été versée, on ne
-- reprend rien : on inscrit une dette qui sera déduite du prochain versement.
create table if not exists public.affiliate_clawbacks (
  id                 uuid primary key default gen_random_uuid(),
  creator_id         uuid not null references public.creators(id) on delete cascade,
  brand_id           uuid references public.brands(id) on delete set null,
  affiliate_event_id uuid references public.affiliate_events(id) on delete set null,
  -- Montant à récupérer, positif.
  amount             numeric(12,2) not null check (amount > 0),
  reason             text,
  -- Renseigné quand la dette a effectivement été déduite d'un versement.
  settled_at         timestamptz,
  settled_by_tx      uuid references public.transactions(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_clawbacks_open
  on public.affiliate_clawbacks (creator_id) where settled_at is null;

alter table public.affiliate_clawbacks enable row level security;

-- Le créateur voit ce qu'on lui déduit et pourquoi — une retenue silencieuse
-- serait le meilleur moyen de le perdre. La marque voit ce qu'on lui restitue.
drop policy if exists "clawbacks_select_parties" on public.affiliate_clawbacks;
create policy "clawbacks_select_parties" on public.affiliate_clawbacks
  for select using (creator_id = auth.uid() or brand_id = auth.uid());

-- Écriture réservée au serveur : c'est un mouvement d'argent.
grant select on public.affiliate_clawbacks to authenticated;
grant all    on public.affiliate_clawbacks to service_role;

comment on table public.affiliate_clawbacks is
  'Commissions versées puis annulées (vente remboursée). Déduites du prochain versement du créateur.';
comment on column public.affiliate_events.visitor_hash is
  'Empreinte HMAC non réversible du visiteur, propre au lien. Sert uniquement à ne pas compter deux fois le même clic.';
