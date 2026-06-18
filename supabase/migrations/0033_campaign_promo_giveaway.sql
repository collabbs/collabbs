-- Sprint B — Code promo + Concours
-- Étend les types de campagne pour matcher ce que font vraiment les marques :
-- pas que de l'affiliation/vidéo, aussi du code promo et des concours.
-- Appliqué via MCP Supabase (apply_migration).

-- Étendre l'enum campaign_type
alter type campaign_type add value if not exists 'promo_code';
alter type campaign_type add value if not exists 'giveaway';

-- Colonnes pour les campagnes type promo_code
-- promo_code : code générique (ex "ETE20") partagé par tous les créateurs.
-- promo_auto_generate : si true, Collabbs génère un code unique par
--   créateur à l'acceptation du deal (ex "JULIEN20-7K"). Pour V1, c'est
--   juste un flag — la génération vient avec le sprint deals.
alter table campaigns
  add column if not exists promo_code text,
  add column if not exists promo_auto_generate boolean not null default false,
  add column if not exists promo_discount_pct smallint,
  add column if not exists promo_min_purchase integer,
  add column if not exists promo_expires_at timestamptz;

-- Colonnes pour les campagnes type giveaway (concours)
-- Tout est géré par la marque côté logistique (sélection gagnant, envoi
-- du lot). Collabbs n'est qu'un argument marketing affiché au créateur
-- pour qu'il puisse en parler dans ses contenus.
alter table campaigns
  add column if not exists giveaway_prize_label text,
  add column if not exists giveaway_prize_value integer,
  add column if not exists giveaway_winners_count smallint,
  add column if not exists giveaway_rules_url text;
