-- ============================================================
-- 0071 — Le navigateur n'écrit plus ses liens d'affiliation
-- ============================================================
--
-- ─── Le trou ───
-- La policy d'insertion sur `affiliate_links` ne vérifiait qu'une chose :
-- `creator_id = auth.uid()`. « C'est bien ma ligne » — mais le reste de la
-- ligne, personne ne le regardait. C'est exactement le défaut fermé par la
-- 0068 sur `profiles`, `brands` et `creators`, resté ouvert ici.
--
-- Depuis la console de son navigateur, un créateur pouvait s'insérer un lien
-- portant :
--
--   • le CODE PROMO GÉNÉRIQUE de la marque — « SOLDES10 ». Comme
--     `/api/track/promo` résout la vente par ce code, TOUTES les ventes faites
--     avec le code public de la marque lui étaient attribuées, y compris celles
--     qu'il n'avait jamais amenées, y compris celles d'autres créateurs ;
--   • n'importe quel `campaign_id`, dont des campagnes auxquelles il n'avait
--     pas été accepté ;
--   • son propre code de suivi, choisi plutôt que tiré au sort.
--
-- ─── Ce qui change ───
-- La création passe désormais par `lib/lien-affilie`, côté serveur, qui
-- fabrique le code promo à partir du préfixe de la marque et du pseudo du
-- créateur, et vérifie son unicité. Le code promo n'est plus jamais fourni de
-- l'extérieur.
--
-- La lecture et la suppression restent ouvertes : voir ses liens, et renoncer
-- à une campagne, sont des gestes légitimes qui ne portent aucune décision
-- d'argent.
revoke insert on public.affiliate_links from authenticated;
drop policy if exists "affiliate_links_insert_own" on public.affiliate_links;


-- ─── Le même réflexe, sur les évènements ───
-- `affiliate_events` porte les montants et les commissions. Rien dans le
-- produit ne les écrit depuis le navigateur — les trois postbacks et le pixel
-- passent tous par le client de service. Le privilège, lui, était accordé.
revoke insert, update, delete on public.affiliate_events from authenticated;
revoke insert, update, delete on public.affiliate_clawbacks from authenticated;
revoke insert, update, delete on public.brand_ledger from authenticated;
revoke insert, update, delete on public.transactions from authenticated;
