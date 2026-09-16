-- ═══════════════════════════════════════════════════════════════════════════
-- Qui a le droit d'écrire quoi sur une collaboration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le trou ───
-- `deals_update_parties` dit : « tu es la marque ou le créateur de cette
-- ligne ». C'est tout. Passé ce test, TOUTES les colonnes étaient écrivables
-- depuis le navigateur, y compris celles qui décident du versement.
--
-- Deux requêtes suffisaient à un créateur pour se payer sans rien livrer :
--
--   PATCH /deliverables?deal_id=eq.X  {done:true, approved:true,
--                                      submitted_at:"il y a 10 jours"}
--   PATCH /deals?id=eq.X              {brand_validation_deadline_days: 0}
--
-- Le cron `escrow-sla` faisait ensuite exactement son travail : tout est
-- livré, le délai de validation est écoulé, il clôt et verse le séquestre.
-- Sans validation de la marque, et sans contenu.
--
-- La cause est la même qu'en 0068 : `grant insert, update, delete on all
-- tables to authenticated` (migrations 0002 à 0006). 0068 a refermé les
-- profils, les marques, les créateurs et les messages — et a oublié les
-- collaborations, c'est-à-dire la table par où passe l'argent.
--
-- ─── Pourquoi un déclencheur et pas des droits par colonne ───
-- 0068 avait retiré `update` puis re-donné colonne par colonne. Ici ça ne
-- marche pas : `amount` et `brand_validated_at` sont légitimes pour la
-- marque et interdites au créateur, et les droits Postgres ne distinguent
-- pas deux utilisateurs de la même table.
--
-- Le déclencheur, lui, sait QUI écrit. Il ne remplace pas les vérifications
-- des actions serveur : il les double, en base, là où aucune action mal
-- écrite ne pourra jamais passer à côté.
--
-- ─── Ce qui n'est pas arbitré ───
-- Les écritures de service (crons, webhooks Stripe, actions d'administration)
-- passent par la clé secrète, donc par le rôle `service_role`. Elles ne sont
-- pas concernées : c'est notre propre code, déjà autorisé ailleurs, et c'est
-- lui qui doit pouvoir clôturer une collaboration au nom des deux parties.

-- ─────────────────────────────────────────────────────────── deals ─────

create or replace function public.deals_ecriture_permise()
returns trigger
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Seules les écritures d'un navigateur connecté sont arbitrées.
  if current_user <> 'authenticated' or v_uid is null then
    return new;
  end if;

  -- Colonnes que PERSONNE ne modifie depuis le navigateur. Les parties d'une
  -- collaboration, sa campagne d'origine, son tarif aux vues et surtout le
  -- délai de validation : `brand_validation_deadline_days` est la pièce qui
  -- déclenchait le versement automatique.
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
    -- Le créateur : son adresse, sa réception, ses vues déclarées, et
    -- l'acceptation. Rien qui touche à l'argent ni à la validation.
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

    -- Accepter ou refuser. Se clôturer soi-même se solderait par un versement.
    if new.status is distinct from old.status
       and new.status not in ('active', 'cancelled') then
      raise exception 'Un créateur ne peut qu''accepter ou refuser une collaboration.';
    end if;

  elsif v_uid = old.brand_id then
    -- La marque : les termes, l'expédition, la validation. Elle ne parle ni à
    -- la place du créateur (adresse, réception, vues) ni de son acceptation.
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

  else
    -- Inatteignable : la politique RLS a déjà écarté les tiers. On le dit
    -- quand même, parce qu'une politique peut être réécrite un jour.
    raise exception 'deals : écriture par un tiers.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deals_ecriture_permise on public.deals;
-- `updated_at` n'est comparé nulle part ci-dessus : l'horodatage automatique
-- posé par `trg_deals_updated` traverse donc cet arbitrage sans le déclencher,
-- quel que soit l'ordre dans lequel les deux déclencheurs s'exécutent.
create trigger trg_deals_ecriture_permise
  before update on public.deals
  for each row execute function public.deals_ecriture_permise();

-- ──────────────────────────────────────────────────── deliverables ─────

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
    -- Valider son propre travail ouvrirait le versement automatique : c'est
    -- exactement ce qu'on referme ici.
    if new.approved is distinct from old.approved then
      raise exception 'Un créateur ne peut pas valider son propre livrable.';
    end if;

    -- Re-livrer solde la retouche en cours, et c'est voulu : le créateur a
    -- répondu à la demande. L'inverse, en revanche, n'a pas de sens — on ne se
    -- demande pas une retouche à soi-même, et le message appartient à la
    -- marque qui l'a écrit.
    if new.revision_requested and not old.revision_requested then
      raise exception 'Un créateur ne peut pas demander une retouche.';
    end if;
    if new.revision_message is distinct from old.revision_message
       and new.revision_message is not null then
      raise exception 'Le message de retouche appartient à la marque.';
    end if;

  elsif v_uid = v_brand then
    -- La marque valide ou demande une retouche. Elle ne dépose pas à la place
    -- du créateur, et surtout elle n'antidate pas une livraison : le délai de
    -- validation automatique se compte depuis `submitted_at`.
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

drop trigger if exists trg_livrables_ecriture_permise on public.deliverables;
create trigger trg_livrables_ecriture_permise
  before update on public.deliverables
  for each row execute function public.livrables_ecriture_permise();

-- ──────────────────────────────────────────────────────── suppression ──
-- `delete` était donné lui aussi. Supprimer une collaboration ou un livrable
-- efface la trace de ce qui a été convenu, et la trace est ce qui tranche un
-- litige. Seul le service en a besoin (une proposition abandonnée à la
-- création est effacée par le code, qui passe par la clé secrète).
revoke delete on public.deals, public.deliverables from authenticated;
