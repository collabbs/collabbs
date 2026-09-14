-- ============================================================
-- 0074 — La photo que Google nous donne, et qu'on jetait
-- ============================================================
--
-- ─── Le constat ───
-- Une inscription par Google fournit le nom ET la photo du compte. Le
-- déclencheur reprenait le nom (`full_name`) et laissait la photo de côté.
--
-- Le produit, lui, la réclame ensuite : la carte d'un créateur sans photo
-- affiche « 📷 Ta photo manque — c'est elle qui fait s'arrêter une marque », et
-- un profil incomplet n'apparaît pas au catalogue. On demandait donc à
-- quelqu'un de téléverser une image qu'on venait de refuser de recevoir.
--
-- ─── Ce que ça change ───
-- Une inscription Google arrive avec un profil déjà présentable. C'est le
-- premier écran après l'inscription qui en profite, et c'est celui où l'on
-- perd le plus de monde.
--
-- Google place l'adresse de l'image sous `avatar_url` ou `picture` selon le
-- flux ; on regarde les deux. Pour une inscription par email, les deux sont
-- absentes et la colonne reste nulle — comportement inchangé.
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
  v_photo text;
  v_choisi boolean;
begin
  v_choisi := (new.raw_user_meta_data ? 'role');
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'creator');
  v_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',   -- Google renvoie « full_name »
    new.raw_user_meta_data->>'name'
  );
  -- Google renvoie « avatar_url » ou « picture » selon le flux d'autorisation.
  v_photo := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture'
  );

  insert into public.profiles (id, role, display_name, avatar_url, role_confirmed)
  values (new.id, v_role, v_name, v_photo, v_choisi);

  if v_role = 'creator' then
    insert into public.creators (id) values (new.id);
  elsif v_role = 'brand' then
    insert into public.brands (id, name) values (new.id, coalesce(v_name, 'Ma marque'));
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Le compte Google créé pendant les tests du 14 septembre est arrivé avant ce
-- correctif : on lui pose sa photo, comme il l'aurait eue.
update public.profiles p
   set avatar_url = coalesce(
         u.raw_user_meta_data->>'avatar_url',
         u.raw_user_meta_data->>'picture'
       )
  from auth.users u
 where u.id = p.id
   and p.avatar_url is null
   and coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') is not null;
