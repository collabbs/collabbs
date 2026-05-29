-- 0017 — Durcissement sécurité (suite à l'audit Supabase advisors)
--
-- 1) rls_auto_enable() est une fonction d'event trigger (SECURITY DEFINER).
--    Elle n'a aucune raison d'être appelable via l'API REST (/rpc).
--    On révoque EXECUTE pour anon / authenticated / public.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- 2) Le bucket `avatars` est public : les objets sont servis via l'URL publique
--    (/storage/v1/object/public/avatars/...), ce qui NE dépend PAS de RLS.
--    La policy SELECT large permettait en plus de LISTER tous les fichiers.
--    On la supprime : l'affichage des avatars continue de fonctionner,
--    mais le listing du bucket n'est plus possible.
drop policy if exists "avatars_public_read" on storage.objects;
