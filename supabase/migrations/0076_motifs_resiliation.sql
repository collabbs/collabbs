-- ═══════════════════════════════════════════════════════════════════════════
-- Pourquoi les marques partent
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La V1 perdait 41 % de ses abonnés par mois sans que personne sache pourquoi :
-- on voyait le départ dans Stripe, jamais le motif. Un taux de fuite qu'on ne
-- sait pas expliquer ne se corrige pas, il se subit.
--
-- La question est posée une fois, au moment où la réponse est la plus honnête
-- — juste avant de confirmer l'arrêt — et elle reste FACULTATIVE. Une réponse
-- arrachée par un champ obligatoire est une réponse au hasard : elle salirait
-- la seule donnée qu'on cherche à obtenir.
--
-- On garde la ligne même après le départ : c'est précisément quand la marque
-- n'est plus là qu'on a besoin de savoir ce qui l'a fait partir.

create table if not exists public.resiliations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- Le plan quitté, figé ici : la colonne de la marque aura changé.
  plan text not null,
  -- Motif choisi dans une liste courte. Volontairement TEXTE et non enum :
  -- une contrainte énumérative qui refuse une valeur casse l'écran d'arrêt en
  -- silence, et on a déjà payé ça trois fois.
  motif text,
  commentaire text,
  -- Ce que la marque dépensait au moment de partir : un départ à 5 000 €/mois
  -- et un départ à 0 € ne racontent pas la même histoire.
  volume_30j numeric,
  created_at timestamptz not null default now()
);

create index if not exists resiliations_brand_idx on public.resiliations (brand_id);
create index if not exists resiliations_date_idx on public.resiliations (created_at desc);

alter table public.resiliations enable row level security;

-- Personne ne lit ni n'écrit cette table depuis le navigateur. L'écriture
-- passe par le client de service, la lecture par toi. Sans politique, RLS
-- refuse tout : c'est exactement ce qu'on veut.
revoke all on public.resiliations from anon, authenticated;
