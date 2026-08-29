-- Vérification d'audience
--
-- Problème : `creators.verified` était un simple booléen posé à la main, et il
-- valait `true` sur les 24 créateurs de démonstration. Le badge « Vérifié »
-- s'affichait donc sur des chiffres d'abonnés que personne n'avait vérifiés.
--
-- Or c'est exactement l'inverse de ce que le marché demande : 81 % des
-- annonceurs ont subi une fraude à l'influence en 2026, l'écart médian entre
-- l'audience promise et l'audience mesurée est de 37 %, et 54 % des marques
-- exigent désormais un audit tiers (contre 19 % en 2024).
--
-- On distingue donc deux choses qui n'ont rien à voir :
--   - le chiffre DÉCLARÉ par le créateur (`subscribers`) ;
--   - le chiffre VÉRIFIÉ auprès de la plateforme (`verified_subscribers`),
--     avec sa date et sa provenance.
--
-- Un compte n'est « vérifié » que si l'on a effectivement interrogé l'API de la
-- plateforme. Rien d'autre ne compte.

alter table public.creator_platforms
  -- Chiffre réellement constaté auprès de la plateforme.
  add column if not exists verified_subscribers integer,
  add column if not exists verified_at          timestamptz,
  -- 'youtube_api' pour l'instant. 'tiktok_oauth' / 'instagram_oauth' viendront
  -- quand les validations Meta et ByteDance seront obtenues (plusieurs semaines).
  add column if not exists verified_source      text,
  -- Identifiant du compte chez la plateforme (channelId YouTube, etc.), pour
  -- pouvoir revérifier plus tard sans redemander l'URL.
  add column if not exists platform_ref         text;

create index if not exists idx_creator_platforms_verified
  on public.creator_platforms (creator_id) where verified_at is not null;

-- ============================================================
-- Assainissement : les badges qui mentent
-- ============================================================
-- Les créateurs de démonstration affichaient tous « Vérifié » sans qu'aucune
-- audience n'ait jamais été contrôlée. On remet le drapeau à false : à partir
-- de maintenant, il ne se lève que sur une vérification réelle.
update public.creators
   set verified = false
 where is_demo = true and verified = true;

-- ============================================================
-- Commentaires de colonnes — pour que le prochain qui lit le schéma comprenne
-- ============================================================
comment on column public.creator_platforms.subscribers is
  'Nombre d''abonnés DÉCLARÉ par le créateur. Ne jamais présenter comme vérifié.';
comment on column public.creator_platforms.verified_subscribers is
  'Nombre d''abonnés CONSTATÉ auprès de l''API de la plateforme, à la date verified_at.';
comment on column public.creators.verified is
  'Vérification d''identité par l''équipe Collabbs. Distinct de la vérification d''audience, qui vit sur creator_platforms.';
