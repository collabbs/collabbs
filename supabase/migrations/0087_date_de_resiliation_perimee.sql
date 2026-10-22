-- ═══════════════════════════════════════════════════════════════════════════
-- La date de résiliation qui survit à la résiliation
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Constaté le 22/10/2026, sur la page Provision ───
-- La marque « Collabbs » lisait, huit jours après coup :
--
--     « Ton abonnement s'arrête le 14 octobre 2026. D'ici là rien ne change :
--       tu gardes ton taux, tes campagnes et tes collaborations continuent. »
--
-- Les deux affirmations étaient fausses. La date était passée, et la marque
-- était déjà retombée au plan Gratuit : son taux avait bougé. Un écran qui
-- promet un tarif qu'on n'a plus, sur la page qui parle d'argent.
--
-- ─── La cause ───
-- Trois colonnes portent l'abonnement : `plan`, `plan_expires_at` et
-- `plan_cancel_at` (la fin programmée quand la marque clique « Arrêter »).
--
-- `cloturerAbonnement()` remet bien les TROIS à zéro — mais c'est le webhook
-- `customer.subscription.deleted`, et il n'arrive jamais pour un abonnement
-- qui n'existe pas en mode réel (cas de la bascule du 07/10).
--
-- Le filet censé rattraper ça, `expire_brand_plans()`, n'en remettait que
-- DEUX : il oubliait `plan_cancel_at`. Or sa raison d'être est justement, dit
-- son commentaire, « que les écrans disent la même chose que le calcul ».
-- Il laissait derrière lui exactement ce qui fait mentir l'écran.
--
-- ─── Ce que cette migration fait ───
--  1. Le filet remet les trois colonnes, plus seulement deux.
--  2. Elle nettoie les lignes déjà abîmées. Nécessaire : le filet ne filtre
--     que `plan <> 'free'`, donc il ne repassera JAMAIS sur une marque déjà
--     retombée au gratuit — sa date périmée y resterait pour toujours.
--
-- Une marque au plan gratuit n'a aucun abonnement à arrêter : une date de
-- résiliation y est dénuée de sens, quelle qu'en soit l'origine.
--
-- Le garde-fou côté affichage est posé séparément, dans `PlansAbonnement` :
-- une date passée n'affiche plus rien. Les deux sont voulus. Se reposer sur
-- le seul nettoyage, c'est refaire reposer la vérité de l'écran sur un
-- traitement qui doit penser à passer.
-- ═══════════════════════════════════════════════════════════════════════════

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
         plan_expires_at = null,
         -- La ligne qui manquait.
         plan_cancel_at = null
   where plan <> 'free'
     and plan_expires_at is not null
     and plan_expires_at < now();
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

-- Rattrapage des lignes que le filet ne reprendra plus.
update public.brands
   set plan_cancel_at = null
 where plan_cancel_at is not null
   and plan = 'free';
