-- ============================================================
-- Collabbs · 0057 — l'envoi du produit
-- ------------------------------------------------------------
-- `deals` porte depuis longtemps `shipping_address`, `shipped_at`,
-- `shipping_carrier` et `tracking_number`. AUCUN écran ne les touche : quatre
-- colonnes mortes. Pendant ce temps une campagne peut parfaitement annoncer un
-- produit physique (`campaigns.product_kind = 'physical'`), et le créateur le
-- voit sur l'annonce — puis la collaboration s'ouvre et il n'y a plus rien.
--
-- Ce qui manque n'est pas cosmétique. Le créateur porte une échéance pour un
-- contenu qu'il ne peut pas tourner tant qu'il n'a rien reçu ; la marque n'a
-- aucune trace de ce qu'elle a envoyé ; et quand le colis se perd, rien ne
-- permet de dire qui attend quoi. Le gifting est pourtant la porte d'entrée la
-- plus courante des marques.
--
-- Deux colonnes suffisent à fermer la boucle :
--
--   · `shipping_required` — cette collaboration attend-elle un envoi ? Repris
--     de la campagne à la création, modifiable dans les termes (une marque
--     peut décider d'envoyer un produit sur une collaboration directe).
--   · `received_at` — le créateur confirme la réception. Sans ce point, un
--     colis « expédié » resterait éternellement en transit et le délai de
--     livraison n'aurait aucun point de départ honnête.
-- ============================================================

alter table public.deals
  add column if not exists shipping_required boolean not null default false,
  add column if not exists received_at timestamptz;

comment on column public.deals.shipping_required is
  'La marque doit envoyer un produit avant que le créateur puisse produire son contenu.';
comment on column public.deals.received_at is
  'Réception confirmée par le créateur. C''est de cette date que part réellement son délai.';

-- On ne reçoit pas ce qui n'a pas été envoyé. Sans cette contrainte, une
-- réception posée seule laisserait croire que la marque a expédié — et lui
-- ferait porter la responsabilité d'un envoi qu'elle n'a jamais déclaré.
do $$ begin
  alter table public.deals add constraint deals_reception_apres_expedition
    check (received_at is null or shipped_at is not null);
exception when duplicate_object then null;
end $$;

-- Un envoi déclaré sans transporteur ni numéro de suivi reste possible : toutes
-- les marques ne passent pas par un transporteur suivi (remise en main propre,
-- produit numérique envoyé par un autre canal). On n'invente pas une obligation
-- que le monde réel ne respecte pas.
