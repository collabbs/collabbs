import LegalDoc, { type LegalSection } from "../LegalDoc";

export const metadata = {
  title: "Conditions de vente — Collabbs",
  description:
    "Commissions, séquestre des fonds, versements et remboursements sur Collabbs.",
};

/**
 * ⚠️ Rédigé sans professionnel du droit. À faire relire par un avocat.
 *
 * ⚠️ Les taux cités doivent être tenus à jour avec le code : le modèle
 * économique n'était pas arrêté au moment de la rédaction. Les valeurs
 * actuelles viennent de `lib/deal.ts` (deals) et `lib/affiliate-billing.ts`
 * (affiliation). Toute modification de l'un doit se répercuter ici.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "Objet et champ d'application",
    paragraphs: [
      "Les présentes conditions régissent les aspects financiers du service Collabbs : commissions, séquestre des fonds, versements et remboursements.",
      "Elles s'appliquent dès qu'une collaboration donne lieu à un paiement ou à une commission d'affiliation.",
      "**Le créateur ne verse aucune commission à Collabbs.** Il perçoit le montant convenu avec l'annonceur, net de toute retenue de la plateforme.",
    ],
  },
  {
    title: "Commission sur les collaborations",
    paragraphs: [
      "Une commission de plateforme est due par l'annonceur sur chaque collaboration réglée via Collabbs. Son taux est affiché avant tout engagement, sur le récapitulatif de paiement.",
      "Cette commission rémunère le séquestre des fonds, l'établissement du contrat, la conservation des preuves de livraison, l'assistance et la prévention de la fraude.",
      "Les frais de traitement bancaire appliqués par le prestataire de paiement sont indiqués séparément.",
    ],
  },
  {
    title: "Commission sur l'affiliation",
    paragraphs: [
      "Lorsqu'un annonceur active un programme d'affiliation, il définit la commission revenant au créateur sur chaque vente.",
      "**La commission de Collabbs s'ajoute à celle du créateur ; elle n'en est jamais déduite.** Le créateur perçoit exactement le taux annoncé dans la campagne.",
      "L'annonceur approvisionne un compte dédié. Chaque vente attribuée y réserve immédiatement la commission du créateur ainsi que la commission de Collabbs.",
      "Si le compte n'est plus approvisionné, la vente est enregistrée comme non financée : la commission reste due au créateur, mais son versement est suspendu jusqu'au réapprovisionnement.",
    ],
  },
  {
    title: "Séquestre des fonds",
    paragraphs: [
      "Les sommes réglées par l'annonceur sont conservées par Collabbs jusqu'à validation de la livraison. Elles ne sont ni la propriété de Collabbs, ni utilisées pour son fonctionnement.",
      "Le versement au créateur intervient après validation de la livraison par l'annonceur, ou après expiration du délai de validation prévu au contrat.",
      "En cas d'annulation avant livraison, les sommes séquestrées sont restituées à l'annonceur.",
    ],
  },
  {
    title: "Validation des commissions d'affiliation",
    paragraphs: [
      "Une vente attribuée ouvre droit à commission après un délai de validation, destiné à couvrir les retours et remboursements éventuels. Ce délai est indiqué dans l'espace du créateur.",
      "Pendant ce délai, l'annonceur peut déclarer un remboursement : la commission correspondante est alors annulée et la réservation lui est restituée.",
      "Passé ce délai, la commission est définitivement acquise au créateur.",
    ],
  },
  {
    title: "Versements aux créateurs",
    paragraphs: [
      "Les versements sont effectués sur le compte de paiement connecté par le créateur auprès du prestataire de paiement. Leur exécution suppose que les vérifications d'identité exigées par ce prestataire aient abouti.",
      "Les commissions d'affiliation acquises sont versées périodiquement, à partir d'un montant minimum indiqué dans l'espace du créateur. En deçà, elles s'accumulent sans être perdues.",
      "Le délai d'arrivée sur le compte bancaire dépend du prestataire de paiement et de l'établissement bancaire du créateur.",
    ],
  },
  {
    title: "Facturation et obligations fiscales",
    paragraphs: [
      "Collabbs facture sa commission à l'annonceur et met les justificatifs à sa disposition.",
      "**Chaque créateur demeure responsable de ses propres obligations déclaratives, fiscales et sociales**, ainsi que de l'émission de ses factures lorsque son statut l'exige. Collabbs ne se substitue à lui sur aucun de ces points.",
      "Les documents mis à disposition par la plateforme sont des justificatifs de flux ; ils ne constituent ni un conseil fiscal, ni une attestation de conformité.",
    ],
  },
  {
    title: "Traçage des ventes chez l'annonceur",
    paragraphs: [
      "L'annonceur qui active un programme d'affiliation installe sur son site un dispositif de suivi fourni par Collabbs, ou transmet les ventes depuis son serveur.",
      "**Ce dispositif dépose un cookie sur le site de l'annonceur, sous sa propre responsabilité.** Il lui appartient de l'intégrer à son dispositif de recueil du consentement et à sa propre politique de confidentialité.",
      "Collabbs traite les données de clic et de vente pour le compte de l'annonceur aux fins d'attribution des commissions. Les adresses IP et les agents utilisateurs ne sont conservés que sous forme empreintée, aux seules fins de prévention de la fraude.",
    ],
  },
  {
    title: "Litiges entre annonceur et créateur",
    paragraphs: [
      "En cas de désaccord sur une livraison, les parties disposent de la messagerie de la plateforme pour tenter de s'entendre.",
      "À défaut d'accord, chacune peut saisir Collabbs. Après examen des éléments — contrat, échanges, livrables déposés — Collabbs peut débloquer les fonds séquestrés au bénéfice du créateur, ou les restituer à l'annonceur.",
      "**Cette intervention est une facilité destinée à débloquer une situation, non un arbitrage juridictionnel.** Elle ne prive aucune partie de son droit d'agir en justice.",
    ],
  },
  {
    title: "Droit de rétractation",
    paragraphs: [
      "Les prestations proposées sur Collabbs s'adressent à des professionnels dans le cadre de leur activité. Le droit de rétractation prévu par le code de la consommation ne s'y applique pas.",
      "Lorsqu'un utilisateur agit néanmoins en qualité de consommateur, les dispositions protectrices d'ordre public lui restent acquises.",
    ],
  },
  {
    title: "Droit applicable",
    paragraphs: [
      "Les présentes conditions sont soumises au droit français. Les différends relèvent des juridictions françaises compétentes, sans préjudice des règles protectrices applicables aux consommateurs.",
    ],
  },
];

export default function CgvPage() {
  return (
    <LegalDoc
      title="Conditions générales de vente"
      current="/legal/cgv"
      intro="Comment l'argent circule sur Collabbs : commissions, séquestre, versements et remboursements."
      sections={SECTIONS}
    />
  );
}
