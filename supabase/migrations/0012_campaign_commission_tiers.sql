-- 0012_campaign_commission_tiers.sql
-- Grille de commission d'affiliation par palier d'abonnés, définie par campagne
-- (et non plus au niveau global de la marque).
alter table campaigns
  add column commission_nano smallint,
  add column commission_micro smallint,
  add column commission_mid smallint,
  add column commission_macro smallint;
