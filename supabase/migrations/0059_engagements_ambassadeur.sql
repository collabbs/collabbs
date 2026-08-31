-- ============================================================
-- Collabbs · 0059 — les partenariats récurrents (ambassadeur)
-- ------------------------------------------------------------
-- Le dernier format annoncé nulle part et impossible partout : un créateur et
-- une marque qui s'engagent sur plusieurs mois. C'est celui qui change le
-- métier du créateur — un revenu prévisible au lieu d'une suite de coups.
--
-- ─── Ce que cette table N'EST PAS ───
-- Elle ne transporte pas d'argent. Un engagement **crée des collaborations** :
-- chaque mois, une collaboration ordinaire s'ouvre, avec son séquestre, son
-- contrat, sa livraison et son versement. Aucun troisième circuit à côté du
-- séquestre et de la provision — le mois d'un ambassadeur emprunte exactement
-- le chemin d'une collaboration isolée. C'est ce qui permet d'ajouter le
-- format sans toucher une ligne du code qui déplace l'argent.
--
-- ─── On ne séquestre pas douze mois d'avance ───
-- Immobiliser 4 800 € pour un an bloquerait la trésorerie de la marque et
-- personne ne signerait. Chaque mois se paie à son tour. La conséquence doit
-- être assumée et dite aux deux parties : **l'engagement est un plan, pas une
-- dette.** Le créateur n'a pas douze mois garantis en banque ; il a une
-- intention, un préavis, et une trace écrite.
-- ============================================================

do $$ begin
  create type public.engagement_status as enum ('active', 'ended');
exception when duplicate_object then null;
end $$;

create table if not exists public.engagements (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brands(id)   on delete cascade,
  creator_id        uuid not null references public.creators(id) on delete cascade,

  -- Les termes reconduits chaque mois.
  monthly_amount    integer not null check (monthly_amount > 0),
  contents_per_month integer not null default 1 check (contents_per_month between 1 and 100),
  months_total      integer not null check (months_total between 1 and 36),
  -- Combien de mois ont DÉJÀ été ouverts. C'est ce compteur, et non la date du
  -- jour, qui détermine la prochaine échéance : un automate en retard rattrape
  -- au lieu de sauter un mois.
  months_created    integer not null default 0 check (months_created >= 0),

  -- Repris de la collaboration d'origine, pour que chaque mois naisse avec les
  -- mêmes caractéristiques sans que personne ait à les ressaisir.
  format            public.deal_format not null default 'video_post',
  platform_id       integer references public.platforms(id),
  source_deal_id    uuid references public.deals(id) on delete set null,

  starts_at         timestamptz not null default now(),
  status            public.engagement_status not null default 'active',
  -- Rupture : qui, quand, et à partir de quand elle prend effet.
  ended_at          timestamptz,
  ended_by          uuid references auth.users(id),
  notice_days       integer not null default 30 check (notice_days between 0 and 90),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- On n'ouvre jamais plus de mois qu'il n'en a été convenu.
  constraint engagements_mois_bornes check (months_created <= months_total)
);

create index if not exists idx_engagements_brand on public.engagements (brand_id, status);
create index if not exists idx_engagements_creator on public.engagements (creator_id, status);
-- L'automate cherche les engagements actifs qui ont encore des mois à ouvrir.
create index if not exists idx_engagements_a_ouvrir
  on public.engagements (status, starts_at)
  where status = 'active';

create trigger trg_engagements_updated before update on public.engagements
  for each row execute function public.set_updated_at();

-- Rattachement des collaborations générées. Sans ces deux colonnes, une
-- collaboration issue d'un engagement serait indistinguable d'une collaboration
-- isolée : impossible de dire au créateur « mois 3 sur 6 », ni d'empêcher un
-- doublon si l'automate tourne deux fois.
alter table public.deals
  add column if not exists engagement_id uuid references public.engagements(id) on delete set null,
  add column if not exists engagement_month integer;

-- Le rempart contre le DOUBLON. L'automate tourne tous les jours ; sans cet
-- index, une exécution qui échouerait après la création de la collaboration
-- mais avant l'incrément du compteur ouvrirait une seconde collaboration le
-- lendemain — avec son contrat, et bientôt son séquestre.
create unique index if not exists idx_deals_engagement_mois_unique
  on public.deals (engagement_id, engagement_month)
  where engagement_id is not null;

alter table public.engagements enable row level security;

-- Les deux parties lisent : le créateur doit voir où en est son engagement.
drop policy if exists "engagements_select_parties" on public.engagements;
create policy "engagements_select_parties" on public.engagements
  for select using (brand_id = auth.uid() or creator_id = auth.uid());

-- Seule la marque ouvre un engagement : c'est elle qui paiera chaque mois.
drop policy if exists "engagements_insert_brand" on public.engagements;
create policy "engagements_insert_brand" on public.engagements
  for insert with check (brand_id = auth.uid());

-- Les DEUX peuvent y mettre fin. Un engagement que seule la marque pourrait
-- rompre serait un piège pour le créateur.
drop policy if exists "engagements_update_parties" on public.engagements;
create policy "engagements_update_parties" on public.engagements
  for update using (brand_id = auth.uid() or creator_id = auth.uid());
