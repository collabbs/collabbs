-- Ventes déclarées par le navigateur : confirmation obligatoire
--
-- FAILLE CORRIGÉE ICI.
--
-- `/api/track/sale-pixel` acceptait une vente sur la seule foi de l'en-tête
-- `Referer`, censé prouver que l'appel venait bien de la boutique de la marque.
-- Or `Referer` est envoyé par le navigateur : il se falsifie en une ligne de
-- commande. Tout le reste était public — l'UUID de la marque est écrit en clair
-- dans le `data-brand` du script installé sur la boutique, le site est public,
-- et le créateur connaît son propre code de lien.
--
-- Conséquence : n'importe quel créateur inscrit à une campagne pouvait se
-- créditer des commissions inventées, jusqu'à épuiser la provision de la
-- marque — de l'argent réellement réservé, puis versé après le délai de
-- validation.
--
-- Il n'existe aucun moyen d'authentifier un navigateur : un secret placé dans
-- une page est un secret public. On arrête donc de faire semblant. Une vente
-- déclarée côté navigateur est désormais une DÉCLARATION, pas un fait : elle
-- est enregistrée, visible des deux côtés, mais ne réserve aucun argent tant
-- que la marque ne l'a pas confirmée.
--
-- Le postback serveur (`/api/track/sale`), lui, s'authentifie avec un vrai
-- secret que seul le serveur de la marque détient. Il continue de régler
-- automatiquement — c'est le chemin à privilégier, et le seul digne de confiance.

-- `source` existe déjà (migration 0034) avec le vocabulaire
-- 'link' | 'promo_code' | 'cpa_action'. On l'ÉTEND plutôt que de le remplacer :
-- écraser la contrainte rejetterait les lignes existantes, et une insertion
-- refusée signifie une vente jamais enregistrée.
--
--   'postback' — déclarée par le serveur de la marque, authentifiée par secret.
--   'pixel'    — déclarée par un navigateur : non authentifiable, à confirmer.
--
-- 'link' reste accepté : c'est la valeur par défaut historique des lignes
-- déjà en base, qu'on ne réécrit pas.
alter table public.affiliate_events
  drop constraint if exists affiliate_events_source_check;
alter table public.affiliate_events
  add constraint affiliate_events_source_check
  check (source in ('link', 'promo_code', 'cpa_action', 'postback', 'pixel'));

alter table public.affiliate_events
  -- Vrai tant que la marque n'a pas tranché. Aucun argent ne bouge dans cet état.
  add column if not exists needs_review boolean not null default false,
  add column if not exists reviewed_at  timestamptz;

-- La liste « à confirmer » d'une marque doit rester instantanée.
create index if not exists idx_affiliate_events_needs_review
  on public.affiliate_events (needs_review) where needs_review = true;

comment on column public.affiliate_events.source is
  'Origine de la déclaration : postback (serveur, authentifié par secret), pixel (navigateur, non authentifiable), promo_code, cpa_action, link (historique).';
comment on column public.affiliate_events.needs_review is
  'Vrai tant que la marque n''a pas confirmé une vente déclarée par le navigateur. Aucune réservation ni versement tant que ce drapeau est levé.';
