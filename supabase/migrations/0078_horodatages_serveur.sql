-- ═══════════════════════════════════════════════════════════════════════════
-- Les dates qui font courir un délai n'appartiennent pas au navigateur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 0077 a fermé la porte principale : un créateur ne peut plus valider son
-- propre livrable ni raccourcir le délai de validation. Le test l'a confirmé
-- en direct — les deux tentatives repoussées par la base.
--
-- Mais la même attaque restait jouable par une AUTRE porte, et le test l'a
-- trouvée : `submitted_at` passait encore.
--
--   PATCH /deliverables  {submitted_at: "il y a 10 jours", done: true}   → 200
--
-- Le créateur a le droit de déposer, donc d'écrire cette colonne — et 0077 la
-- lui laissait, légitimement. Sauf que ce n'est pas une donnée de dépôt : c'est
-- le CHRONOMÈTRE du versement automatique. `escrow-sla` compte le délai de
-- validation depuis la dernière livraison ; l'antidater de dix jours fait
-- expirer le délai avant même que la marque ait vu le contenu.
--
-- La leçon est plus générale que ce cas, et c'est pour ça qu'elle a sa propre
-- migration : **une date qui déclenche quelque chose se pose côté serveur.**
-- Interdire la colonne casserait le dépôt ; on la RÉÉCRIT donc. Le code
-- légitime envoie déjà `now()` et ne voit aucune différence ; une date
-- fabriquée est remplacée avant d'être enregistrée.

create or replace function public.livrables_ecriture_permise()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_brand uuid;
  v_creator uuid;
begin
  if current_user <> 'authenticated' or v_uid is null then
    return new;
  end if;

  select d.brand_id, d.creator_id into v_brand, v_creator
  from public.deals d where d.id = old.deal_id;

  if new.deal_id is distinct from old.deal_id
  or new.id      is distinct from old.id
  or new.label   is distinct from old.label
  or new.position is distinct from old.position
  then
    raise exception 'livrables : cette colonne ne se modifie pas depuis le navigateur';
  end if;

  if v_uid = v_creator then
    if new.approved is distinct from old.approved then
      raise exception 'Un créateur ne peut pas valider son propre livrable.';
    end if;

    if new.revision_requested and not old.revision_requested then
      raise exception 'Un créateur ne peut pas demander une retouche.';
    end if;
    if new.revision_message is distinct from old.revision_message
       and new.revision_message is not null then
      raise exception 'Le message de retouche appartient à la marque.';
    end if;

    -- ⚠️ LA CORRECTION DE CETTE MIGRATION.
    -- On ne refuse pas : déposer DOIT poser cette date. On la remplace par
    -- l'heure du serveur. Retirer un dépôt (`null`) reste possible — c'est ce
    -- que fait le retrait du dernier fichier.
    if new.submitted_at is not null
       and new.submitted_at is distinct from old.submitted_at then
      new.submitted_at := now();
    end if;

  elsif v_uid = v_brand then
    if new.submission_url   is distinct from old.submission_url
    or new.submission_files is distinct from old.submission_files
    or new.submission_notes is distinct from old.submission_notes
    or new.submitted_at     is distinct from old.submitted_at
    then
      raise exception 'Une marque ne peut pas déposer à la place du créateur.';
    end if;

  else
    raise exception 'livrables : écriture par un tiers.';
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────── le même raisonnement ──
-- `escrow_due_at` est l'autre chronomètre écrit depuis le navigateur : le
-- créateur le pose en acceptant (7 jours pour que la marque règle le
-- séquestre), et `escrow-sla` annule la collaboration une fois la date passée.
-- Le poser dans le passé annulerait la collaboration d'une marque qui n'a rien
-- fait de mal. Ce n'est pas du vol, c'est du sabotage — ça mérite la même
-- fermeture.
--
-- `accepted_at` est réécrit pour la même raison : c'est la date qui fait foi
-- sur « depuis quand » une collaboration court.

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
  or new.format                         is distinct from old.format
  or new.platform_id                    is distinct from old.platform_id
  or new.perf_rate                      is distinct from old.perf_rate
  or new.brand_validation_deadline_days is distinct from old.brand_validation_deadline_days
  or new.revision_rounds_max            is distinct from old.revision_rounds_max
  or new.engagement_id                  is distinct from old.engagement_id
  or new.engagement_month               is distinct from old.engagement_month
  then
    raise exception 'deals : cette colonne ne se modifie pas depuis le navigateur';
  end if;

  if v_uid = old.creator_id then
    if new.amount             is distinct from old.amount
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

    -- Les deux chronomètres de l'acceptation, posés par le serveur.
    if new.accepted_at is not null and new.accepted_at is distinct from old.accepted_at then
      new.accepted_at := now();
    end if;
    if new.escrow_due_at is not null
       and new.escrow_due_at is distinct from old.escrow_due_at
       and new.escrow_due_at <= now() then
      raise exception 'Le délai de règlement du séquestre ne peut pas être déjà écoulé.';
    end if;

    -- La déclaration de vues est datée par le serveur : c'est elle qui ouvre
    -- le droit au paiement à la performance.
    if new.perf_declared_at is not null
       and new.perf_declared_at is distinct from old.perf_declared_at then
      new.perf_declared_at := now();
    end if;

    -- La réception du colis fait partir le délai de production : même règle,
    -- même raison. Elle se constate, elle ne se choisit pas.
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

    -- La date de validation ouvre le versement : elle non plus ne se choisit
    -- pas depuis un navigateur.
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
