-- ============================================================
-- Collabbs · Schéma DB — Brique 1 : Noyau
-- Comptes, profils créateur/marque, référentiels (niches, plateformes)
-- ------------------------------------------------------------
-- Migration 0001
-- À appliquer via : Supabase Dashboard → SQL Editor → coller → Run
-- Idempotence : ce script suppose une base vierge (première migration).
-- ============================================================

-- ---------- Types ----------
create type public.user_role as enum ('creator', 'brand');

-- ============================================================
-- Tables de référence (lecture publique, écriture admin uniquement)
-- ============================================================
create table public.niches (
  id    smallint generated always as identity primary key,
  slug  text unique not null,
  label text not null
);

create table public.platforms (
  id    smallint generated always as identity primary key,
  slug  text unique not null,
  label text not null
);

-- Données initiales (tirées de la maquette)
insert into public.niches (slug, label) values
  ('finance','Finance'), ('mode','Mode'), ('beaute','Beauté'),
  ('tech','Tech'), ('business','Business'), ('lifestyle','Lifestyle'),
  ('sport','Sport'), ('gaming','Gaming'), ('cuisine','Cuisine'),
  ('voyage','Voyage'), ('sante','Santé'), ('formation','Formation');

insert into public.platforms (slug, label) values
  ('tiktok','TikTok'), ('instagram','Instagram'), ('youtube','YouTube'),
  ('facebook','Facebook'), ('snapchat','Snapchat'), ('linkedin','LinkedIn'),
  ('twitter','Twitter / X'), ('twitch','Twitch');

-- ============================================================
-- profiles : extension de auth.users (1 ligne par compte)
-- Données publiques d'affichage + rôle. L'email reste dans auth.users.
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- creators : profil créateur (1-1 avec profiles)
-- ============================================================
create table public.creators (
  id                uuid primary key references public.profiles(id) on delete cascade,
  handle            text unique,                 -- @pseudo
  bio               text,
  verified          boolean not null default false,
  -- Tarifs (en euros)
  rate_video        integer,                     -- vidéo dédiée
  rate_mention      integer,                     -- mention / story
  rate_pack         integer,                     -- pack 3 vidéos
  -- Réputation (agrégés — recalculés plus tard par du code/triggers)
  reliability_score smallint check (reliability_score between 0 and 100),
  rating            numeric(2,1) check (rating between 0 and 5),
  reviews_count     integer not null default 0,
  deals_count       integer not null default 0,
  total_earnings    integer not null default 0,  -- cumul € (cache)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- brands : profil marque (1-1 avec profiles)
-- ============================================================
create table public.brands (
  id               uuid primary key references public.profiles(id) on delete cascade,
  name             text not null,
  website          text,
  sector           text,                          -- ref table plus tard si besoin
  logo_url         text,
  -- Grille de commissions d'affiliation par palier de taille (%)
  -- Défauts repris de la maquette : nano 3 / micro 5 / mid 8 / macro 12
  commission_nano  numeric(5,2) not null default 3,
  commission_micro numeric(5,2) not null default 5,
  commission_mid   numeric(5,2) not null default 8,
  commission_macro numeric(5,2) not null default 12,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- Liaisons
-- ============================================================
-- Un créateur a plusieurs niches (N-N)
create table public.creator_niches (
  creator_id uuid     not null references public.creators(id) on delete cascade,
  niche_id   smallint not null references public.niches(id)   on delete cascade,
  primary key (creator_id, niche_id)
);

-- Un créateur a plusieurs comptes-réseaux, chacun avec ses stats
create table public.creator_platforms (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid     not null references public.creators(id)  on delete cascade,
  platform_id smallint not null references public.platforms(id),
  handle      text,
  subscribers integer,
  url         text,
  unique (creator_id, platform_id)
);

create index on public.creator_platforms (creator_id);
create index on public.creator_niches (niche_id);

-- ============================================================
-- Triggers : updated_at automatique
-- ============================================================
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_creators_updated before update on public.creators
  for each row execute function public.set_updated_at();
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

-- ============================================================
-- Trigger : création automatique du profil à l'inscription
-- Lit le rôle et le nom depuis les métadonnées du signup.
-- ============================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'creator'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.creators          enable row level security;
alter table public.brands            enable row level security;
alter table public.niches            enable row level security;
alter table public.platforms         enable row level security;
alter table public.creator_niches    enable row level security;
alter table public.creator_platforms enable row level security;

-- profiles : lecture publique (nom + avatar + rôle), écriture par soi-même
create policy "profiles_select_all" on public.profiles
  for select using (true);
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);

-- creators : lecture publique (marketplace), écriture par soi-même
create policy "creators_select_all" on public.creators
  for select using (true);
create policy "creators_insert_self" on public.creators
  for insert with check (auth.uid() = id);
create policy "creators_update_self" on public.creators
  for update using (auth.uid() = id);

-- brands : lecture publique, écriture par soi-même
create policy "brands_select_all" on public.brands
  for select using (true);
create policy "brands_insert_self" on public.brands
  for insert with check (auth.uid() = id);
create policy "brands_update_self" on public.brands
  for update using (auth.uid() = id);

-- référentiels : lecture publique uniquement (écriture via service_role qui bypasse RLS)
create policy "niches_select_all" on public.niches
  for select using (true);
create policy "platforms_select_all" on public.platforms
  for select using (true);

-- creator_niches : lecture publique, écriture par le créateur propriétaire
create policy "creator_niches_select_all" on public.creator_niches
  for select using (true);
create policy "creator_niches_write_own" on public.creator_niches
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- creator_platforms : idem
create policy "creator_platforms_select_all" on public.creator_platforms
  for select using (true);
create policy "creator_platforms_write_own" on public.creator_platforms
  for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

-- ============================================================
-- Fin Brique 1
-- ============================================================
