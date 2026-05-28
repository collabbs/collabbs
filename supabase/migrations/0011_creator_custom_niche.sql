-- 0011_creator_custom_niche.sql
-- Niche libre ("Autre") saisie par le créateur à l'onboarding,
-- en complément des niches de référence.
alter table creators add column custom_niche text;
