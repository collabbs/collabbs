-- Infos légales — 1 entrée par utilisateur (brand OU creator), réutilisées
-- automatiquement à chaque génération de contrat (les 2 parties les ont
-- saisies une seule fois, après l'onboarding).
--
-- Stockage non chiffré ici (Supabase encrypts at rest), mais les politiques
-- RLS limitent strictement la lecture à soi-même. Pour le rendu des
-- contrats, le serveur (admin client) lit les infos des 2 parties.

create table if not exists legal_info (
  user_id        uuid primary key references profiles(id) on delete cascade,
  -- Statut juridique : 'individual', 'micro', 'sas', 'sarl', 'eurl', 'sa', 'other'
  status         text,
  -- Nom légal complet (raison sociale ou nom+prénom de la personne)
  legal_name     text,
  -- Représentant légal pour une entreprise (souvent identique au signataire)
  rep_name       text,
  -- Adresse postale (siège social ou domicile)
  address        text,
  city           text,
  zip            text,
  country        text default 'France',
  -- SIREN/SIRET (si pro)
  siret          text,
  -- TVA intracommunautaire (FR12345678901 etc., si pro EU)
  vat            text,
  -- Email de contact officiel pour contrats/factures (souvent différent du
  -- login Supabase)
  contact_email  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function touch_legal_info_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_legal_info_updated_at on legal_info;
create trigger trg_legal_info_updated_at
  before update on legal_info
  for each row execute function touch_legal_info_updated_at();

alter table legal_info enable row level security;

-- L'utilisateur lit ses propres infos.
drop policy if exists "legal_info_select_self" on legal_info;
create policy "legal_info_select_self" on legal_info
  for select using (user_id = auth.uid());

-- L'utilisateur insère/met à jour/supprime ses propres infos.
drop policy if exists "legal_info_insert_self" on legal_info;
create policy "legal_info_insert_self" on legal_info
  for insert with check (user_id = auth.uid());

drop policy if exists "legal_info_update_self" on legal_info;
create policy "legal_info_update_self" on legal_info
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "legal_info_delete_self" on legal_info;
create policy "legal_info_delete_self" on legal_info
  for delete using (user_id = auth.uid());

-- Pas de policy pour la contrepartie : le rendu de contrat se fait
-- server-side via l'admin client (service role) qui lit les 2 lignes
-- en bypassant RLS. C'est sain : le créateur ne peut pas lire l'adresse
-- de la marque tant qu'aucun contrat n'a été signé entre eux.
