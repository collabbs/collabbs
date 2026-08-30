-- Suivi des actions CPA
--
-- Manque constaté le 30 août 2026 : les campagnes payées à l'action étaient
-- configurables de bout en bout — libellé de l'action, montant par action
-- (`cpa_flat`), paliers (`cpa_tiers`) — et affichées aux créateurs comme une
-- promesse de rémunération. Mais AUCUNE route n'enregistrait jamais d'action.
-- Une marque pouvait publier « 2 € par inscription », un créateur pouvait
-- l'accepter et générer des inscriptions : il n'aurait jamais été payé, parce
-- que rien ne les comptait.
--
-- `affiliate_events.type` ne connaissait que 'click' et 'sale'. On ajoute
-- 'action'. Les colonnes nécessaires existent déjà : `source` accepte
-- 'cpa_action' (migration 0034) et `action_count` porte le nombre d'actions
-- déclarées en une fois.
--
-- Note : `alter type ... add value` ne peut pas être suivi d'un usage de la
-- nouvelle valeur dans la même transaction. Cette migration se contente donc
-- de l'ajouter ; le code s'en sert ensuite.

alter type public.affiliate_event_type add value if not exists 'action';
