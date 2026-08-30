-- Journal des erreurs de production
--
-- Manque constaté le 30 août 2026 : treize fichiers appellent `console.error`
-- sur des chemins qui touchent à l'argent — versement impossible, séquestre
-- non enregistré, crédit CPA en échec. En production, ces lignes partent dans
-- les journaux Vercel, que personne ne consulte et que le plan gratuit ne
-- conserve pas longtemps.
--
-- Résultat : si quelque chose casse, personne ne l'apprend. Tout ce qui a été
-- trouvé aujourd'hui l'a été en REGARDANT ; en production, personne ne
-- regardera.
--
-- Cette table garde les erreurs dans le produit lui-même, visibles depuis
-- l'écran d'administration. Ce n'est pas un remplacement d'un vrai service de
-- suivi (pas d'agrégation de piles d'appel, pas d'alerte hors de l'app) — c'est
-- le filet qui ne dépend d'aucun compte tiers et qui fonctionne aujourd'hui.

create table if not exists public.error_reports (
  id           uuid primary key default gen_random_uuid(),
  -- D'où vient l'erreur : « stripe-webhook », « deals/payout »…
  context      text not null,
  -- Message court, sans identifiant variable : c'est la clé de regroupement.
  message      text not null,
  -- Détail complet : pile d'appel, identifiants concernés.
  detail       text,
  -- Utilisateur concerné, quand on le connaît.
  user_id      uuid references public.profiles(id) on delete set null,
  occurrences  integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- Marqué traité depuis l'écran d'administration.
  resolved_at  timestamptz
);

-- Une même erreur ne crée pas mille lignes : on compte les occurrences.
create unique index if not exists uniq_error_reports_fingerprint
  on public.error_reports (context, message) where resolved_at is null;

create index if not exists idx_error_reports_recent
  on public.error_reports (last_seen_at desc) where resolved_at is null;

alter table public.error_reports enable row level security;
-- Aucune policy : la table n'est accessible qu'au service_role. Les erreurs
-- peuvent contenir des identifiants et des messages techniques ; elles n'ont
-- rien à faire dans le navigateur d'un utilisateur.

/**
 * Enregistre une erreur, ou incrémente son compteur si elle est déjà connue.
 */
create or replace function public.report_error(
  p_context text,
  p_message text,
  p_detail  text default null,
  p_user    uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.error_reports (context, message, detail, user_id)
  values (p_context, left(p_message, 500), left(p_detail, 4000), p_user)
  on conflict (context, message) where resolved_at is null
  do update set
    occurrences = public.error_reports.occurrences + 1,
    last_seen_at = now(),
    detail = coalesce(excluded.detail, public.error_reports.detail);
end $$;

revoke all on function public.report_error(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.report_error(text, text, text, uuid) to service_role;

comment on table public.error_reports is
  'Erreurs de production, visibles depuis l''écran d''administration. Filet sans dépendance tierce.';
