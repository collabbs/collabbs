-- D'où viennent les gens : le canal d'origine.
--
-- ─── Pourquoi, et pourquoi maintenant ───
-- Le plan de sortie du 05/11 fixe un test de huit semaines avec trois canaux
-- sans démarchage : les créateurs qui amènent leurs marques, un compte
-- TikTok/Instagram, et le référencement. Le verdict se lit sur une seule
-- ligne — « combien de collaborations payées par des marques non
-- démarchées » — mais la décision qui suit dépend d'autre chose : SAVOIR
-- LEQUEL DES TROIS A PAYÉ. Sans cette colonne, huit semaines produiraient un
-- chiffre sans explication, et on prolongerait ou on arrêterait à l'aveugle.
--
-- ─── Deux endroits, parce que ce sont deux questions ───
-- Sur `tunnel_evenements` : quel canal amène des gens jusqu'au brief. Mesure
-- de haut d'entonnoir, rattachée au jeton anonyme qui existe déjà.
--
-- Sur `profiles` : quel canal amène des gens qui PAIENT. C'est celle qui
-- décide, parce qu'un canal peut remplir le questionnaire sans jamais sortir
-- une carte. Écrite une seule fois, à l'inscription, et jamais mise à jour :
-- une origine qui change n'est plus une origine.
--
-- ─── Ce que ça n'est pas ───
-- Ce n'est pas du pistage. On garde une ÉTIQUETTE DE CANAL — « tiktok »,
-- « createurs », « seo » — pas un identifiant publicitaire, pas un référent
-- complet, pas une page d'atterrissage. La règle de `lib/tunnel.ts` tient :
-- de quoi compter des passages, pas de quoi reconnaître quelqu'un. Et la
-- valeur est bornée côté application à une petite liste de canaux connus,
-- donc une URL bricolée ne peut pas y écrire n'importe quoi.

alter table public.tunnel_evenements
  add column if not exists origine text;

comment on column public.tunnel_evenements.origine is
  'Canal d''arrivée de la session, étiquette bornée (voir lib/origine.ts). Null si arrivée directe.';

alter table public.profiles
  add column if not exists origine text;

comment on column public.profiles.origine is
  'Canal d''arrivée du compte, écrit une seule fois à l''inscription. Null si arrivée directe ou avant le 11/11/2026.';

-- Les deux lectures du tableau hebdomadaire : les passages par canal, et les
-- comptes par canal. L'index partiel évite de peser sur les lignes sans
-- origine, qui sont la majorité aujourd'hui.
create index if not exists tunnel_par_origine
  on public.tunnel_evenements (origine, created_at desc)
  where origine is not null;

create index if not exists profils_par_origine
  on public.profiles (origine)
  where origine is not null;
