-- ═══════════════════════════════════════════════════════════════════════════
-- Le format se négocie, tant que rien n'est signé
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 0077 range `format` parmi les colonnes que personne ne modifie depuis le
-- navigateur. C'était juste au moment où je l'ai écrit — rien ne le modifiait —
-- mais c'était figer un défaut plutôt qu'une règle : toute proposition directe
-- naissait « vidéo postée », et aucun écran ne permettait d'en changer. Une
-- marque qui commandait trois stories signait un contrat annonçant une vidéo.
--
-- Le format devient donc modifiable, avec deux bornes :
--   · par la MARQUE seule — c'est elle qui commande ;
--   · tant que la collaboration est EN NÉGOCIATION. Après l'acceptation, le
--     contrat est signé et son objet ne se réécrit plus d'un clic : il en
--     faudrait un avenant, c'est-à-dire l'accord des deux parties.

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
  or new.perf_rate                      is distinct from old.perf_rate
  or new.brand_validation_deadline_days is distinct from old.brand_validation_deadline_days
  or new.revision_rounds_max            is distinct from old.revision_rounds_max
  or new.engagement_id                  is distinct from old.engagement_id
  or new.engagement_month               is distinct from old.engagement_month
  then
    raise exception 'deals : cette colonne ne se modifie pas depuis le navigateur';
  end if;

  -- L'objet du contrat ne change plus une fois qu'il est signé.
  if new.format is distinct from old.format and old.status <> 'negotiation' then
    raise exception 'Le format ne se change plus après l''acceptation : il faudrait l''accord des deux parties.';
  end if;

  if v_uid = old.creator_id then
    if new.format            is distinct from old.format
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
