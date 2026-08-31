-- 0062_rattrapage_colonnes_hors_migration.sql
--
-- ─── Pourquoi cette migration existe ───
-- Trois colonnes sont présentes en production mais dans AUCUN fichier de
-- migration : elles ont été ajoutées directement dans le tableau de bord
-- Supabase. Le dossier `supabase/migrations` ne pouvait donc plus reconstruire
-- la base.
--
-- Ce n'est pas un problème tant que rien ne change. Ça en devient un le jour
-- où l'on veut un environnement de test, où l'on restaure après un incident,
-- ou simplement où quelqu'un relit le schéma en le croyant complet. Le défaut
-- ne se voit alors qu'au moment où quelque chose échoue — et ce jour-là, on
-- cherche ailleurs.
--
--   · campaigns.ships_product_to_creator
--   · campaigns.product_retail_value
--   · deals.delivered_at
--
-- ─── Cette migration ne change RIEN en production ───
-- Les trois instructions sont en `add column if not exists`. Sur la base
-- actuelle, où les colonnes existent déjà, elles ne font rien du tout : ni
-- réécriture de table, ni verrou long, ni perte de données. Leur seul effet
-- est sur une base reconstruite depuis zéro, où elles créeront les colonnes
-- manquantes.
--
-- ─── Une précision d'honnêteté sur les types ───
-- Les définitions ci-dessous sont déduites des types TypeScript générés depuis
-- la base réelle (booléen non nul, numérique nullable, horodatage nullable) et
-- alignées sur les conventions du reste du schéma : `numeric(12,2)` pour toute
-- valeur monétaire, `boolean not null default false` pour tout drapeau.
--
-- Si la production diffère sur un détail — une précision numérique, une valeur
-- par défaut — cette migration ne le corrigera PAS (le `if not exists` la rend
-- inerte), et l'écart se rejouerait sur une base reconstruite. Pour lever le
-- doute, exécuter :
--
--   select table_name, column_name, data_type, numeric_precision,
--          numeric_scale, is_nullable, column_default
--   from information_schema.columns
--   where (table_name = 'campaigns'
--          and column_name in ('ships_product_to_creator','product_retail_value'))
--      or (table_name = 'deals' and column_name = 'delivered_at');

-- La marque envoie-t-elle le produit au créateur ? Complète `product_kind`,
-- qui dit la NATURE du produit sans dire s'il change de mains.
alter table public.campaigns
  add column if not exists ships_product_to_creator boolean not null default false;

-- Valeur commerciale du produit envoyé. Elle compte : un produit offert est un
-- avantage en nature, et il entre dans le cumul du seuil légal de 1 000 € au
-- même titre que de l'argent versé.
alter table public.campaigns
  add column if not exists product_retail_value numeric(12,2);

-- Date de livraison du contenu. Les livrables portent déjà leurs propres
-- horodatages ; cette colonne reste inutilisée par le produit.
alter table public.deals
  add column if not exists delivered_at timestamptz;
