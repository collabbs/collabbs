-- ============================================================
-- Collabbs · 0053 — marquer les marques de démonstration
-- ------------------------------------------------------------
-- Les créateurs de démonstration portent `creators.is_demo` depuis la
-- migration 0018, et le produit les cache en production. Les MARQUES n'avaient
-- pas d'équivalent : un vrai créateur voyait donc encore des campagnes signées
-- « Sephora » ou « NordVPN », et pouvait y candidater. Une candidature envoyée
-- à une marque qui n'existe pas, c'est une réponse qui ne viendra jamais.
--
-- On les identifie par l'adresse de leur compte — `demo-anker@collabbs.demo`,
-- `demo+…@collabbs.dev` — plutôt que par leur nom : un jour, une vraie marque
-- pourrait s'appeler Anker.
-- ============================================================

alter table public.brands
  add column if not exists is_demo boolean not null default false;

update public.brands b
   set is_demo = true
  from auth.users u
 where u.id = b.id
   and (u.email ilike '%@collabbs.demo' or u.email ilike 'demo+%@collabbs.dev');

-- Filtre courant : « les campagnes des marques réelles ».
create index if not exists brands_is_demo_idx on public.brands (is_demo);
