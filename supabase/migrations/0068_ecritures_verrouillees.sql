-- ============================================================
-- 0068 — Ce que le navigateur a le droit d'écrire
-- ============================================================
--
-- ─── Le problème ───
-- Le navigateur d'un utilisateur connecté parle DIRECTEMENT à la base : la clé
-- « anon » est publique par construction, elle est dans le code de la page. La
-- seule chose qui le tienne, ce sont les policies RLS et les privilèges.
--
-- Or `0002_grants.sql` accorde `update` sur TOUTES les colonnes de TOUTES les
-- tables à `authenticated`, et les policies de `0001` autorisent chacun à
-- modifier SA propre ligne. « Sa propre ligne » et « ses propres champs » ne
-- sont pas la même chose. Ligne à soi + toutes les colonnes, cela voulait dire :
--
--   • un compte pouvait se poser `profiles.is_admin = true` et ouvrir l'écran
--     d'arbitrage — libération de séquestre, remboursement au nom de Collabbs ;
--   • une marque pouvait s'écrire `brands.balance = 999999` (sa provision
--     d'affiliation, celle qui paye les créateurs), se passer `plan` en
--     illimité, ou baisser ses propres taux de commission ;
--   • un créateur pouvait se poser `verified = true` et s'inventer un `rating`,
--     un nombre de collaborations et un total de gains ;
--   • une partie pouvait réécrire le contrat SIGNÉ de l'autre — montant, durée
--     des droits, exclusivité — ou l'effacer. Le PDF « figé » que l'autre
--     télécharge afficherait les nouveaux termes, sans aucune trace ;
--   • un membre d'une conversation pouvait réécrire les messages de l'autre :
--     l'historique n'était plus opposable.
--
-- Et en lecture, `brands_select_all using (true)` rendait `postback_secret`
-- lisible par n'importe qui, connecté ou non. Ce secret est la clé qui autorise
-- à déclarer une vente : le lire, c'est pouvoir facturer une marque et faire
-- payer des commissions à sa place. C'est le point le plus grave des six.
--
-- ─── Le principe retenu ───
-- Le navigateur n'écrit que les champs qu'un humain remplit dans un formulaire.
-- Tout le reste — argent, droits, réputation, contrats — passe par le serveur,
-- qui vérifie l'identité avant d'agir. On ne retire donc pas les policies : on
-- retire les COLONNES, ce que RLS ne sait pas faire mais que les privilèges
-- Postgres font depuis toujours.
--
-- ⚠️ À SAVOIR POUR PLUS TARD
-- `grant update on all tables in schema public to authenticated` — répété dans
-- 0002, 0003, 0004, 0005 et 0006 — REND tout ce que ce fichier retire. Toute
-- migration future qui recopie cette ligne rouvre les six portes d'un coup.
-- ============================================================


-- ── profils ───────────────────────────────────────────────────
-- Un humain change son nom affiché et sa photo. Il ne se nomme pas
-- administrateur, et il ne change pas de rôle en douce (le passage
-- marque ⇄ créateur passe par la fonction `confirm_user_role`, qui, elle,
-- vérifie).
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;

-- `with check` manquait : sans elle, seule la ligne LUE était contrôlée, pas
-- la ligne écrite.
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);


-- ── créateurs ─────────────────────────────────────────────────
-- Il écrit sa fiche. Il n'écrit pas sa réputation : `verified`, `rating`,
-- `reviews_count`, `deals_count`, `total_earnings` et `reliability_score` sont
-- le résultat de ce qui s'est passé sur la plateforme — s'ils deviennent
-- déclaratifs, ils ne valent plus rien pour personne.
revoke update on public.creators from authenticated;
grant update (
  handle, bio, custom_niche, engagement,
  rate_video, rate_mention, rate_pack,
  city, city_slug, country, travels,
  stripe_account_id, updated_at
) on public.creators to authenticated;

revoke insert on public.creators from authenticated;
grant insert (
  id, handle, bio, custom_niche, engagement,
  rate_video, rate_mention, rate_pack,
  city, city_slug, country, travels,
  stripe_account_id, created_at, updated_at
) on public.creators to authenticated;


-- ── marques ───────────────────────────────────────────────────
-- Elle écrit son identité. Elle n'écrit ni son argent (`balance`), ni son
-- abonnement (`plan`), ni ses taux de commission, ni son secret de postback,
-- ni ses identifiants Stripe. Le réglage de la recharge automatique reste
-- côté serveur : il déclenche un prélèvement.
revoke update on public.brands from authenticated;
grant update (name, website, sector, logo_url, description, updated_at)
  on public.brands to authenticated;

revoke insert on public.brands from authenticated;
grant insert (id, name, website, sector, logo_url, description, created_at, updated_at)
  on public.brands to authenticated;

-- La lecture aussi : le secret de postback n'a rien à faire dans une réponse
-- que n'importe qui peut demander. Les colonnes retirées sont relues côté
-- serveur, par le client de service, dans les quatre écrans qui en ont besoin.
revoke select on public.brands from anon, authenticated;
grant select (
  id, name, website, sector, logo_url, description,
  rating, reviews_count, is_demo, tracking_verified_at,
  created_at, updated_at
) on public.brands to anon, authenticated;


-- ── contrats ──────────────────────────────────────────────────
-- Un contrat signé qui peut être réécrit par l'une des parties n'est pas un
-- contrat. La lecture reste ouverte aux deux parties ; l'écriture passe
-- entièrement par le serveur, qui signe les deux côtés en même temps et
-- n'accepte que les transitions prévues.
drop policy if exists "contracts_write" on public.contracts;
revoke insert, update, delete on public.contracts from authenticated;


-- ── messages ──────────────────────────────────────────────────
-- On écrit ses propres messages (la policy d'insertion l'impose déjà) et on
-- marque comme lus ceux qu'on reçoit. On ne récrit pas le texte de l'autre,
-- et on n'efface pas la conversation.
revoke update, delete on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;


-- ── vérification ──────────────────────────────────────────────
-- Un filet, pas une décoration : si une migration ultérieure recopie le
-- `grant update on all tables`, ce bloc échoue au déploiement suivant plutôt
-- que de laisser les portes rouvertes en silence.
do $$
declare colonnes text;
begin
  select string_agg(column_name, ', ' order by column_name) into colonnes
  from information_schema.column_privileges
  where grantee = 'authenticated' and privilege_type = 'UPDATE'
    and table_schema = 'public' and table_name = 'profiles'
    and column_name in ('is_admin', 'role', 'role_confirmed', 'id');
  if colonnes is not null then
    raise exception 'profiles : colonnes privilegiees encore modifiables par le navigateur (%)', colonnes;
  end if;

  select string_agg(column_name, ', ' order by column_name) into colonnes
  from information_schema.column_privileges
  where grantee in ('authenticated', 'anon') and privilege_type = 'SELECT'
    and table_schema = 'public' and table_name = 'brands'
    and column_name = 'postback_secret';
  if colonnes is not null then
    raise exception 'brands : le secret de postback est encore lisible depuis le navigateur';
  end if;
end $$;
