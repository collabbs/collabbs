-- ============================================================
-- Collabbs · Schéma DB — 0008 : handle_new_user crée la ligne métier
-- ------------------------------------------------------------
-- Au signup, en plus de profiles, crée la ligne creators OU brands
-- selon le rôle (lu depuis raw_user_meta_data).
-- Appliqué via MCP Supabase (apply_migration).
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_name text;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'creator');
  v_name := new.raw_user_meta_data->>'display_name';

  insert into public.profiles (id, role, display_name)
  values (new.id, v_role, v_name);

  if v_role = 'creator' then
    insert into public.creators (id) values (new.id);
  elsif v_role = 'brand' then
    insert into public.brands (id, name) values (new.id, coalesce(v_name, 'Ma marque'));
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
