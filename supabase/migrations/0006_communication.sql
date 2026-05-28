-- ============================================================
-- Collabbs · Schéma DB — Brique 5 : Communication
-- Conversations, messages, notifications, avis
-- ------------------------------------------------------------
-- Migration 0006 (dernière brique du schéma)
-- À appliquer via : Supabase Dashboard → SQL Editor → coller → Run
-- ============================================================

-- ============================================================
-- conversations : un fil par paire (marque, créateur)
-- ============================================================
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid not null references public.brands(id)   on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, creator_id)
);
create index on public.conversations (brand_id);
create index on public.conversations (creator_id);

-- ============================================================
-- messages
-- ============================================================
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id)      on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.messages (conversation_id);

-- ============================================================
-- notifications (générées par le backend, lues par le destinataire)
-- ============================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,                 -- new_message, new_application, deal_signed...
  title      text not null,
  body       text,
  link       text,                          -- url interne vers la ressource
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id);

-- ============================================================
-- reviews : avis d'une marque sur un créateur (après un deal)
-- ============================================================
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid unique references public.deals(id) on delete set null,
  brand_id   uuid not null references public.brands(id)   on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);
create index on public.reviews (creator_id);

-- ---------- Trigger updated_at ----------
create trigger trg_conversations_updated before update on public.conversations
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews       enable row level security;

-- conversations : privées entre les 2 parties
create policy "conversations_select_parties" on public.conversations
  for select using (brand_id = auth.uid() or creator_id = auth.uid());
create policy "conversations_insert_party" on public.conversations
  for insert with check (brand_id = auth.uid() or creator_id = auth.uid());
create policy "conversations_update_parties" on public.conversations
  for update using (brand_id = auth.uid() or creator_id = auth.uid());

-- messages : membres de la conversation
create policy "messages_select" on public.messages
  for select using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid()))
  );
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid()))
  );
create policy "messages_update" on public.messages
  for update using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and (c.brand_id = auth.uid() or c.creator_id = auth.uid()))
  );

-- notifications : destinataire uniquement (insertion par le backend / service_role)
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- reviews : lecture publique (profil créateur) ; écriture par la marque auteur
create policy "reviews_select_all" on public.reviews
  for select using (true);
create policy "reviews_insert_brand" on public.reviews
  for insert with check (brand_id = auth.uid());
create policy "reviews_update_brand" on public.reviews
  for update using (brand_id = auth.uid());

-- ---------- Permissions (idempotent) ----------
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- ============================================================
-- Fin Brique 5 — schéma complet 🎉
-- ============================================================
