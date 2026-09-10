-- ============================================================
-- 0072 — Six lignes d'authentification illisibles
-- ============================================================
--
-- ─── Le symptôme ───
-- `auth.admin.listUsers()` échoue en entier avec « Database error finding
-- users ». Pas sur une ligne : sur TOUT l'appel. Lues une par une, six lignes
-- répondent « Database error loading user » — les marques de démonstration
-- Sephora, Anker, NordVPN, Lululemon, Trade Republic et Gymshark.
--
-- ─── La cause ───
-- Ces comptes ont été créés en SQL direct plutôt que par l'API. Leurs colonnes
-- de jetons (`confirmation_token`, `recovery_token`, `email_change`…) sont donc
-- restées à NULL, alors que le service d'authentification les lit comme des
-- chaînes non nulles. Il ne sait pas convertir NULL en texte : il abandonne la
-- lecture, et emporte la page entière avec lui.
--
-- ─── Pourquoi ça compte au-delà de six comptes de démo ───
-- Tout code qui liste les utilisateurs tombe. Le rappel hebdomadaire du défilé
-- s'en servait pour écarter les adresses de démonstration : l'appel échouant,
-- la liste d'adresses restait vide, chaque créateur était classé « adresse
-- inconnue », et le rappel n'envoyait RIEN — en se déclarant en bonne santé.
-- Le code est corrigé pour survivre à ça ; cette migration retire la cause.
--
-- Idempotent : ne touche que les NULL, et remet la valeur qu'attend le service
-- d'authentification, la chaîne vide.
-- ============================================================

update auth.users set confirmation_token      = '' where confirmation_token      is null;
update auth.users set recovery_token          = '' where recovery_token          is null;
update auth.users set email_change            = '' where email_change            is null;
update auth.users set email_change_token_new  = '' where email_change_token_new  is null;
update auth.users set email_change_token_current = '' where email_change_token_current is null;
update auth.users set phone_change            = '' where phone_change            is null;
update auth.users set phone_change_token      = '' where phone_change_token      is null;
update auth.users set reauthentication_token  = '' where reauthentication_token  is null;

-- Contrôle : s'il reste une ligne illisible, on veut le savoir maintenant,
-- pas le jour où un envoi silencieux n'aura touché personne.
do $$
declare restants int;
begin
  select count(*) into restants from auth.users
   where confirmation_token is null
      or recovery_token is null
      or email_change is null
      or email_change_token_new is null
      or email_change_token_current is null
      or phone_change is null
      or phone_change_token is null
      or reauthentication_token is null;
  if restants > 0 then
    raise exception 'auth.users : % ligne(s) portent encore des jetons NULL', restants;
  end if;
end $$;
