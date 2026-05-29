-- 0015_grant_service_role.sql
-- Les tables créées en SQL brut n'avaient pas accordé de privilèges au rôle
-- service_role (utilisé par le client admin backend, ex. tracking d'affiliation).
-- On les accorde explicitement (RLS reste bypassée par service_role).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
