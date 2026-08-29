-- Accès administrateur
--
-- Jusqu'ici Collabbs n'avait aucun outil interne. Un litige — une marque qui ne
-- valide jamais, un créateur qui ne livre pas, une commission versée à tort —
-- ne pouvait se traiter qu'en écrivant du SQL à la main dans le dashboard
-- Supabase. Avec de l'argent qui circule réellement, ce n'est plus tenable.
--
-- Le drapeau est volontairement minimal : un booléen, posé à la main, sur le
-- profil. Pas de table de rôles, pas de permissions fines — il n'y a qu'une
-- personne à administrer cette plateforme pour l'instant, et un système de
-- droits qu'on n'utilise pas est surtout une surface d'attaque de plus.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Accès à /admin. Se pose à la main en SQL, jamais depuis l''application.';

-- Index partiel : la table sera lue pour trouver les admins, et ils sont rares.
create index if not exists idx_profiles_admin
  on public.profiles (id) where is_admin = true;

-- ⚠️ IMPORTANT — aucune policy RLS n'accorde de privilège à `is_admin`.
-- C'est délibéré : l'administration passe exclusivement par le service_role
-- côté serveur, après vérification explicite du drapeau. Si on donnait des
-- droits élargis via RLS, une faille dans le navigateur suffirait à les
-- exploiter. Ici, un utilisateur qui parviendrait à passer `is_admin` à true
-- ne gagnerait rien : la lecture reste filtrée par les policies existantes.
