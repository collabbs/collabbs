-- ═══════════════════════════════════════════════════════════════════════════
-- Shopify annonce ses ventes par webhook, plus par pixel
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi on abandonne le pixel ───
-- Éprouvé sur une vraie boutique Shopify (19/09) : le pixel personnalisé
-- n'atteint JAMAIS notre serveur — pas même sur une simple visite de page. Il
-- tourne dans un bac à sable que Shopify referme progressivement.
--
-- Et même en le faisant fonctionner, c'était un mauvais pari pour de l'argent
-- dû à quelqu'un :
--   · il est soumis au consentement du visiteur — sur une boutique française
--     avec bandeau cookies, un refus fait disparaître la vente, et le créateur
--     n'est pas payé sans que personne sache pourquoi ;
--   · c'est du code navigateur : bloqueurs, onglet fermé trop vite, extensions.
--
-- Le webhook est serveur à serveur. Rien de tout ça ne s'applique.
--
-- ─── Ce que la marque colle, et où ───
-- Dans Shopify : Réglages → Notifications → Webhooks → « commande payée »,
-- avec notre URL. Shopify affiche alors une clé de signature. La marque la
-- recopie dans Collabbs. Aucune application à installer, aucun développeur.
--
-- ─── Pourquoi DEUX colonnes et pas une ───
-- Le domaine sert à reconnaître QUI nous écrit — Shopify l'envoie dans
-- l'en-tête de chaque appel. La clé sert à vérifier que c'est bien lui.
-- Confondre les deux reviendrait à faire confiance à l'expéditeur déclaré.

alter table public.brands
  add column if not exists shopify_domain text,
  add column if not exists shopify_webhook_secret text;

comment on column public.brands.shopify_domain is
  'Domaine myshopify de la boutique (ex. ma-marque.myshopify.com). Identifie l''expéditeur d''un webhook.';
comment on column public.brands.shopify_webhook_secret is
  'Clé de signature affichée par Shopify à la création du webhook. Vérifie que l''appel vient bien de lui.';

-- Un domaine n'appartient qu'à une marque : sans ça, deux comptes pourraient
-- revendiquer la même boutique, et le premier trouvé encaisserait les ventes
-- de l'autre.
create unique index if not exists brands_shopify_domain_unique
  on public.brands (shopify_domain) where shopify_domain is not null;

-- ⚠️ Volontairement ABSENTES de la liste des colonnes lisibles depuis le
-- navigateur (0068). La clé de signature autorise à déclarer une vente, donc à
-- faire payer une marque : elle ne sort que par le client de service, pour la
-- marque elle-même, exactement comme `postback_secret`.
