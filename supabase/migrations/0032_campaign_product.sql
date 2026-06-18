-- Sprint A — Produit ciblé sur campagne
-- Permet à la marque de dire "je veux promouvoir CE produit précis"
-- (vs target_url qui sert au tracking d'affiliation et peut être différent).
-- Appliqué via MCP Supabase (apply_migration).

-- Enum pour distinguer produit livrable (physique), digital (lien), service.
-- Utile pour Sprint C (logistique livraison) qui ne s'applique qu'au physique.
do $$ begin
  create type product_kind as enum ('physical', 'digital', 'service');
exception when duplicate_object then null;
end $$;

alter table campaigns
  add column if not exists product_name text,
  add column if not exists product_url text,
  add column if not exists product_image_url text,
  add column if not exists product_kind product_kind;
