-- ═══════════════════════════════════════════════════════════════════════════
-- Résilier son abonnement depuis le produit
-- ═══════════════════════════════════════════════════════════════════════════
--
-- L'écran des plans proposait « Passer à Growth » et « Passer à Scale », et
-- rien pour redescendre. La seule mention de l'arrêt était une ligne en petits
-- caractères — « Résiliable à tout moment depuis Stripe » — sans lien, sans
-- bouton, sans adresse. Une marque abonnée devait écrire à quelqu'un.
--
-- Le code savait pourtant rétrograder (`cloturerAbonnement`) : il attendait un
-- évènement Stripe que rien, dans le produit, ne déclenchait jamais.
--
-- On résilie EN FIN DE PÉRIODE, pas sur-le-champ : le mois est déjà réglé, le
-- taux avantageux court jusqu'à son terme. Cette colonne retient cette date —
-- pour l'afficher sans avoir à interroger Stripe à chaque affichage de page,
-- et pour que l'écran reste juste même si Stripe est indisponible.
--
-- `null` = aucun arrêt programmé. C'est le cas de l'immense majorité des
-- lignes, abonnées ou non.

alter table public.brands
  add column if not exists plan_cancel_at timestamptz;

comment on column public.brands.plan_cancel_at is
  'Fin programmée de l''abonnement (résiliation demandée). null = pas d''arrêt prévu.';

-- Volontairement ABSENTE de la liste des colonnes lisibles depuis le
-- navigateur (0068) : comme le plan et la provision, cette date ne regarde que
-- la marque concernée, et l'écran la relit par le client de service.
