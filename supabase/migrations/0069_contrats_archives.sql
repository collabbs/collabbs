-- ============================================================
-- 0069 — Ce qui doit survivre à la suppression d'un compte
-- ============================================================
--
-- ─── Le problème ───
-- `deleteAccount` appelait `auth.admin.deleteUser` et rien d'autre. Tout
-- cascade : profil → collaborations → transactions → contrats. Or une
-- collaboration a DEUX parties, et l'autre n'a rien demandé.
--
-- Concrètement, un créateur qui supprimait son compte pendant qu'un séquestre
-- était ouvert effaçait le deal ET la transaction : l'argent restait chez
-- Stripe, la marque n'était jamais remboursée, et il ne restait plus une seule
-- ligne en base pour rattraper à la main. L'écran venait pourtant de lui
-- promettre l'inverse.
--
-- Et même sans argent en jeu : les contrats signés disparaissaient pour
-- l'autre partie. Un contrat est une preuve à deux exemplaires. Qu'un des
-- deux signataires puisse faire disparaître l'exemplaire de l'autre, d'un
-- clic, sans qu'il en soit informé, n'est pas une suppression de compte —
-- c'est une destruction de preuve.
--
-- ─── Ce que fait cette table ───
-- Elle recueille, AVANT la suppression, les contrats signés dans lesquels le
-- partant était partie, et les rattache à celui qui reste. Le texte du contrat
-- est déjà figé dans `terms_snapshot` depuis la signature : on n'archive pas
-- un résumé, on archive le document. Le nom de la contrepartie est recopié en
-- clair, puisque sa fiche, elle, disparaît bel et bien.
--
-- Aucune clé étrangère vers le compte supprimé : c'est le principe même. La
-- seule attache est `partie_id`, celui qui reste — et si lui aussi part un
-- jour, son archive s'en va avec lui, car il n'y aura plus personne pour la
-- lire.
-- ============================================================

create table if not exists public.contrats_archives (
  id                 uuid primary key default gen_random_uuid(),

  -- Celui qui reste. C'est lui, et lui seul, qui peut relire ce document.
  partie_id          uuid not null references public.profiles(id) on delete cascade,
  partie_role        text not null check (partie_role in ('brand', 'creator')),

  -- La contrepartie n'existe plus : son nom est recopié, pas référencé.
  contrepartie_nom   text,

  reference          text not null,
  genre              text not null default 'deal' check (genre in ('deal', 'affiliate')),
  intitule           text,
  montant            numeric(10, 2),

  -- Le document lui-même, figé à la signature.
  terms_snapshot     jsonb,
  statut             text,
  brand_signed_at    timestamptz,
  creator_signed_at  timestamptz,
  terminated_at      timestamptz,

  archive_le         timestamptz not null default now(),
  motif              text not null default 'compte_supprime'
);

create index if not exists contrats_archives_partie_idx
  on public.contrats_archives (partie_id, archive_le desc);

-- Un même contrat ne s'archive qu'une fois, même si la suppression est rejouée.
create unique index if not exists contrats_archives_unicite_idx
  on public.contrats_archives (partie_id, reference);

comment on table public.contrats_archives is
  'Contrats signes conserves pour la partie restante apres suppression du compte de l''autre. Ecrit uniquement par le serveur.';

alter table public.contrats_archives enable row level security;

-- Lecture : seulement par celui à qui l'archive appartient.
-- Écriture : personne depuis le navigateur. Seul le serveur archive, au moment
-- où il supprime — et il ne le fait qu'une fois.
drop policy if exists "contrats_archives_select_partie" on public.contrats_archives;
create policy "contrats_archives_select_partie" on public.contrats_archives
  for select using (partie_id = auth.uid());

grant select on public.contrats_archives to authenticated;
revoke insert, update, delete on public.contrats_archives from authenticated, anon;
