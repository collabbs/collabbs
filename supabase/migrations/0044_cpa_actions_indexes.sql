-- Suivi des actions CPA (suite) — à appliquer APRÈS 0043.
--
-- Séparé parce que la valeur d'enum ajoutée en 0043 n'est utilisable qu'une
-- fois cette transaction-là validée.

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
