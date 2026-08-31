-- ============================================================
-- Collabbs · 0058 — les droits d'usage se facturent
-- ------------------------------------------------------------
-- La marque pouvait déjà fixer une durée de réutilisation, et le contrat
-- l'écrivait noir sur blanc. Personne ne la facturait. Une collaboration paie
-- la FABRICATION d'un contenu ; le droit de le repasser six mois en publicité
-- payante est autre chose, et vaut souvent davantage que la vidéo.
--
-- Deux colonnes, et une décision de modèle derrière chacune :
--
--   · `usage_rights_scope` — le PÉRIMÈTRE. Republier sur ses propres comptes
--     et pousser le contenu en publicité payante sont deux mondes : le second
--     met un budget média derrière le visage du créateur, souvent auprès
--     d'audiences qui ne le connaissent pas. Le contrat doit dire lequel des
--     deux a été cédé — sans quoi la clause se règle au tribunal.
--     Par défaut NULL : aucune cession. Jamais un défaut permissif.
--
--   · `usage_rights_fee` — la PART de `amount` qui paie ces droits. C'est bien
--     une part, pas un supplément à côté : `amount` reste le montant unique
--     que touche le créateur, donc le séquestre, la commission, le contrat et
--     le versement continuent de passer exactement où ils passaient. On ne
--     crée pas un second chemin d'argent pour un troisième format.
--     La colonne sert à AFFICHER la décomposition, et à l'écrire au contrat.
-- ============================================================

do $$ begin
  create type public.usage_rights_scope as enum ('organic', 'paid');
exception when duplicate_object then null;
end $$;

alter table public.deals
  add column if not exists usage_rights_scope public.usage_rights_scope,
  add column if not exists usage_rights_fee integer;

comment on column public.deals.usage_rights_scope is
  'Périmètre de réutilisation cédé : organic = supports propres, paid = publicité payante. NULL = aucune cession.';
comment on column public.deals.usage_rights_fee is
  'Part de `amount` qui rémunère les droits d''usage. Sert à la décomposition affichée et au contrat.';

-- Des droits négatifs retireraient de l'argent au créateur au motif qu'on lui
-- prend un droit.
do $$ begin
  alter table public.deals add constraint deals_droits_frais_positifs
    check (usage_rights_fee is null or usage_rights_fee >= 0);
exception when duplicate_object then null;
end $$;

-- La part des droits ne peut pas dépasser le montant total : elle en EST une
-- part. Sans cette borne, une saisie aberrante afficherait « contenu : −200 € ».
do $$ begin
  alter table public.deals add constraint deals_droits_frais_bornes
    check (usage_rights_fee is null or usage_rights_fee <= amount);
exception when duplicate_object then null;
end $$;
