-- ═══════════════════════════════════════════════════════════════════════════
-- Une même référence Stripe ne crédite une marque qu'une seule fois
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `creditTopup` se dit « idempotent via stripe_ref » : il cherche la référence
-- dans brand_ledger avant de créditer. Mais c'est un « je lis, puis j'écris »,
-- et rien en base ne l'arbitre. Deux livraisons simultanées du même événement
-- Stripe peuvent franchir le contrôle toutes les deux et créditer deux fois.
--
-- Ce n'est pas théorique : découvert le 07/10/2026 avec DEUX destinations
-- webhook actives pointant sur la même URL. Stripe livrait chaque paiement aux
-- deux, en parallèle. Et les tentatives de renvoi de Stripe produisent le même
-- cas, même avec une seule destination.
--
-- ─── Pourquoi (brand_id, stripe_ref) et pas stripe_ref seul ───
-- Une restitution de remboursement (`reserve_release`) regroupe une dette qui
-- peut couvrir PLUSIEURS marques : le même identifiant de transaction est
-- alors écrit une fois par marque, légitimement. Une contrainte sur
-- `stripe_ref` seul casserait ce remboursement — et le casserait au pire
-- moment, en rendant de l'argent.
--
-- Partiel sur `stripe_ref is not null` : les écritures qui ne viennent pas de
-- Stripe (ajustements, réservations) laissent la colonne vide, et plusieurs
-- valeurs nulles ne s'excluent pas.
--
-- ⚠️ Si cette migration échoue, c'est qu'un doublon existe DÉJÀ : de l'argent
-- a été crédité deux fois. Ne pas forcer. Lire d'abord ce qu'elle refuse :
--
--   select brand_id, stripe_ref, count(*), sum(amount)
--     from public.brand_ledger
--    where stripe_ref is not null
--    group by brand_id, stripe_ref
--   having count(*) > 1;

create unique index if not exists brand_ledger_stripe_ref_unique
  on public.brand_ledger (brand_id, stripe_ref)
  where stripe_ref is not null;

comment on index public.brand_ledger_stripe_ref_unique is
  'Un paiement Stripe ne crédite une marque qu''une fois, même si le webhook est livré plusieurs fois en parallèle.';
