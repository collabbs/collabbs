-- Prospects captés par les outils gratuits.
--
-- Les deux outils publics (calculateur de droits d'usage, suivi du seuil de
-- 1 000 €) sont référencés et ne captent rien : la personne obtient sa réponse
-- et repart. On paie le référencement, on offre le résultat.
--
-- Cette table reçoit les adresses laissées EN ÉCHANGE d'une contrepartie —
-- aujourd'hui le modèle de contrat conforme au décret n° 2025-1137. Pas de mur
-- devant l'outil : l'outil reste entièrement gratuit et utilisable sans rien
-- donner. La demande n'arrive qu'au moment où elle a un sens, quand le seuil
-- est franchi et que le contrat écrit devient obligatoire.

create table if not exists public.tool_leads (
  id           uuid primary key default gen_random_uuid(),
  email        text        not null,
  -- Quel outil a produit ce contact. Texte libre plutôt qu'énumération : une
  -- contrainte CHECK énumérative a déjà cassé en silence trois fois sur ce
  -- projet, au moment précis où on ajoutait une valeur.
  source       text        not null,
  -- Contexte au moment de la capture (nombre de marques au-dessus du seuil,
  -- montant cumulé…). Sert à savoir QUI on a en face, pas à le pister.
  contexte     jsonb       not null default '{}'::jsonb,
  -- Renseigné si la personne finit par créer un compte, pour mesurer ce que
  -- ces outils rapportent réellement.
  converti_le  timestamptz,
  created_at   timestamptz not null default now()
);

-- Une adresse ne compte qu'une fois par outil : quelqu'un qui revient
-- recalculer ne doit pas créer un doublon, et l'action de capture s'appuie
-- dessus pour rester idempotente.
create unique index if not exists tool_leads_email_source_idx
  on public.tool_leads (lower(email), source);

create index if not exists tool_leads_created_at_idx
  on public.tool_leads (created_at desc);

alter table public.tool_leads enable row level security;

-- Aucune politique : personne ne lit ni n'écrit cette table depuis le
-- navigateur. L'insertion passe par une action serveur avec la clé de service,
-- et la lecture par le tableau de bord. Une adresse e-mail laissée sur un
-- outil public n'a aucune raison d'être exposée à un client anonyme.
revoke all on public.tool_leads from anon, authenticated;
grant  all on public.tool_leads to service_role;
