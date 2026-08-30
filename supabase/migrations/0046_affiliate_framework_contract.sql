-- Contrat-cadre d'affiliation
--
-- Trou constaté le 30 août 2026 : un créateur qui ne fait QUE de l'affiliation
-- ou du CPA avec une marque n'avait jamais de contrat. Activer un lien est un
-- clic — cela crée un lien de suivi, rien d'autre. Aucune collaboration, donc
-- aucun contrat.
--
-- Or ces commissions comptent dans le seuil de 1 000 € par an et par couple
-- marque-créateur (décret n° 2025-1137). Mais ce seuil n'était consulté qu'à
-- l'intérieur du parcours de collaboration : sans collaboration, jamais
-- consulté. Un créateur pouvait toucher 3 000 € de commissions d'une même
-- marque sans qu'aucun contrat écrit n'existe, ni qu'aucune des deux parties
-- ne soit avertie — exactement la situation que le décret vise.
--
-- L'affiliation est une relation CONTINUE, pas un engagement ponctuel : un
-- contrat par vente n'aurait aucun sens. On introduit donc un contrat-cadre,
-- un par couple marque-créateur et par année civile — la même maille que le
-- seuil légal.

-- Un contrat n'est plus forcément adossé à une collaboration.
alter table public.contracts
  alter column deal_id drop not null;

alter table public.contracts
  add column if not exists kind        text not null default 'deal',
  -- Renseignés pour un contrat-cadre, où il n'y a pas de collaboration d'où
  -- déduire les parties.
  add column if not exists brand_id    uuid references public.profiles(id) on delete cascade,
  add column if not exists creator_id  uuid references public.profiles(id) on delete cascade,
  -- Année civile couverte — la maille du seuil légal.
  add column if not exists period_year integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contracts_kind_check') then
    alter table public.contracts
      add constraint contracts_kind_check check (kind in ('deal', 'affiliate'));
  end if;

  -- Cohérence : un contrat de collaboration porte un deal ; un contrat-cadre
  -- porte les deux parties et l'année. Ni l'un ni l'autre à moitié.
  if not exists (select 1 from pg_constraint where conname = 'contracts_shape_check') then
    alter table public.contracts
      add constraint contracts_shape_check check (
        (kind = 'deal' and deal_id is not null)
        or (kind = 'affiliate' and brand_id is not null
            and creator_id is not null and period_year is not null)
      );
  end if;
end $$;

-- Un seul contrat-cadre par couple et par année.
create unique index if not exists uniq_affiliate_framework_contract
  on public.contracts (brand_id, creator_id, period_year)
  where kind = 'affiliate';

create index if not exists idx_contracts_parties
  on public.contracts (brand_id, creator_id) where kind = 'affiliate';

comment on column public.contracts.kind is
  'deal : contrat d''une collaboration ponctuelle. affiliate : contrat-cadre couvrant la relation d''affiliation d''une année civile.';
comment on column public.contracts.period_year is
  'Année civile couverte par un contrat-cadre. Même maille que le seuil légal de 1 000 €.';
