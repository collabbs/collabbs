-- ============================================================
-- Collabbs · Schéma DB — Brique 1bis : GRANTs de base
-- ------------------------------------------------------------
-- Migration 0002
-- Supabase (versions récentes) n'accorde plus automatiquement l'accès
-- aux rôles anon/authenticated sur les tables créées en SQL brut.
-- On accorde donc des privilèges larges : la RLS (déjà activée) fait
-- le filtrage fin par-dessus — un GRANT sans policy n'expose rien.
-- Inclut les DEFAULT PRIVILEGES pour que les FUTURES tables (briques
-- suivantes) soient couvertes automatiquement.
-- À appliquer via : Supabase Dashboard → SQL Editor → coller → Run
-- ============================================================

grant usage on schema public to anon, authenticated;

-- Tables existantes
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Futures tables / séquences (appliqué automatiquement aux objets créés ensuite)
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
