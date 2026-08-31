-- ============================================================
-- Collabbs · 0056 — la rémunération aux vues
-- ------------------------------------------------------------
-- Une campagne « aux vues » annonce un tarif (« 12 € / 1000 vues ») depuis le
-- premier jour. Ce tarif n'était utilisé NULLE PART : la candidature créait
-- une collaboration à 0 €, la marque tapait un montant à la main, et on
-- retombait sur un forfait ordinaire. Le format était affiché et impayable.
--
-- Le mécanisme tient en une phrase : LE PLAFOND EST LE SÉQUESTRE.
--
--   · `amount` (déjà là) porte le PLAFOND. La marque le paie d'avance,
--     commission comprise, exactement comme un forfait — d'où le fait qu'on
--     ne crée aucun second chemin d'argent : contrat, séquestre, seuil légal
--     et versement continuent de passer par où ils passaient.
--   · `perf_rate` est le tarif RECOPIÉ de la campagne au moment où la
--     collaboration naît. Recopié, et pas lu à la volée : si la marque révise
--     sa campagne le mois suivant, un contrat déjà signé ne doit pas changer
--     de prix dans le dos des deux parties.
--   · Le créateur déclare ses vues, la marque valide, et le versement vaut
--     `min(vues / 1000 × tarif, plafond)`. Le reliquat retourne à la marque.
--
-- ⚠️ Les vues sont DÉCLARÉES par le créateur. La vérification automatique
-- demande les comptes développeurs TikTok/Instagram, qu'on n'a pas. Ce qui
-- tient le risque en attendant : la preuve exigée, la validation par la
-- marque, et le plafond qui borne l'exposition.
-- ============================================================

alter table public.deals
  -- Euros pour 1 000 vues. `numeric` et pas `integer` : un tarif à 1,50 € /
  -- 1000 vues est parfaitement courant chez les micro-créateurs, et l'arrondir
  -- à 2 € gonflerait la facture de 33 %.
  add column if not exists perf_rate numeric(10, 2),
  add column if not exists perf_views integer,
  add column if not exists perf_proof_url text,
  add column if not exists perf_declared_at timestamptz,
  add column if not exists perf_validated_at timestamptz;

comment on column public.deals.perf_rate is
  'Euros pour 1000 vues, figé depuis la campagne à la création. NULL = collaboration au forfait.';
comment on column public.deals.perf_views is
  'Vues déclarées par le créateur. Non vérifiées automatiquement : la marque valide.';
comment on column public.deals.perf_proof_url is
  'Lien du contenu publié, fourni avec la déclaration de vues.';
comment on column public.deals.perf_declared_at is
  'Horodatage de la déclaration du créateur.';
comment on column public.deals.perf_validated_at is
  'Horodatage de la validation par la marque. Tant que c''est NULL, aucun versement.';

-- Un nombre de vues négatif n'existe pas, et un tarif négatif paierait le
-- créateur à l'envers. On ne plafonne pas les vues : une vidéo virale à
-- 40 millions de vues est un succès, pas une anomalie — c'est le plafond du
-- séquestre qui borne la dépense, pas une limite arbitraire ici.
do $$ begin
  alter table public.deals add constraint deals_perf_views_positives
    check (perf_views is null or perf_views >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.deals add constraint deals_perf_rate_positif
    check (perf_rate is null or perf_rate > 0);
exception when duplicate_object then null;
end $$;

-- On ne valide pas ce qui n'a pas été déclaré. Sans cette contrainte, une
-- validation posée seule ouvrirait un versement calculé sur `perf_views` à
-- NULL — c'est-à-dire zéro — sur un séquestre bien réel.
do $$ begin
  alter table public.deals add constraint deals_perf_validation_apres_declaration
    check (perf_validated_at is null or perf_declared_at is not null);
exception when duplicate_object then null;
end $$;
