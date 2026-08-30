-- Limitation de débit des points d'entrée publics
--
-- Constat : rien n'empêche aujourd'hui de marteler `/api/track/sale`,
-- `/api/track/promo` et `/api/track/action`. Ces routes s'authentifient avec le
-- secret de la marque — un secret qu'on peut donc DEVINER, à raison d'autant
-- d'essais par seconde que Vercel accepte d'invocations. Une fois trouvé, il
-- permet de fabriquer des ventes, donc des commissions, donc de vider la
-- provision d'une marque. `/r/[code]` et les formulaires d'authentification ont
-- le même problème sous une autre forme : gonfler des clics, énumérer des
-- comptes, noyer une boîte mail de courriers de réinitialisation.
--
-- Pourquoi en base et pas en mémoire : l'application tourne en fonctions
-- serverless sur Vercel. Chaque invocation a sa propre mémoire, et il y en a
-- autant que d'appels simultanés — un compteur en mémoire compterait donc à
-- peu près zéro. Le seul état partagé dont on dispose est Postgres.
--
-- Pourquoi un seau à jetons plutôt qu'un compteur par tranche horaire : un
-- compteur remis à zéro à heure fixe laisse passer deux fois le quota à cheval
-- sur la remise à zéro (fin de fenêtre + début de la suivante). Le seau se
-- recharge en continu, donc la fenêtre glisse vraiment, et il tient en UNE
-- ligne par clé au lieu d'une ligne par requête.

create table if not exists public.rate_limit_buckets (
  -- « track:sale:1.2.3.4 », « auth:login:jean@exemple.fr » — construite par
  -- l'application, jamais saisie par un utilisateur.
  key         text primary key,
  -- Jetons restants. Fractionnaire : la recharge est continue, pas par paliers.
  tokens      numeric(12,4) not null,
  updated_at  timestamptz not null default now()
);

-- Sert au nettoyage (`purge_rate_limit_buckets`), qui balaie par ancienneté.
create index if not exists idx_rate_limit_buckets_stale
  on public.rate_limit_buckets (updated_at);

alter table public.rate_limit_buckets enable row level security;
-- Aucune policy : seul le service_role touche cette table. Une clé de seau
-- contient une adresse IP ou une adresse email ; ça n'a rien à faire dans le
-- navigateur de qui que ce soit.

/**
 * Consomme un jeton pour `p_key`, et dit si l'appel est autorisé.
 *
 * Atomique par construction : le verrou de ligne fait que deux invocations
 * serverless simultanées sur la même clé s'exécutent l'une après l'autre. Sans
 * ce verrou elles liraient le même solde et se croiraient toutes les deux dans
 * les clous — exactement le trou qu'on cherche à boucher.
 *
 * L'arithmétique du seau est la transcription de `consume()` dans
 * `src/lib/rate-limit.ts`, qui en est l'implémentation de référence et la seule
 * testée. Les deux doivent bouger ensemble.
 */
create or replace function public.consume_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
) returns table (allowed boolean, tokens_left numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_tokens  numeric;
  v_updated timestamptz;
begin
  -- Politique incohérente (limite nulle, fenêtre nulle) : on laisse passer. Une
  -- erreur de configuration ne doit pas fermer le service.
  if p_key is null or coalesce(p_limit, 0) < 1 or coalesce(p_window_seconds, 0) < 1 then
    return query select true, 0::numeric;
    return;
  end if;

  -- Premier appel pour cette clé : seau plein. On crée la ligne avant de la
  -- verrouiller, sinon il n'y a rien à verrouiller.
  insert into public.rate_limit_buckets (key, tokens)
  values (p_key, p_limit)
  on conflict (key) do nothing;

  select tokens, updated_at
    into v_tokens, v_updated
    from public.rate_limit_buckets
   where key = p_key
     for update;

  if not found then
    -- La ligne a disparu entre l'insertion et le verrou : nettoyage concurrent,
    -- ou transaction voisine annulée. Laisser passer un appel coûte moins cher
    -- que de refuser à tort — voir la note sur le repli permissif plus bas.
    return query select true, 0::numeric;
    return;
  end if;

  -- Recharge continue : `p_limit` jetons se reconstituent en `p_window_seconds`.
  v_tokens := least(
    p_limit::numeric,
    v_tokens + extract(epoch from (now() - v_updated)) * p_limit::numeric / p_window_seconds
  );

  if v_tokens < 1 then
    -- Refusé — et on ne retire RIEN. Un client qui martèle ne creuse pas sa
    -- dette : il attend que le seau se remplisse, et pas une seconde de plus.
    -- Sinon un script en boucle se condamnerait lui-même indéfiniment, y
    -- compris après avoir été corrigé.
    update public.rate_limit_buckets
       set tokens = v_tokens, updated_at = now()
     where key = p_key;
    return query select false, v_tokens;
    return;
  end if;

  update public.rate_limit_buckets
     set tokens = v_tokens - 1, updated_at = now()
   where key = p_key;

  return query select true, v_tokens - 1;
end $$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

/**
 * Supprime les seaux dont plus personne ne se sert.
 *
 * Un seau inactif depuis un jour est forcément plein — la recharge est continue
 * et la plus longue fenêtre se compte en minutes. Le supprimer équivaut donc
 * exactement à le garder, en moins de lignes. Sans ce ménage, la table grossit
 * d'une ligne par adresse IP vue, pour toujours.
 */
create or replace function public.purge_rate_limit_buckets()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_buckets
   where updated_at < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

revoke all on function public.purge_rate_limit_buckets() from public, anon, authenticated;
grant execute on function public.purge_rate_limit_buckets() to service_role;

comment on table public.rate_limit_buckets is
  'Seaux à jetons de la limitation de débit. Un seau par clé (route + IP ou email).';
comment on function public.consume_rate_limit is
  'Consomme un jeton et dit si l''appel passe. Atomique : verrou de ligne, obligatoire en serverless.';
