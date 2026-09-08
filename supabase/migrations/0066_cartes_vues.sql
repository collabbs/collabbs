-- 0066_cartes_vues.sql
-- Ce qui a déjà défilé sous les yeux de quelqu'un.
--
-- ─── Pourquoi ───
-- Le paquet repartait de zéro à chaque visite. Un « paquet du jour » qui
-- remontre les mêmes cartes se dément au deuxième jour, et la promesse
-- — « 12 nouvelles demain » — devient un mensonge mesurable par l'utilisateur
-- lui-même.
--
-- Une seule table pour les deux côtés : la cible est une campagne quand c'est
-- un créateur qui regarde, un créateur quand c'est une marque. Le rôle de
-- celui qui regarde suffit à lever l'ambiguïté, et deux tables jumelles
-- finiraient par diverger.

create table if not exists cartes_vues (
  viewer_id uuid not null references profiles(id) on delete cascade,
  cible_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (viewer_id, cible_id)
);

-- Ce que quelqu'un a vu ne regarde que lui.
alter table cartes_vues enable row level security;

drop policy if exists "vues_les_siennes" on cartes_vues;
create policy "vues_les_siennes"
  on cartes_vues for all
  to authenticated
  using (viewer_id = auth.uid())
  with check (viewer_id = auth.uid());

create index if not exists vues_par_viewer on cartes_vues (viewer_id);
