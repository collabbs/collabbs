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

-- Le plafond de taille et la liste de types sont posés SUR LE SEAU, pas
-- seulement dans le code : le dépôt depuis le questionnaire se fait avant
-- toute inscription, donc sans utilisateur à qui demander des comptes. Une
-- vérification côté serveur peut être contournée si une autre voie d'écriture
-- apparaît un jour ; celle-ci tient au niveau du stockage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'visuels-campagne',
  'visuels-campagne',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ⚠️ Le seau a été créé directement en production le 08/09/2026, pour
-- débloquer un test en cours : sans lui, le téléversement échouait. Cette
-- migration reste la source de vérité et rattrape tout environnement neuf.

drop policy if exists "visuels_campagne_public_read" on storage.objects;
create policy "visuels_campagne_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'visuels-campagne');

drop policy if exists "visuels_campagne_insert_own" on storage.objects;
create policy "visuels_campagne_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'visuels-campagne'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "visuels_campagne_update_own" on storage.objects;
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

drop policy if exists "visuels_campagne_delete_own" on storage.objects;
create policy "visuels_campagne_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'visuels-campagne'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
