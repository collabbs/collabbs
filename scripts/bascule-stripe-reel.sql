-- Bascule test → réel : effacer tous les identifiants Stripe de test
--
-- À EXÉCUTER UNE SEULE FOIS, au moment de passer la clé `sk_live_`.
--
-- Pourquoi
-- --------
-- Un objet Stripe créé en mode test (client, moyen de paiement, abonnement,
-- compte connecté) n'existe PAS en mode réel. Tant que son identifiant reste
-- en base, le code le réutilise, Stripe répond « No such … », et l'opération
-- échoue derrière un message générique. C'est ce qui s'est produit le
-- 07/10/2026 sur la page Provision : « Le paiement n'a pas pu être ouvert. »
--
-- Le piège : un identifiant de test et un identifiant réel ont EXACTEMENT le
-- même format. Aucun préfixe ne les distingue. On ne peut donc pas trier ; la
-- seule règle sûre est « tout ce qui existe avant la bascule vient du mode
-- test ». C'est vrai ici parce qu'aucune inscription réelle n'a encore eu
-- lieu. Cette garantie disparaît au premier client réel : passé ce point,
-- NE PLUS JAMAIS exécuter ce script.
--
-- Ce qui est remis à zéro, et pourquoi
-- ------------------------------------
--  brands.stripe_customer_id      → recréé au prochain paiement
--  brands.payment_method_id       → la carte sera ressaisie une fois
--  brands.stripe_subscription_id  → l'abonnement de test n'existe plus
--  brands.plan / plan_expires_at  → CONSÉQUENCE DU PRÉCÉDENT : un plan payant
--      adossé à un abonnement mort ne sera jamais résilié par le webhook. La
--      marque garderait un taux de commission préférentiel que personne ne
--      paie. On la remet donc au plan gratuit ; elle se réabonnera.
--  creators.stripe_account_id     → le créateur refait son inscription Stripe
--      en mode réel, avec sa véritable identité et son véritable IBAN.
--
-- Attention : une marque à qui un plan payant aurait été accordé à la main,
-- sans abonnement Stripe, retomberait aussi en gratuit. Vérifier avant si
-- c'est le cas de l'une d'elles.
--
-- Les deux tables sont traitées en UNE SEULE mise à jour chacune. C'est
-- délibéré : deux `update` sur la même table dans la même requête, PostgreSQL
-- n'en applique qu'un sur les lignes communes — et sans le moindre
-- avertissement.
--
-- La requête renvoie toutes les lignes qu'elle a modifiées. Zéro ligne = il
-- n'y avait rien à nettoyer. Rien n'est écrit en silence.

with marques as (
  update public.brands
     set stripe_customer_id     = null,
         payment_method_id      = null,
         stripe_subscription_id = null,
         plan                   = 'free',
         plan_expires_at        = null,
         updated_at             = now()
   where stripe_customer_id     is not null
      or payment_method_id      is not null
      or stripe_subscription_id is not null
  returning id, name as nom, 'marque' as genre
),
createurs as (
  update public.creators
     set stripe_account_id = null,
         updated_at        = now()
   where stripe_account_id is not null
  returning id, handle as nom, 'créateur' as genre
)
select genre, nom, id from marques
union all
select genre, nom, id from createurs;
