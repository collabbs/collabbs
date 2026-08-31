-- ============================================================
-- Collabbs · 0060 — plus de cession de droits par défaut
-- ------------------------------------------------------------
-- `deals.usage_rights_months` portait `default 6` depuis la migration 0004.
-- Autrement dit : **toute collaboration jamais créée cédait six mois de droits
-- d'usage à l'annonceur, sans que personne l'ait décidé.** Ni la marque, qui ne
-- voyait rien ; ni le créateur, qui signait un contrat où la clause figurait
-- comme un terme convenu.
--
-- C'était déjà discutable quand ces droits étaient gratuits. Depuis qu'ils se
-- facturent (0058), ce défaut revient à les OFFRIR : six mois de réutilisation
-- valent +50 % du montant, et personne ne les facturait puisque personne ne
-- savait qu'ils étaient cédés.
--
-- Le commentaire d'origine disait par ailleurs « 0 = illimité ». Le produit,
-- lui, traite l'absence de durée comme une ABSENCE DE CESSION, et le contrat
-- écrit noir sur blanc « à l'exclusion de toute réutilisation ultérieure ». Les
-- deux lectures sont exactement opposées. Aucune ligne n'est à 0 aujourd'hui —
-- on aligne donc le schéma sur ce que fait le produit, avant qu'une ligne à 0
-- n'apparaisse et ne fasse dire au contrat l'inverse de ce que le schéma
-- promettait.
--
-- ⚠️ Les collaborations EXISTANTES ne sont pas réécrites. Six d'entre elles
-- portent la valeur 6, certaines avec un contrat déjà signé dont l'instantané
-- est figé. Les ramener à NULL ferait dire à l'écran l'inverse du contrat que
-- les deux parties ont signé. On corrige la règle pour l'avenir, on ne réécrit
-- pas le passé.
-- ============================================================

alter table public.deals
  alter column usage_rights_months drop default;

comment on column public.deals.usage_rights_months is
  'Durée de réutilisation cédée, en mois. NULL = AUCUNE cession — le contrat limite alors l''usage à la publication convenue. Se facture via usage_rights_fee (voir lib/droits).';
