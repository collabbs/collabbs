-- ============================================================
-- Collabbs · 0051 — le livrable « Validation finale de la marque » n'en est pas un
-- ------------------------------------------------------------
-- Chaque collaboration recevait DEUX livrables : le contenu, et une ligne
-- « Validation finale de la marque ». Or un livrable, c'est ce que le créateur
-- dépose. L'écran demandait donc au créateur de déposer la validation de la
-- marque, et la clôture — qui exige que TOUS les livrables soient validés —
-- restait bloquée dessus.
--
-- Le code ne crée plus cette ligne. Ici on retire celles qui existent déjà,
-- et seulement quand elles ne portent aucune trace de travail :
--   · collaboration encore ouverte (négociation ou en cours),
--   · rien de déposé, rien de validé.
--
-- Les collaborations terminées ne sont PAS touchées : leur historique
-- raconte ce qui s'est passé, on ne le réécrit pas.
-- ============================================================

delete from public.deliverables d
using public.deals dl
where d.deal_id = dl.id
  and d.label = 'Validation finale de la marque'
  and d.done = false
  and d.approved = false
  and d.revision_requested = false
  and d.submission_url is null
  and dl.status in ('negotiation', 'active');
