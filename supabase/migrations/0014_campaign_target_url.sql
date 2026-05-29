-- 0014_campaign_target_url.sql
-- URL de destination d'une campagne : là où le lien d'affiliation du créateur
-- (/r/{code}) redirige le visiteur. Fallback possible sur brands.website.
alter table campaigns add column target_url text;
