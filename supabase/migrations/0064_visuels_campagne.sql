-- 0064_visuels_campagne.sql
-- Seau public pour les visuels de campagne (chemin : visuels-campagne/{user_id}/fichier).
--
-- Pourquoi un seau à part plutôt que « avatars » : un avatar est unique et
-- s'écrase à chaque changement (`upsert`), un visuel de campagne ne l'est pas
-- — une marque en a un par campagne, et ils doivent coexister. Mélanger les
-- deux obligerait à des noms de fichiers acrobatiques dans un seau dont ce
-- n'est pas l'objet.
--
-- Même forme de règles que 0010 : lecture publique (les cartes s'affichent
-- pour tout le monde, y compris hors connexion), écriture limitée au dossier
-- de son propre identifiant.

insert into storage.buckets (id, name, public)
values ('visuels-campagne', 'visuels-campagne', true)
on conflict (id) do nothing;

create policy "visuels_campagne_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'visuels-campagne');

create policy "visuels_campagne_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'visuels-campagne'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "visuels_campagne_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'visuels-campagne'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'visuels-campagne'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "visuels_campagne_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'visuels-campagne'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
