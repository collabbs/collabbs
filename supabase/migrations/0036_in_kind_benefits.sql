-- Avantages en nature (cadeaux, dotations, services offerts)
--
-- Le décret n° 2025-1137 compte la « valeur des avantages en nature » dans le
-- seuil de 1 000 € HT par année civile et par couple annonceur × créateur, au
-- même titre que l'argent versé. Un produit à 400 € envoyé rapproche donc
-- autant du seuil que 400 € virés.
--
-- Jusqu'ici Collabbs ne connaissait que l'argent : tout cumul affiché était
-- structurellement sous-estimé. Cette table comble le trou — et ouvre au
-- passage la catégorie du « gifting » (envoi de produit contre contenu), qui
-- est une porte d'entrée majeure pour les marques.
--
-- Un avantage peut exister SANS collaboration formalisée : une marque envoie
-- un produit à un créateur sans deal. D'où `deal_id` nullable.

do $$ begin
  create type public.in_kind_status as enum (
    'declared',  -- déclaré par la marque, valeur comptée dans le cumul
    'disputed',  -- le créateur conteste (jamais reçu, ou valeur erronée)
    'cancelled'  -- retiré par la marque
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.in_kind_benefits (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references public.brands(id)   on delete cascade,
  creator_id     uuid not null references public.creators(id) on delete cascade,
  -- Rattachement facultatif à une collaboration.
  deal_id        uuid references public.deals(id) on delete set null,
  -- Ce qui a été offert, en clair : « paire de sneakers modèle X ».
  label          text not null,
  -- Valeur commerciale du bien ou service, en euros.
  value          numeric(12,2) not null check (value >= 0),
  sent_at        date not null default current_date,
  note           text,
  status         public.in_kind_status not null default 'declared',
  dispute_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Le cumul se calcule par couple et par année : c'est la maille de l'index.
create index if not exists idx_in_kind_pair_year
  on public.in_kind_benefits (brand_id, creator_id, sent_at);
create index if not exists idx_in_kind_creator
  on public.in_kind_benefits (creator_id, sent_at desc);

create trigger trg_in_kind_updated before update on public.in_kind_benefits
  for each row execute function public.set_updated_at();

alter table public.in_kind_benefits enable row level security;

-- Les deux parties lisent : le créateur doit pouvoir vérifier ce qu'on déclare
-- lui avoir offert, puisque ça pèse sur son propre cumul annuel.
drop policy if exists "in_kind_select_parties" on public.in_kind_benefits;
create policy "in_kind_select_parties" on public.in_kind_benefits
  for select using (brand_id = auth.uid() or creator_id = auth.uid());

-- Seule la marque déclare : c'est elle qui offre, et c'est elle qui connaît la
-- valeur commerciale du bien.
drop policy if exists "in_kind_insert_brand" on public.in_kind_benefits;
create policy "in_kind_insert_brand" on public.in_kind_benefits
  for insert with check (brand_id = auth.uid());

-- La marque corrige ou annule ; le créateur ne peut que contester, ce qui passe
-- par une action serveur (il ne peut pas modifier la ligne directement).
drop policy if exists "in_kind_update_brand" on public.in_kind_benefits;
create policy "in_kind_update_brand" on public.in_kind_benefits
  for update using (brand_id = auth.uid());

drop policy if exists "in_kind_delete_brand" on public.in_kind_benefits;
create policy "in_kind_delete_brand" on public.in_kind_benefits
  for delete using (brand_id = auth.uid());

grant select, insert, update, delete on public.in_kind_benefits to authenticated;
grant all on public.in_kind_benefits to service_role;

-- ============================================================
-- Contestation par le créateur
-- ============================================================
-- Le créateur ne peut pas modifier la ligne librement (la policy d'UPDATE est
-- réservée à la marque) : il pourrait sinon effacer une déclaration exacte pour
-- rester sous le seuil. Cette fonction lui ouvre UNE seule action, contester,
-- et uniquement sur les avantages qui le concernent.
create or replace function public.dispute_in_kind_benefit(
  p_id     uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'Motif de contestation trop court.';
  end if;

  update public.in_kind_benefits
     set status = 'disputed',
         dispute_reason = btrim(p_reason)
   where id = p_id
     and creator_id = auth.uid()
     and status = 'declared';

  if not found then
    raise exception 'Avantage introuvable, déjà traité, ou non destiné à cet utilisateur.';
  end if;
end $$;

revoke execute on function public.dispute_in_kind_benefit(uuid, text) from public, anon;
grant  execute on function public.dispute_in_kind_benefit(uuid, text) to authenticated;
