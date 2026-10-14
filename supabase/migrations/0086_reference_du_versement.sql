-- ═══════════════════════════════════════════════════════════════════════════
-- Garder la trace du virement SORTANT, pas seulement du paiement entrant
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `transactions.reference` contient l'identifiant du paiement de la marque
-- (`pi_…`). Il est porteur : c'est lui qu'on passe à Stripe en
-- `source_transaction` pour verser avant consolidation du solde, et c'est lui
-- qui relie un remboursement à sa vente. On ne peut donc pas l'écraser.
--
-- Résultat : quand le créateur était payé, `stripe.transfers.create()` était
-- appelé et **son résultat jeté**. Aucune trace du virement en base. Constaté
-- le 14/10/2026 sur le premier versement réel : la collaboration affichait
-- « libérée », le créateur avait reçu ses 25 €, et rien dans nos écritures ne
-- permettait de le prouver.
--
-- Ce n'est pas théorique : le jour où un créateur affirme ne pas avoir été
-- payé, il faut pouvoir produire l'identifiant du virement. Et l'écran
-- d'arbitrage, lui, écrasait `reference` avec celui-ci — deux chemins, deux
-- comportements, sur la même colonne.
--
-- Une colonne distincte règle les deux : l'entrant reste l'entrant, le sortant
-- a sa place.

alter table public.transactions
  add column if not exists payout_reference text;

comment on column public.transactions.payout_reference is
  'Identifiant du virement Stripe vers le créateur (tr_…). Distinct de `reference`, qui garde le paiement entrant de la marque et sert de source_transaction.';
