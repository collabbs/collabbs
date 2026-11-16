-- Pouvoir couper ses e-mails, sans jamais couper ce qui coûte de l'argent.
--
-- ─── Ce qui manquait ───
-- Le produit n'avait AUCUN réglage de notification et AUCUN lien de
-- désinscription dans ses e-mails. Relevé le 16/11/2026 : rien dans le code,
-- nulle part. Quelqu'un qui reçoit trop de courriels n'avait qu'une issue —
-- les classer en indésirables. C'est la pire : ça n'arrête pas les envois,
-- ça abîme la réputation du domaine d'expédition, et ça finit par faire
-- tomber en indésirables les courriels qui annoncent un paiement.
--
-- ─── Deux interrupteurs, pas vingt ───
-- Un réglage par type de notification se traduirait par trente-six cases que
-- personne ne lit. Deux familles suffisent, et elles correspondent à deux
-- intentions réelles : « je veux savoir où en sont mes collaborations » et
-- « je veux qu'on me relance ».
--
-- ─── Ce qui N'EST PAS coupable, et pourquoi ───
-- L'argent et les obligations partent toujours : « tu viens de recevoir
-- 15,00 € », « tes commissions t'attendent, relie ton compte », « le contrat
-- écrit devient obligatoire ». Couper ces courriels-là ne rend service à
-- personne : c'est précisément ceux dont l'absence coûte cher. Le centre de
-- notifications dans le produit, lui, garde TOUT dans les deux cas — ces
-- réglages ne concernent que le courriel.
--
-- Le défaut de la carte des familles (`lib/categories-notification.ts`) va
-- dans le même sens : un type non classé est traité comme essentiel. Oublier
-- de ranger un nouveau type fait donc recevoir un courriel de trop, jamais
-- taire une nouvelle qui concerne de l'argent.

alter table public.profiles
  add column if not exists mails_suivi boolean not null default true;

alter table public.profiles
  add column if not exists mails_rappels boolean not null default true;

comment on column public.profiles.mails_suivi is
  'Courriels de suivi des collaborations (propositions, livrables, messages, avis). Le centre de notifications les garde quoi qu''il arrive.';

comment on column public.profiles.mails_rappels is
  'Courriels de relance et de découverte (rappel du défilé, profil incomplet, bilan hebdomadaire).';
