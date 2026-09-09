-- ============================================================
-- 0070 — Les retouches déjà traitées, et un reste de la 0069
-- ============================================================
--
-- ─── 1. Le drapeau qui ne retombait jamais ───
-- `deliverables.revision_requested` passait à vrai quand la marque demandait
-- une retouche, et AUCUN code ne le remettait à faux. Le code applicatif est
-- corrigé (le dépôt d'une nouvelle version, la coche « terminé » et la
-- validation le referment tous les trois), mais les lignes déjà écrites, elles,
-- restent bloquées.
--
-- Elles le sont dans les deux sens :
--   • la libération automatique du séquestre est refusée tant qu'une retouche
--     est « en cours » — donc pour toujours sur ces collaborations ;
--   • et 14 jours après la demande, la marque peut au contraire se faire
--     rembourser l'INTÉGRALITÉ, même si le créateur a redéposé et que la vidéo
--     est en ligne, parce que le code lit ce drapeau comme un abandon.
--
-- On ne referme que ce qui est manifestement traité : un livrable validé par
-- la marque, ou déposé/coché terminé par le créateur. Un livrable qui attend
-- encore sa nouvelle version garde son drapeau — c'est son rôle.
update public.deliverables
   set revision_requested = false,
       revision_message   = null
 where revision_requested = true
   and (approved = true or done = true or submitted_at is not null);


-- ─── 2. Ce que la 0069 a laissé passer ───
-- `0002_grants.sql` pose des privilèges PAR DÉFAUT : toute table créée ensuite
-- accorde automatiquement `select` à `anon`. La table d'archives des contrats,
-- née en 0069, en a donc hérité sans que rien ne le demande.
--
-- Aucune ligne n'a fuité — la policy filtre sur `partie_id = auth.uid()`, et
-- un visiteur non connecté n'a pas d'identité, donc reçoit une liste vide
-- (vérifié). Mais faire reposer la confidentialité de contrats signés sur la
-- seule policy, quand le privilège n'aurait jamais dû être accordé, c'est
-- garder une porte ouverte en comptant sur le verrou suivant.
revoke select on public.contrats_archives from anon;
