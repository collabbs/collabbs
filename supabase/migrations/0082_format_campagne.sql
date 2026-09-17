-- ═══════════════════════════════════════════════════════════════════════════
-- Une campagne dit enfin quel contenu elle veut
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le miroir exact du défaut corrigé en proposition directe (0079). Une
-- campagne décrit son modèle de paiement — fixe, commission, aux vues, CPA —
-- et ne dit NULLE PART ce que le créateur doit produire. Story ? Reel ? Vidéo
-- postée ? UGC non publié ?
--
-- Conséquence : toute collaboration née d'une candidature était créée en
-- « vidéo postée », en dur dans le code. Une marque qui cherchait trois
-- stories signait un contrat annonçant une vidéo — et le créateur, aussi.
--
-- Le format est facultatif : une campagne d'affiliation pure n'impose souvent
-- rien, et `null` dit exactement ça. C'est la marque qui décide si elle
-- commande un format précis ou laisse faire.

alter table public.campaigns
  add column if not exists format text;

comment on column public.campaigns.format is
  'video_post | ugc | story | reel | live. null = aucun format imposé (le créateur publie ce qu''il veut).';
