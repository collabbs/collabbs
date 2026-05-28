-- 0013_campaign_type_performance.sql
-- Type de campagne "performance" : le créateur est payé selon les vues générées
-- (rémunération stockée via commission_type='fixed_per_action', commission_value=€,
-- commission_unit='1000 vues').
alter type campaign_type add value if not exists 'performance';
