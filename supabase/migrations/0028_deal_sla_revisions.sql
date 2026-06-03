-- Sprint 5 — Parcours deal premium :
-- * SLAs explicites (paiement marque, validation marque)
-- * compteur de rounds de retouches (max + utilisés)
-- * jalons datés pour la timeline visuelle

alter table deals
  add column if not exists revision_rounds_max integer not null default 2;

alter table deals
  add column if not exists revision_rounds_used integer not null default 0;

alter table deals
  add column if not exists brand_validation_deadline_days integer not null default 5;

-- Jalons datés (servent pour calculer la timeline + les SLA + l'auto-release)
alter table deals
  add column if not exists accepted_at timestamptz;

alter table deals
  add column if not exists escrow_due_at timestamptz;

alter table deals
  add column if not exists brand_validated_at timestamptz;

-- Index utile pour les crons SLA (qui dépassent une deadline)
create index if not exists idx_deals_escrow_due
  on deals (escrow_due_at)
  where escrow_due_at is not null;

create index if not exists idx_deals_brand_validated
  on deals (brand_validated_at)
  where brand_validated_at is not null;
