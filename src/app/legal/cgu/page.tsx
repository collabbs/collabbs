import LegalDoc, { type LegalSection } from "../LegalDoc";

export const metadata = {
  title: "Conditions d'utilisation — Collabbs",
  description: "Règles d'accès et d'usage de la plateforme Collabbs.",
};

/**
 * ⚠️ Rédigé sans professionnel du droit. À faire relire par un avocat avant
 * toute ouverture au public.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "Objet",
    paragraphs: [
      "Les présentes conditions régissent l'accès et l'utilisation de la plateforme Collabbs, qui met en relation des annonceurs et des créateurs de contenu en vue de collaborations commerciales.",
      "**Collabbs n'est pas partie aux contrats conclus entre un annonceur et un créateur.** Elle intervient en qualité d'intermédiaire technique et de tiers de confiance : elle formalise le contrat, séquestre les fonds et mesure les résultats. L'exécution de la prestation relève des seules parties.",
      "L'utilisation de la plateforme vaut acceptation des présentes conditions.",
    ],
  },
  {
    title: "Accès au service",
    paragraphs: [
      "L'inscription est réservée aux personnes majeures. En créant un compte, l'utilisateur déclare avoir au moins 18 ans et disposer de la capacité juridique pour contracter.",
      "L'utilisateur choisit à l'inscription son rôle — créateur ou annonceur — et s'engage à fournir des informations exactes et à les tenir à jour.",
      "L'accès à la plateforme est gratuit pour les créateurs. Les conditions financières applicables aux annonceurs figurent dans les conditions générales de vente.",
    ],
  },
  {
    title: "Compte et sécurité",
    paragraphs: [
      "Chaque utilisateur est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.",
      "Toute utilisation non autorisée doit être signalée sans délai. Collabbs peut suspendre un compte dont la sécurité paraît compromise.",
      "Un utilisateur ne peut détenir qu'un seul compte par rôle. La création de comptes multiples destinée à contourner une suspension ou à fausser les statistiques est interdite.",
    ],
  },
  {
    title: "Exactitude des informations d'audience",
    paragraphs: [
      "Le créateur s'engage à déclarer des chiffres d'audience exacts. Les chiffres déclarés sont présentés comme tels ; seuls les chiffres constatés auprès des plateformes concernées portent la mention « vérifié ».",
      "Sont notamment interdits : l'achat d'abonnés ou d'engagement, l'usage de robots, et toute manipulation destinée à surévaluer une audience.",
      "Collabbs peut vérifier une audience à tout moment, corriger un chiffre déclaré, retirer une mention de vérification ou suspendre un compte dont les chiffres se révèlent manifestement inexacts.",
    ],
  },
  {
    title: "Obligations du créateur",
    paragraphs: [
      "Le créateur s'engage à :",
      {
        list: [
          "indiquer clairement le caractère commercial de ses publications, au moyen de la mention « Publicité » ou « Collaboration commerciale », visible pendant toute la durée de diffusion, conformément à la loi n° 2023-451 du 9 juin 2023 ;",
          "signaler les images retouchées et les contenus générés ou modifiés par intelligence artificielle représentant une personne, dans les conditions prévues par la loi ;",
          "respecter les délais et le périmètre convenus avec l'annonceur ;",
          "détenir les droits sur les contenus qu'il livre et disposer des autorisations des personnes y figurant ;",
          "déclarer son activité auprès des autorités compétentes et s'acquitter des obligations fiscales et sociales qui en découlent.",
        ],
      },
      "**Collabbs ne verse jamais de salaire et n'est pas l'employeur des créateurs.** Chaque créateur agit en qualité d'indépendant.",
    ],
  },
  {
    title: "Obligations de l'annonceur",
    paragraphs: [
      "L'annonceur s'engage à :",
      {
        list: [
          "fournir des informations exactes sur ses produits ou services, et à en garantir la conformité à la réglementation applicable ;",
          "ne pas demander au créateur de dissimuler le caractère commercial d'une publication ;",
          "ne pas promouvoir de biens ou services dont la publicité est interdite ou restreinte par la loi n° 2023-451, notamment en matière de chirurgie esthétique, de produits financiers à haut risque, de jeux d'argent auprès des mineurs, et d'abstention thérapeutique ;",
          "approvisionner son compte lorsqu'il active un programme d'affiliation, afin que les commissions dues aux créateurs soient couvertes ;",
          "valider ou refuser une livraison dans les délais prévus.",
        ],
      },
    ],
  },
  {
    title: "Contenus publiés sur la plateforme",
    paragraphs: [
      "L'utilisateur reste propriétaire des contenus qu'il publie sur son profil. Il concède à Collabbs une licence non exclusive et gratuite de reproduction et de représentation de ces contenus, strictement limitée à leur affichage sur la plateforme et à la promotion du service, pour la durée de son inscription.",
      "Sont interdits les contenus illicites, diffamatoires, haineux, pornographiques, portant atteinte à la vie privée ou aux droits de tiers.",
      "Collabbs peut retirer un contenu manifestement illicite et suspendre le compte concerné.",
    ],
  },
  {
    title: "Contournement de la plateforme",
    paragraphs: [
      "Les utilisateurs mis en relation par Collabbs s'engagent à formaliser et régler par la plateforme les collaborations qui en résultent, pendant douze mois à compter de leur mise en relation.",
      "Cette obligation protège les deux parties : hors plateforme, il n'y a ni contrat conforme, ni séquestre, ni preuve de livraison, ni recours en cas de litige.",
      "Le contournement répété peut entraîner la suspension du compte.",
    ],
  },
  {
    title: "Suspension et résiliation",
    paragraphs: [
      "L'utilisateur peut supprimer son compte à tout moment depuis ses réglages. Les collaborations en cours et les obligations financières correspondantes lui survivent.",
      "Collabbs peut suspendre ou résilier un compte en cas de manquement aux présentes conditions, après information de l'utilisateur et, sauf urgence ou illicéité manifeste, mise en demeure préalable.",
      "Les sommes séquestrées au moment d'une suspension sont réglées selon les termes des collaborations concernées, et non retenues par Collabbs.",
    ],
  },
  {
    title: "Disponibilité et responsabilité",
    paragraphs: [
      "Collabbs met en œuvre les moyens raisonnables pour assurer la disponibilité du service, sans garantie d'absence d'interruption. Des interruptions pour maintenance peuvent survenir.",
      "Collabbs répond de ses propres manquements. Elle ne répond pas de l'exécution des prestations convenues entre un annonceur et un créateur, ni de la qualité des contenus produits, ni des résultats commerciaux obtenus.",
      "Aucune stipulation des présentes ne limite les droits que l'utilisateur tient de dispositions d'ordre public, notamment lorsqu'il agit en qualité de consommateur.",
    ],
  },
  {
    title: "Modification des conditions",
    paragraphs: [
      "Collabbs peut modifier les présentes conditions. Les utilisateurs actifs sont informés par e-mail au moins trente jours avant l'entrée en vigueur des modifications substantielles.",
      "La poursuite de l'utilisation après cette date vaut acceptation. À défaut, l'utilisateur peut résilier son compte sans frais.",
    ],
  },
  {
    title: "Droit applicable et différends",
    paragraphs: [
      "Les présentes conditions sont soumises au droit français.",
      "En cas de différend, les parties recherchent d'abord une solution amiable. L'utilisateur consommateur peut recourir gratuitement à un médiateur de la consommation.",
      "À défaut d'accord, le litige relève des juridictions françaises compétentes.",
    ],
  },
];

export default function CguPage() {
  return (
    <LegalDoc
      title="Conditions générales d'utilisation"
      current="/legal/cgu"
      intro="Les règles d'accès et d'usage de la plateforme, pour les créateurs comme pour les annonceurs."
      sections={SECTIONS}
    />
  );
}
