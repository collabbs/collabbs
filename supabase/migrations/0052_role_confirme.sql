-- ============================================================
-- Collabbs · 0052 — un rôle choisi, jamais un rôle deviné
-- ------------------------------------------------------------
-- `handle_new_user` lit le rôle dans les métadonnées d'inscription et retombe
-- sur « creator » quand il n'y en a pas :
--     coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'creator')
--
-- Avec l'inscription par email ce défaut ne sert jamais : le formulaire pose
-- toujours le rôle. Avec Google, il n'y a AUCUNE métadonnée — une marque qui
-- s'inscrirait avec Google deviendrait créatrice en silence, avec une ligne
-- `creators` à son nom, et aucun écran pour revenir en arrière.
--
-- On distingue donc les deux cas : un rôle CHOISI, et un rôle posé par défaut
-- faute de mieux. Le produit demande son rôle à qui ne l'a pas encore choisi.
-- ============================================================

alter table public.profiles
  add column if not exists role_confirmed boolean not null default false;

-- Tous les comptes existants viennent du formulaire d'inscription : ils ont
-- choisi leur rôle. Sans ce rattrapage, ils seraient tous renvoyés vers
-- l'écran de choix à leur prochaine visite.
update public.profiles set role_confirmed = true where role_confirmed = false;

-- ------------------------------------------------------------
-- Le déclencheur marque le rôle comme confirmé UNIQUEMENT quand il vient des
-- métadonnées, c'est-à-dire quand la personne l'a effectivement choisi.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_name text;
  v_choisi boolean;
begin
  v_choisi := (new.raw_user_meta_data ? 'role');
  v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'creator');
  v_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',   -- Google renvoie « full_name »
    new.raw_user_meta_data->>'name'
  );

  insert into public.profiles (id, role, display_name, role_confirmed)
  values (new.id, v_role, v_name, v_choisi);

  if v_role = 'creator' then
    insert into public.creators (id) values (new.id);
  elsif v_role = 'brand' then
    insert into public.brands (id, name) values (new.id, coalesce(v_name, 'Ma marque'));
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------------
-- Bascule du rôle, une seule fois, par la personne elle-même.
--
-- Volontairement verrouillée : elle ne fait rien si le rôle est déjà confirmé.
-- Ce n'est pas un « changer de rôle » — une marque avec des campagnes en cours
-- ne devient pas créatrice d'un clic. C'est la confirmation du tout premier
-- choix, pour les comptes arrivés sans rôle (Google).
-- ------------------------------------------------------------
create or replace function public.confirm_user_role(p_role public.user_role)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := auth.uid();
  v_actuel public.user_role;
  v_confirme boolean;
  v_nom text;
begin
  if v_id is null then
    return false;
  end if;

  select role, role_confirmed, display_name
    into v_actuel, v_confirme, v_nom
  from public.profiles
  where id = v_id
  for update;

  if not found or v_confirme then
    return false;
  end if;

  if p_role <> v_actuel then
    -- On crée la ligne du nouveau rôle AVANT de retirer l'ancienne : si la
    -- création échoue, la personne garde un compte cohérent.
    if p_role = 'brand' then
      insert into public.brands (id, name)
      values (v_id, coalesce(v_nom, 'Ma marque'))
      on conflict (id) do nothing;
      -- La ligne créateur posée par défaut n'est retirée que si elle est
      -- restée vierge : aucune trace d'activité ne doit disparaître.
      delete from public.creators c
      where c.id = v_id
        and not exists (select 1 from public.deals d where d.creator_id = v_id)
        and not exists (select 1 from public.applications a where a.creator_id = v_id)
        and not exists (select 1 from public.affiliate_links l where l.creator_id = v_id);
    else
      insert into public.creators (id) values (v_id) on conflict (id) do nothing;
      delete from public.brands b
      where b.id = v_id
        and not exists (select 1 from public.campaigns c where c.brand_id = v_id)
        and not exists (select 1 from public.deals d where d.brand_id = v_id);
    end if;
  end if;

  update public.profiles
     set role = p_role,
         role_confirmed = true
   where id = v_id;

  return true;
end;
$$;

revoke execute on function public.confirm_user_role(public.user_role) from public, anon;
grant execute on function public.confirm_user_role(public.user_role) to authenticated;
