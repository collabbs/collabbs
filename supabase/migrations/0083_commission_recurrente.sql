-- ═══════════════════════════════════════════════════════════════════════════
-- La commission récurrente — l'affiliation des SaaS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Julien, fondateur d'un SaaS : « je serai sûrement pas le seul SaaS à faire
-- ça ». Non. Et le produit n'avait aucune réponse pour eux.
--
-- ─── La question qu'aucun écran ne posait ───
-- Un abonnement à 29 €/mois avec 20 % sur le PREMIER paiement rapporte 5,80 €
-- au créateur. Aucun créateur ne se déplace pour ça. Les mêmes 20 % sur douze
-- mois rapportent 70 €, et là c'est un programme qui se vend. Les deux se
-- présentent, se négocient et se refusent différemment — et Collabbs ne savait
-- dire ni l'un ni l'autre.
--
-- Le comble : `commission_type` porte la valeur 'recurring' dans son
-- énumération depuis l'origine. Aucun écran ne l'écrit, aucun code ne la lit.
-- Troisième colonne de ce produit qui vit dans le schéma et nulle part
-- ailleurs. On ne l'utilise pas ici : elle décrit la FORME du taux, pas sa
-- répétition, et détourner un champ existant pour dire autre chose est
-- exactement ce qui rend une base illisible.
--
-- ─── Combien de paiements ───
-- `1` (défaut) = le premier paiement seulement, le comportement actuel.
-- `N` = les N premiers paiements de chaque abonnement.
-- `0` = tous, sans limite — « à vie ».
--
-- Zéro pour « sans limite » se lit mal seul ; c'est pour ça que le code ne
-- teste jamais la valeur à la main et passe par `commissionDueSurCePaiement`.

alter table public.campaigns
  add column if not exists commission_paiements integer not null default 1;

comment on column public.campaigns.commission_paiements is
  'Nombre de paiements successifs commissionnés par abonnement. 1 = premier paiement seul, N = les N premiers, 0 = tous (à vie).';

-- ─── De quel abonnement parle-t-on ───
-- Sans cette colonne, impossible de savoir si une vente est un premier
-- paiement ou le sixième renouvellement : on ne saurait donc jamais quand
-- s'arrêter de commissionner. La marque l'envoie dans le postback ; les
-- ventes e-commerce, qui n'ont pas d'abonnement, la laissent nulle.

alter table public.affiliate_events
  add column if not exists abonnement text;

comment on column public.affiliate_events.abonnement is
  'Identifiant de l''abonnement chez la marque (ex. sub_... chez Stripe). Null sur une vente unique.';

-- Compter les paiements déjà commissionnés d'un abonnement est fait à CHAQUE
-- vente : sans index, chaque renouvellement parcourrait toute la table.
create index if not exists affiliate_events_abonnement_idx
  on public.affiliate_events (link_id, abonnement)
  where abonnement is not null;
