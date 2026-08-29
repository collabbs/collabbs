-- Localisation des créateurs
--
-- Manque produit : une marque cherche très souvent en local — un restaurant
-- lyonnais veut un créateur lyonnais, une boutique lilloise ne fera pas venir
-- quelqu'un de Marseille pour tourner en magasin. Collabbs n'avait aucune
-- notion de lieu.
--
-- Le piège évident serait de stocker une ville en texte libre : « Paris »,
-- « paris », « PARIS » et « Paris 11e » deviennent quatre villes distinctes et
-- le filtre ne fonctionne jamais. On stocke donc DEUX choses :
--
--   - `city`      : ce que le créateur a écrit, pour l'affichage ;
--   - `city_slug` : la forme normalisée (minuscules, sans accents, sans
--                   arrondissement), pour regrouper et filtrer.
--
-- Le slug est calculé côté serveur à chaque enregistrement, jamais saisi.

alter table public.creators
  add column if not exists city      text,
  add column if not exists city_slug text,
  add column if not exists country   text default 'FR',
  -- Le créateur accepte-t-il de se déplacer pour un tournage sur place ?
  -- Un tournage en boutique n'a de sens que si la réponse est oui.
  add column if not exists travels   boolean not null default false;

-- Le filtre par ville lit ce slug ; l'index le rend gratuit.
create index if not exists idx_creators_city_slug
  on public.creators (city_slug) where city_slug is not null;

comment on column public.creators.city is
  'Ville telle que saisie par le créateur. Pour l''affichage uniquement.';
comment on column public.creators.city_slug is
  'Forme normalisée de la ville, calculée côté serveur. Sert au regroupement et au filtrage.';
comment on column public.creators.travels is
  'Le créateur accepte de se déplacer hors de sa ville pour un tournage.';
