-- ═══════════════════════════════════════════════════════════════════════════
-- Proposer de l'affiliation à UN créateur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- L'affiliation n'existait qu'en campagne : une marque qui voulait proposer
-- une commission à un créateur précis n'avait aucun chemin. Elle devait ouvrir
-- une campagne publique, espérer que le bon créateur la voie, et l'activer.
--
-- ─── Ce que l'affiliation exige, et que le deal n'a pas ───
-- Un lien tracké, une fenêtre d'attribution, un taux de commission, une URL de
-- destination. Tout cela vit dans une CAMPAGNE, et c'est elle que lit toute la
-- chaîne d'argent — le clic (`/r/[code]`), la vente (`/api/track`), le calcul,
-- la provision, le versement. Réécrire cette chaîne pour qu'elle sache lire un
-- deal serait dupliquer le circuit de l'argent. On ne duplique pas ça.
--
-- Une collaboration en affiliation crée donc une campagne — mais une campagne
-- PRIVÉE, avec un seul participant, qui n'apparaît dans aucune recherche et ne
-- compte pas dans le plafond du plan de la marque. Elle n'est pas une offre :
-- c'est le véhicule technique d'un accord déjà conclu.
--
-- ─── Pourquoi `campagne_affiliation` et pas `campaign_id` ───
-- `deals.campaign_id` veut dire « née d'une candidature sur une campagne », et
-- trois endroits s'en servent pour reconnaître une proposition directe. Le
-- réutiliser ferait passer ces collaborations pour ce qu'elles ne sont pas. La
-- campagne privée est un outil du deal, pas son origine.

alter table public.campaigns
  add column if not exists privee boolean not null default false;

comment on column public.campaigns.privee is
  'Campagne créée pour une seule collaboration directe. Invisible au catalogue, hors plafond de plan.';

alter table public.deals
  add column if not exists campagne_affiliation uuid references public.campaigns(id) on delete set null;

comment on column public.deals.campagne_affiliation is
  'Campagne privée qui porte le lien tracké et le taux de commission de cette collaboration.';

create index if not exists deals_campagne_affiliation_idx
  on public.deals (campagne_affiliation);

-- Le catalogue et le défilé lisent `status = active` : l'index les aide à
-- écarter les privées sans parcourir la table.
create index if not exists campaigns_publiques_idx
  on public.campaigns (status) where privee = false;

-- ── La marque écrit ce champ pendant la négociation ────────────────────────
-- Même borne que le format et le modèle (0079, 0080) : la marque seule, et
-- tant que rien n'est signé. Après, le lien tracké existe et le créateur
-- diffuse : changer de campagne en cours de route ferait disparaître ses
-- ventes.

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

  if (new.format               is distinct from old.format
   or new.modele_remuneration  is distinct from old.modele_remuneration
   or new.perf_rate            is distinct from old.perf_rate
   or new.campagne_affiliation is distinct from old.campagne_affiliation)
   and old.status <> 'negotiation' then
    raise exception 'Les termes ne se changent plus après l''acceptation : il faudrait l''accord des deux parties.';
  end if;

  if v_uid = old.creator_id then
    if new.format             is distinct from old.format
    or new.modele_remuneration is distinct from old.modele_remuneration
    or new.perf_rate          is distinct from old.perf_rate
    or new.campagne_affiliation is distinct from old.campagne_affiliation
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
