-- Suivi des actions CPA (suite) — à appliquer APRÈS 0043.
--
-- Séparé parce que la valeur d'enum ajoutée en 0043 n'est utilisable qu'une
-- fois cette transaction-là validée.

-- ------------------------------------------------------------------
-- PIÈGE ÉVITÉ DE JUSTESSE, et c'est la troisième fois qu'il mord.
--
-- `affiliate_events_status_check` (migration 0035) était exhaustive sur les
-- deux seuls types qui existaient alors :
--
--   (type = 'sale' and status is not null) or (type = 'click' and status is null)
--
-- Avec `type = 'action'`, AUCUNE branche n'est satisfaite : la contrainte
-- rejette la ligne. Toute déclaration d'action aurait échoué, et la
-- fonctionnalité n'aurait jamais rien enregistré — exactement le manque
-- qu'elle vient combler.
--
-- Une action porte un statut comme une vente : elle est due, réservée,
-- validée, payée. On l'aligne donc sur 'sale'.
--
-- Leçon récurrente : toute contrainte CHECK qui énumère des valeurs doit être
-- relue avant d'introduire une valeur nouvelle. Elle échoue en silence côté
-- application — une insertion refusée, et rien ne s'enregistre.
-- ------------------------------------------------------------------
alter table public.affiliate_events drop constraint if exists affiliate_events_status_check;
alter table public.affiliate_events
  add constraint affiliate_events_status_check check (
    (type in ('sale', 'action') and status is not null)
    or (type = 'click' and status is null)
  );

-- Un même identifiant externe ne doit compter qu'une fois par lien : une
-- boutique qui rejoue son postback ne doit pas payer deux fois la même action.
create unique index if not exists uniq_affiliate_action_external_ref
  on public.affiliate_events (link_id, external_ref)
  where type = 'action' and external_ref is not null;

-- Le calcul des paliers relit toutes les actions d'un lien à chaque
-- déclaration : cet index le garde immédiat.
create index if not exists idx_affiliate_events_link_action
  on public.affiliate_events (link_id) where type = 'action';

comment on column public.affiliate_events.action_count is
  'Nombre d''actions déclarées par cet événement (CPA). 1 par défaut.';
