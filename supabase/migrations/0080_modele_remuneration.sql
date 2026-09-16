-- ═══════════════════════════════════════════════════════════════════════════
-- Comment le créateur est payé, sur une collaboration directe
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une campagne connaissait six modèles de rémunération — affiliation, fixe +
-- commission, performance, paliers… — et une proposition directe un seul : le
-- forfait. La même marque parlait donc deux langues selon la porte qu'elle
-- empruntait, sans que rien ne le lui explique.
--
-- ─── Pourquoi une colonne, et pas une déduction ───
-- On aurait pu deviner : `perf_rate` non nul = aux vues, montant nul = produit
-- offert. Sauf que `amount = 0` veut DÉJÀ dire « pas encore fixé » ailleurs
-- dans le produit — l'écran l'affiche en toutes lettres. Deviner mélangerait
-- une collaboration complète avec une collaboration inachevée, et afficherait
-- « montant à fixer » sur un produit offert qui ne coûte rien par nature.
--
-- ─── Pourquoi du texte et pas une énumération ───
-- Trois fois déjà, une contrainte CHECK énumérative a cassé une écriture en
-- silence dans ce produit : la ligne est refusée par la base, l'action
-- remonte une erreur technique, et l'écran affiche un échec incompréhensible.
-- La liste des modèles vit dans `lib/deal.ts`, avec un repli sur « forfait »
-- pour toute valeur inconnue — un modèle inconnu ne doit jamais valoir mieux
-- que le plus simple.

alter table public.deals
  add column if not exists modele_remuneration text not null default 'forfait';

comment on column public.deals.modele_remuneration is
  'forfait | performance | produit. Dit ce que signifie `amount` : un montant, un plafond, ou la valeur d''un produit offert.';

-- Les collaborations déjà aux vues portent leur modèle plutôt que de le faire
-- deviner : elles ont un tarif pour 1 000 vues, c'est sans ambiguïté.
update public.deals set modele_remuneration = 'performance'
where perf_rate is not null and modele_remuneration = 'forfait';

-- ── Le modèle et son tarif se négocient, comme le format (0079) ────────────
-- `perf_rate` figurait parmi les colonnes immuables : la marque ne pouvait
-- donc pas corriger un tarif aux vues qu'elle venait de saisir. Les deux
-- s'ouvrent, avec les mêmes bornes que le format : la marque seule, et tant
-- que rien n'est signé.

create or replace function public.deals_ecriture_permise()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
begin
  if current_user <> 'authenticated' or v_uid is null then
    return new;
  end if;

  if new.id                             is distinct from old.id
  or new.brand_id                       is distinct from old.brand_id
  or new.creator_id                     is distinct from old.creator_id
  or new.campaign_id                    is distinct from old.campaign_id
  or new.created_at                     is distinct from old.created_at
  or new.title                          is distinct from old.title
  or new.platform_id                    is distinct from old.platform_id
  or new.brand_validation_deadline_days is distinct from old.brand_validation_deadline_days
  or new.revision_rounds_max            is distinct from old.revision_rounds_max
  or new.engagement_id                  is distinct from old.engagement_id
  or new.engagement_month               is distinct from old.engagement_month
  then
    raise exception 'deals : cette colonne ne se modifie pas depuis le navigateur';
  end if;

  -- L'objet du contrat et son mode de paiement ne changent plus une fois signé.
  if (new.format               is distinct from old.format
   or new.modele_remuneration  is distinct from old.modele_remuneration
   or new.perf_rate            is distinct from old.perf_rate)
   and old.status <> 'negotiation' then
    raise exception 'Les termes ne se changent plus après l''acceptation : il faudrait l''accord des deux parties.';
  end if;

  if v_uid = old.creator_id then
    if new.format             is distinct from old.format
    or new.modele_remuneration is distinct from old.modele_remuneration
    or new.perf_rate          is distinct from old.perf_rate
    or new.amount             is distinct from old.amount
    or new.quantity           is distinct from old.quantity
    or new.deadline           is distinct from old.deadline
    or new.brand_notes        is distinct from old.brand_notes
    or new.usage_rights_months is distinct from old.usage_rights_months
    or new.usage_rights_scope is distinct from old.usage_rights_scope
    or new.usage_rights_fee   is distinct from old.usage_rights_fee
    or new.exclusivity        is distinct from old.exclusivity
    or new.exclusivity_days   is distinct from old.exclusivity_days
    or new.shipping_required  is distinct from old.shipping_required
    or new.revision_rounds_used is distinct from old.revision_rounds_used
    or new.brand_validated_at is distinct from old.brand_validated_at
    or new.perf_validated_at  is distinct from old.perf_validated_at
    or new.shipped_at         is distinct from old.shipped_at
    or new.shipping_carrier   is distinct from old.shipping_carrier
    or new.tracking_number    is distinct from old.tracking_number
    then
      raise exception 'Un créateur ne peut modifier ni les termes, ni la validation, ni l''expédition.';
    end if;

    if new.status is distinct from old.status
       and new.status not in ('active', 'cancelled') then
      raise exception 'Un créateur ne peut qu''accepter ou refuser une collaboration.';
    end if;

    if new.accepted_at is not null and new.accepted_at is distinct from old.accepted_at then
      new.accepted_at := now();
    end if;
    if new.escrow_due_at is not null
       and new.escrow_due_at is distinct from old.escrow_due_at
       and new.escrow_due_at <= now() then
      raise exception 'Le délai de règlement du séquestre ne peut pas être déjà écoulé.';
    end if;
    if new.perf_declared_at is not null
       and new.perf_declared_at is distinct from old.perf_declared_at then
      new.perf_declared_at := now();
    end if;
    if new.received_at is not null
       and new.received_at is distinct from old.received_at then
      new.received_at := now();
    end if;

  elsif v_uid = old.brand_id then
    if new.shipping_address is distinct from old.shipping_address
    or new.received_at      is distinct from old.received_at
    or new.perf_views       is distinct from old.perf_views
    or new.perf_proof_url   is distinct from old.perf_proof_url
    or new.perf_declared_at is distinct from old.perf_declared_at
    or new.accepted_at      is distinct from old.accepted_at
    or new.escrow_due_at    is distinct from old.escrow_due_at
    then
      raise exception 'Une marque ne peut pas écrire à la place du créateur.';
    end if;

    if new.status is distinct from old.status
       and new.status not in ('cancelled', 'completed') then
      raise exception 'Une marque ne peut que clôturer ou annuler une collaboration.';
    end if;

    if new.brand_validated_at is not null
       and new.brand_validated_at is distinct from old.brand_validated_at then
      new.brand_validated_at := now();
    end if;
    if new.shipped_at is not null and new.shipped_at is distinct from old.shipped_at then
      new.shipped_at := now();
    end if;

  else
    raise exception 'deals : écriture par un tiers.';
  end if;

  return new;
end;
$$;
