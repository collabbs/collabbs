-- ============================================================
-- 0073 — Le journal des tâches planifiées
-- ============================================================
--
-- ─── La question à laquelle personne ne savait répondre ───
-- « Est-ce que la libération automatique du séquestre tourne vraiment ? »
-- C'est un engagement écrit dans le contrat que signent les créateurs : passé
-- le délai de validation, le silence de la marque vaut acceptation et les
-- fonds partent. Encore faut-il que l'automate qui l'applique s'exécute.
--
-- On n'avait que deux moyens de le savoir, tous deux mauvais :
--   • les journaux Vercel — conservés peu de temps sur un plan Hobby, et
--     interrogeables seulement à la main, écran par écran ;
--   • l'absence de conséquences — sauf qu'un automate qui tourne sans rien
--     avoir à faire ne laisse AUCUNE trace, exactement comme un automate qui
--     ne tourne pas. Le silence a deux causes possibles et on ne peut pas les
--     distinguer. C'est précisément ce qui a permis au rappel du défilé de
--     n'envoyer aucun email en se déclarant en bonne santé.
--
-- Une tâche note donc désormais son passage, qu'elle ait eu du travail ou non.
-- « Rien à faire » devient une information, au lieu d'un trou.
--
-- La table est petite et bornée : huit tâches, la plupart quotidiennes.
-- ============================================================

create table if not exists public.journal_taches (
  id         bigserial primary key,
  tache      text not null,
  ok         boolean not null default true,
  resultat   jsonb,
  duree_ms   integer,
  created_at timestamptz not null default now()
);

create index if not exists journal_taches_par_tache
  on public.journal_taches (tache, created_at desc);

comment on table public.journal_taches is
  'Une ligne par execution de tache planifiee, meme sans travail a faire. Ecrit par le serveur uniquement.';

-- Personne n'y touche depuis le navigateur : ni lecture ni écriture. Le seul
-- lecteur est l'écran d'administration, qui passe par le client de service.
alter table public.journal_taches enable row level security;
revoke select, insert, update, delete on public.journal_taches from anon, authenticated;
