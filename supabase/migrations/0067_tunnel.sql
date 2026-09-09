-- 0067_tunnel.sql
-- Les passages dans le tunnel d'entrée.
--
-- ─── Pourquoi une table maison ───
-- Aucun outil de mesure n'est branché, et en ajouter un pour six étapes
-- apporterait un tiers dans le parcours, une bannière de consentement et une
-- dépendance de plus. On veut savoir OÙ les gens s'arrêtent, pas les suivre.
--
-- ─── Ce qu'on n'enregistre pas ───
-- Ni adresse IP, ni identifiant de compte, ni page visitée. Seulement : un
-- jeton de session tiré au hasard dans le navigateur, l'étape atteinte, et le
-- côté. De quoi compter des passages, pas de quoi reconnaître quelqu'un.

create table if not exists tunnel_evenements (
  id bigserial primary key,
  session text not null,
  etape text not null,
  cote text,
  created_at timestamptz not null default now()
);

-- Aucune politique : l'écriture passe par le serveur, la lecture par l'admin.
-- Sans politique et avec RLS actif, personne n'y accède depuis le navigateur.
alter table tunnel_evenements enable row level security;

create index if not exists tunnel_par_etape on tunnel_evenements (etape, created_at desc);
create index if not exists tunnel_par_session on tunnel_evenements (session);
