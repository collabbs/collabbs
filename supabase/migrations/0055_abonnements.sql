-- ============================================================
-- Collabbs · 0055 — l'abonnement de la marque
-- ------------------------------------------------------------
-- L'abonnement n'ouvre pas de portes, il ACHÈTE UN TAUX. C'est ce que font
-- Collabstr (10 % → 5 %) et Insense (20 % → 7 %), et c'est ce qui le rend
-- calculable par la marque : « ce mois-ci, tu aurais économisé 252 € ».
-- Un plan gratuit amputé ferait fuir au moment exact où la marque découvre le
-- produit ; ici le gratuit est complet, il est seulement plus cher à l'usage.
--
-- La grille vit dans `src/lib/tarifs.ts` — pas en base. Une remise
-- commerciale ponctuelle ne doit pas créer une deuxième source de vérité sur
-- les prix.
-- ============================================================

do $$ begin
  create type public.brand_plan as enum ('free', 'growth', 'scale');
exception when duplicate_object then null;
end $$;

alter table public.brands
  add column if not exists plan public.brand_plan not null default 'free',
  -- Abonnement Stripe : pour retrouver la marque au webhook, et pour ouvrir
  -- le portail de gestion (changer de carte, résilier) sans écrire ces écrans.
  add column if not exists stripe_subscription_id text,
  -- Jusqu'à quand le plan est payé. Une résiliation ne rétrograde pas
  -- immédiatement : la marque garde son taux jusqu'au terme déjà réglé.
  add column if not exists plan_expires_at timestamptz;

comment on column public.brands.plan is
  'Plan d''abonnement. Décide du taux de commission appliqué (voir lib/tarifs).';

-- Le taux se lit à chaque calcul de commission : cet index sert les écrans
-- d''administration qui comptent les abonnés par plan.
create index if not exists brands_plan_idx on public.brands (plan)
  where plan <> 'free';

-- ------------------------------------------------------------
-- Rétrogradation à l'échéance.
--
-- Sans ça, une marque qui résilie garderait son taux préférentiel pour
-- toujours : le webhook Stripe peut manquer, et rien d'autre ne repasserait
-- la ligne en « free ». Cette fonction est appelée par le cron quotidien.
-- ------------------------------------------------------------
create or replace function public.expire_brand_plans()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nb integer;
begin
  update public.brands
     set plan = 'free',
         stripe_subscription_id = null,
         plan_expires_at = null
   where plan <> 'free'
     and plan_expires_at is not null
     and plan_expires_at < now();
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

revoke execute on function public.expire_brand_plans() from public, anon, authenticated;
