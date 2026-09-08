-- 0065_favoris.sql
-- Les campagnes qu'un créateur a retenues pendant le défilé.
--
-- ─── Pourquoi cette table ───
-- Le défilé gardait les intérêts dans le navigateur, et personne d'autre ne
-- les lisait. Un créateur aimait huit campagnes, créait son compte, et ne
-- retrouvait rien : tout le tunnel menait à un geste dont le résultat était
-- jeté. Un like doit survivre à l'inscription, sinon il ne sert à rien.
--
-- ─── Pourquoi UNE seule table ───
-- Le symétrique existe déjà : `brand_creator_saves` porte les créateurs
-- qu'une marque a retenus. En créer un second ferait deux vérités pour la
-- même idée. On ne crée donc que le côté qui manque.

create table if not exists campagnes_favorites (
  creator_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_id, campaign_id)
);

-- Cette liste dit ce qui intéresse quelqu'un : c'est une information
-- personnelle, elle ne se lit que par son propriétaire.
alter table campagnes_favorites enable row level security;

drop policy if exists "favoris_les_siens" on campagnes_favorites;
create policy "favoris_les_siens"
  on campagnes_favorites for all
  to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

-- On liste toujours du plus récent au plus ancien : l'index suit l'usage.
create index if not exists favoris_par_createur
  on campagnes_favorites (creator_id, created_at desc);
