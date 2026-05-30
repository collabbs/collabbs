-- 0024 — Upload de fichiers sur les livrables
--
-- Bucket Storage privé `deliverables` (vidéos UGC, PDF, etc.) accessible
-- uniquement aux 2 parties du deal correspondant. Métadonnées des fichiers
-- déposés stockées dans `deliverables.submission_files` (jsonb array de
-- { path, name, size, mime }).

-- 1) Bucket
insert into storage.buckets (id, name, public)
  values ('deliverables', 'deliverables', false)
  on conflict (id) do nothing;

-- 2) Colonne métadonnées des fichiers
alter table public.deliverables
  add column if not exists submission_files jsonb not null default '[]'::jsonb;

-- 3) RLS storage.objects — convention de chemin :
--    "<deal_id>/<deliverable_id>/<filename>"
--    → storage.foldername(name)[1] = deal_id

-- SELECT : les 2 parties du deal peuvent lire les fichiers.
drop policy if exists "deliverables_storage_select" on storage.objects;
create policy "deliverables_storage_select" on storage.objects
  for select
  using (
    bucket_id = 'deliverables'
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[1]
        and (d.brand_id = auth.uid() or d.creator_id = auth.uid())
    )
  );

-- INSERT : seul le créateur du deal peut déposer, et uniquement quand le deal
-- est en cours (status = active).
drop policy if exists "deliverables_storage_insert" on storage.objects;
create policy "deliverables_storage_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'deliverables'
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[1]
        and d.creator_id = auth.uid()
        and d.status = 'active'
    )
  );

-- DELETE : seul le créateur peut retirer un fichier (avant validation marque,
-- contrôle en + côté action serveur).
drop policy if exists "deliverables_storage_delete" on storage.objects;
create policy "deliverables_storage_delete" on storage.objects
  for delete
  using (
    bucket_id = 'deliverables'
    and exists (
      select 1 from public.deals d
      where d.id::text = (storage.foldername(name))[1]
        and d.creator_id = auth.uid()
    )
  );
