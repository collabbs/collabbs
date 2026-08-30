-- ============================================================
-- Collabbs · 0054 — un code promo appartient à UN créateur
-- ------------------------------------------------------------
-- L'asset « code promo » ne pouvait fonctionner pour personne :
--
--  1. `activateAffiliateLink` ne posait jamais `affiliate_links.promo_code`.
--     Aucun code n'était donc jamais attribué, et `/api/track/promo`, qui
--     résout la vente par ce code, répondait « code promo introuvable » à
--     chaque appel. La fiche de campagne affichait un faux code d'exemple,
--     « TON@HANDLE-XX », qui ne devenait jamais réel.
--
--  2. Le code « partagé » (le même pour tous les créateurs) est de toute
--     façon inattribuable : une vente arrive avec un code, et rien ne dit
--     quel créateur l'a diffusé. Le code de la campagne devient donc un
--     PRÉFIXE — « MAISON » donne « MAISON-JULIEN » — ce qui garde le code
--     reconnaissable pour la marque tout en restant attribuable.
--
-- L'index existant n'était pas unique : deux créateurs pouvaient porter le
-- même code, et la résolution d'une vente (`maybeSingle`) aurait échoué en
-- silence sur le doublon. On le remplace par une contrainte d'unicité.
-- ============================================================

drop index if exists idx_affiliate_links_promo_code;

create unique index if not exists affiliate_links_promo_code_unique
  on public.affiliate_links (promo_code)
  where promo_code is not null;
