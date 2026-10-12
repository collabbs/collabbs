-- ═══════════════════════════════════════════════════════════════════════════
-- Remettre les provisions en face de l'argent réellement encaissé
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le constat (12/10/2026) ───
-- L'historique de la provision, relu ligne à ligne :
--
--     recharges inscrites en base ......... 260 €
--     réellement encaissées en mode réel ... 20 €   (07/10, pi_3UNw08K8yn9…)
--
-- Les 240 € restants datent du 12/09, AVANT la bascule en mode réel : des
-- paiements en mode test. L'écriture est vraie, l'argent ne l'est pas. La page
-- Provision affichait 105,89 € alors que Collabbs n'a jamais encaissé que 20 €.
--
-- Même maladie que les identifiants Stripe de test (`bascule-stripe-reel.sql`),
-- un étage plus haut : le mode test laisse des soldes d'apparence normale.
--
-- Le danger n'est pas théorique : sur une VRAIE marque, Collabbs garantirait à
-- des créateurs un argent qu'elle n'a jamais reçu, et le versement échouerait
-- faute de fonds — c'est exactement l'erreur observée le 14/09, « insufficient
-- available funds in your Stripe account ».
--
-- ─── Ce que ce script fait, et ce qu'il ne fait pas ───
-- Il remet les PROVISIONS à zéro. Il ne touche NI au journal, NI aux ventes,
-- NI aux transactions : cet historique est faux mais il est inoffensif, et
-- l'effacer ferait perdre la trace de ce qui s'est passé. Le solde, lui, est
-- ce qui promet de l'argent — c'est donc lui qu'il faut corriger.
--
-- Après exécution, Julien réapprovisionne en mode réel ce dont il a besoin.
--
-- À n'exécuter qu'avant l'ouverture, et JAMAIS après le premier vrai client.
-- La requête renvoie chaque marque touchée et son ancien solde : rien n'est
-- fait en silence, et le montant d'avant reste lisible si on veut revenir.

-- Le `RETURNING` d'une mise à jour renvoie la NOUVELLE valeur : il ne dirait
-- donc rien du montant d'avant. On le relève dans une sous-requête lue sur le
-- même instantané, pour que la sortie garde la trace de ce qui a été remis à
-- zéro — sans elle, impossible de revenir en arrière.
with avant as (
  select id, name, balance as ancien_solde
    from public.brands
   where balance is distinct from 0
      or topup_failed_at is not null
),
remise as (
  update public.brands b
     set balance         = 0,
         topup_failed_at = null,
         updated_at      = now()
    from avant a
   where b.id = a.id
  returning b.id
)
select a.name                  as marque,
       a.ancien_solde          as solde_avant,
       0                       as solde_apres
  from avant a
  join remise r on r.id = a.id
 order by a.ancien_solde desc nulls last;
