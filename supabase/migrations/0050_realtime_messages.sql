-- Messagerie en temps réel
--
-- Jusqu'ici, un message reçu n'apparaissait qu'après un rechargement de la
-- page : les deux interlocuteurs se parlaient sans le savoir. Le navigateur
-- s'abonne désormais aux insertions dans `messages` via Supabase Realtime.
--
-- Postgres ne diffuse que les tables inscrites dans la publication
-- `supabase_realtime`. Sans cette ligne, l'abonnement du navigateur se
-- connecte SANS ERREUR et ne reçoit jamais rien : la panne est silencieuse,
-- impossible à diagnostiquer depuis le code applicatif. C'est tout l'objet de
-- cette migration.
--
-- La RLS reste en vigueur : Realtime rejoue la policy SELECT de `messages`
-- (« messages_select », migration 0006) pour chaque abonné avant de lui
-- transmettre une ligne. Un utilisateur ne reçoit donc que les messages des
-- conversations dont il est partie. Rien à assouplir ici.
--
-- On ne touche pas au REPLICA IDENTITY : l'application n'écoute que les
-- INSERT, dont la charge utile contient déjà la ligne complète. Passer la
-- table en REPLICA IDENTITY FULL gonflerait le WAL pour des UPDATE/DELETE
-- que personne n'écoute.

do $$
begin
  -- La publication n'existe pas sur une base vierge hors Supabase : on ne
  -- fait alors rien plutôt que d'échouer, le reste du schéma est valide.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publication supabase_realtime absente : temps réel non activé.';
    return;
  end if;

  -- Rejouable sans dommage : ajouter deux fois la même table est une erreur.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
