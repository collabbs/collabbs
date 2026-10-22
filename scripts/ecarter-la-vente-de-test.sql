-- ═══════════════════════════════════════════════════════════════════════════
-- Écarter la commission fictive de 60 € avant qu'elle ne se verse
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi maintenant ───
-- La vente Shopify de test du 12/10 (749,95 €) a produit une commission de
-- 60 € restée `pending`, avec `validate_at = 2026-11-11 15:32`. Le 11/11 à
-- 04:00 le cron `affiliate-settlement` la passe à `validated` ; à 05:00
-- `affiliate-payouts` déclenche un VRAI virement Stripe vers le compte
-- connecté du créateur @juliendrn. Et le code le dit : une fois validée, elle
-- ne peut plus être rendue à la marque automatiquement.
--
-- Le bouton « écarter » de /billing ne peut pas l'atteindre : il exige
-- `needs_review = true`, et celle-ci est arrivée par postback, déjà attribuée.
--
-- ─── Pourquoi on ne recrédite PAS la provision ───
-- `releaseReservation()` ferait deux choses : marquer la vente, PUIS rendre
-- 72 € (60 de commission + 12 de frais) à la provision de la marque.
--
-- Ici, le second geste serait une erreur. Le registre montre la réservation
-- de −72 € le 12/10 à 15:32:06, solde après : 105,89 €. Mais
-- `provision-adossee-au-reel.sql` a remis ce solde à ZÉRO le même jour, plus
-- tard — précisément parce que ces 105,89 € n'étaient adossés à aucun argent
-- réellement encaissé (20 € seulement, le 07/10).
--
-- Rendre les 72 € aujourd'hui recréerait donc exactement le défaut que ce
-- script-là a supprimé : une provision qui promet à des créateurs un argent
-- que Collabbs n'a jamais reçu. La réservation a déjà été annulée en bloc.
--
-- On écrit donc le statut, et RIEN d'autre.
--
-- ─── Le verrou ───
-- `and status = 'pending'` n'est pas décoratif : si le cron du 11/11 est passé
-- avant ce script, la ligne ne doit pas être touchée — l'argent serait déjà
-- parti et l'écarter laisserait la compta incohérente. Dans ce cas la requête
-- ne renvoie aucune ligne, et c'est le signal qu'il faut me le dire.
-- ═══════════════════════════════════════════════════════════════════════════

update public.affiliate_events
   set status        = 'rejected',
       reviewed_at   = now(),
       reject_reason = 'Vente de test (webhook Shopify du 12/10) — écartée avant ouverture. '
                       'Provision NON recréditée : la réservation de 72 € a déjà été annulée '
                       'par la remise à zéro des provisions du 12/10.'
 where id     = '0a3076e8-1e25-45c1-a5e6-8d228ab16b65'
   and status = 'pending'
returning id,
          status,
          commission_amount,
          validate_at,
          reject_reason;

-- Attendu : 1 ligne, status = 'rejected', commission_amount = 60.00
-- 0 ligne  → la vente n'est plus `pending`. NE PAS réessayer : me prévenir.
