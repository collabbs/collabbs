-- ============================================================
-- Collabbs · Schéma DB — 0007 : Durcissement sécurité
-- ------------------------------------------------------------
-- Corrige les avertissements remontés par get_advisors (security) :
--   - function_search_path_mutable sur set_updated_at
--   - security definer function exécutable par anon/authenticated (handle_new_user)
-- Appliqué via MCP Supabase (apply_migration).
-- ============================================================

-- 1. Fixe le search_path de set_updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Empêche l'appel direct de handle_new_user via l'API REST.
-- EXECUTE est accordé à PUBLIC par défaut (dont anon/authenticated héritent),
-- donc on révoque depuis PUBLIC. Le trigger on_auth_user_created continue de
-- fonctionner (le déclenchement d'un trigger ne dépend pas du droit EXECUTE direct).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Note : la fonction Supabase interne rls_auto_enable() est laissée telle quelle
-- (gérée par Supabase, liée à l'option "auto-enable RLS" du projet).
