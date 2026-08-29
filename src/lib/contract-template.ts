import "server-only";
import type { ContractSnapshot, PartySnapshot } from "@/lib/contract-snapshot";

/**
 * Corps du contrat de collaboration commerciale.
 *
 * ⚠️ AVERTISSEMENT — Ce modèle a été rédigé pour couvrir les mentions rendues
 * obligatoires par le décret n° 2025-1137 du 28 novembre 2025 (application de
 * l'article 8 de la loi n° 2023-451 du 9 juin 2023 encadrant l'influence
 * commerciale). Il n'a PAS été rédigé par un professionnel du droit et doit
 * être relu par un avocat avant toute ouverture au public.
 *
 * Deux régimes :
 *  - SIMPLIFIÉ  — en dessous de 1 000 € HT cumulés sur l'année civile entre ces
 *    deux parties, la loi n'impose pas le contrat écrit. On produit quand même
 *    un document clair, mais sans exiger les informations d'entreprise.
 *  - COMPLET    — au-delà du seuil, toutes les mentions obligatoires sont
 *    présentes et les informations légales des deux parties sont exigées.
 *
 * Une seule source pour l'écran et le PDF : ce module renvoie des clauses
 * structurées, jamais du HTML.
 */

export type Clause = {
  /** Numéro d'article, tel qu'affiché ("1", "2"…). */
  number: string;
  title: string;
  /** Paragraphes. Chaque entrée est un bloc de texte. */
  paragraphs: string[];
};

export type ContractRegime = "simplified" | "complete";

export type ContractDocument = {
  reference: string;
  regime: ContractRegime;
  generatedAt: string;
  parties: { brand: PartySnapshot; creator: PartySnapshot };
  clauses: Clause[];
  /** Mentions de pied de page (signature électronique, valeur probante). */
  footer: string[];
};

const FORMAT_LABELS: Record<string, string> = {
  video_post: "vidéo publiée sur les réseaux sociaux",
  ugc: "contenu généré par l'utilisateur (UGC), livré à l'annonceur",
  story: "story publiée sur les réseaux sociaux",
  reel: "reel publié sur les réseaux sociaux",
  live: "session en direct (live)",
};

function eur(n: number): string {
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function dateFr(iso: string | null): string {
  if (!iso) return "non précisée";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Adresse d'une partie sur une seule ligne, pour la prose. */
function addressLine(p: PartySnapshot): string {
  const bits = [p.address, [p.zip, p.city].filter(Boolean).join(" "), p.country]
    .filter(Boolean)
    .join(", ");
  return bits || "adresse non renseignée";
}

function partyIdentity(p: PartySnapshot, role: "annonceur" | "créateur"): string {
  const name = p.legal_name || p.display_name;
  const bits: string[] = [`**${name}**`];
  if (p.legal_status_label) bits.push(p.legal_status_label);
  if (p.rep_name) bits.push(`représenté${role === "créateur" ? "" : ""} par ${p.rep_name}`);
  bits.push(`dont l'adresse est ${addressLine(p)}`);
  if (p.country) bits.push(`pays de résidence fiscale : ${p.country}`);
  if (p.siret) bits.push(`SIRET ${p.siret}`);
  if (p.vat) bits.push(`TVA intracommunautaire ${p.vat}`);
  if (p.contact_email) bits.push(`adresse électronique ${p.contact_email}`);
  return bits.join(", ") + ".";
}

/**
 * Assemble le contrat à partir du snapshot figé.
 * `regime` découle du suivi de seuil, calculé par l'appelant.
 */
export function buildContractDocument(params: {
  reference: string;
  snapshot: ContractSnapshot;
  regime: ContractRegime;
}): ContractDocument {
  const { reference, snapshot, regime } = params;
  const { brand, creator, deal } = snapshot;
  if (!deal || !brand || !creator) {
    // Ne devrait pas arriver : l'appelant filtre sur `version === 1`. Garde-fou
    // pour qu'un snapshot abîmé remonte une erreur claire plutôt qu'un plantage
    // au milieu du rendu.
    throw new Error(
      `Contrat ${reference} : snapshot incomplet, impossible de générer le document.`,
    );
  }
  const complete = regime === "complete";

  const formatLabel = FORMAT_LABELS[deal.format] ?? deal.format;
  const quantity = deal.quantity ?? 1;
  const clauses: Clause[] = [];
  let n = 0;
  const add = (title: string, paragraphs: string[]) =>
    clauses.push({ number: String(++n), title, paragraphs });

  add("Parties au contrat", [
    `**L'annonceur** — ${partyIdentity(brand, "annonceur")}`,
    `**Le créateur** — ${partyIdentity(creator, "créateur")}`,
    "Ci-après désignés ensemble « les Parties ».",
  ]);

  add("Objet et description des prestations", [
    deal.title
      ? `Le présent contrat a pour objet la réalisation par le créateur de la prestation d'influence commerciale intitulée « ${deal.title} ».`
      : "Le présent contrat a pour objet la réalisation par le créateur d'une prestation d'influence commerciale au bénéfice de l'annonceur.",
    `**Nature de la prestation** : ${quantity} ${formatLabel}${quantity > 1 ? "s" : ""}.`,
    deal.brand_notes
      ? `**Attentes de l'annonceur** : ${deal.brand_notes}`
      : "Les attentes détaillées de l'annonceur sont celles échangées entre les Parties sur la plateforme Collabbs, annexées au présent contrat.",
    "Le créateur conserve la maîtrise éditoriale de son contenu, dans le respect des attentes ci-dessus et de la réglementation applicable.",
  ]);

  add("Rémunération et avantages en nature", [
    `En contrepartie de la prestation, l'annonceur verse au créateur la somme de **${eur(deal.amount)}**, montant net revenant au créateur.`,
    "Le paiement est effectué par l'intermédiaire de la plateforme Collabbs, qui séquestre les fonds dès l'acceptation du contrat et les libère au bénéfice du créateur après validation de la livraison par l'annonceur.",
    "Les Parties déclarent que la rémunération ci-dessus est exhaustive. Tout avantage en nature complémentaire (produit, dotation, service offert) doit être déclaré sur la plateforme et sa valeur ajoutée au cumul annuel, conformément à la réglementation.",
  ]);

  add("Calendrier et livraison", [
    deal.deadline
      ? `Le créateur s'engage à livrer la prestation au plus tard le **${dateFr(deal.deadline)}**.`
      : "Les Parties conviennent d'un calendrier de livraison sur la plateforme Collabbs.",
    "La livraison s'effectue sur la plateforme, par dépôt du lien de publication ou du fichier livrable. L'annonceur dispose d'un délai pour valider la livraison ou demander des retouches dans la limite du nombre convenu ; à défaut de réponse dans ce délai, la livraison est réputée acceptée.",
  ]);

  if (complete) {
    add("Transparence publicitaire", [
      "Conformément à la loi n° 2023-451 du 9 juin 2023 encadrant l'influence commerciale, le créateur s'engage à indiquer de manière **explicite, claire et lisible, tout au long de la diffusion**, le caractère commercial de la publication, au moyen de la mention « Publicité » ou « Collaboration commerciale ».",
      "Cette mention doit être visible quel que soit le format et le support de diffusion, sans que l'utilisateur ait à effectuer une action pour la faire apparaître.",
      "Le créateur s'engage en outre à signaler toute image retouchée ainsi que tout contenu généré ou modifié par intelligence artificielle représentant une personne, dans les conditions prévues par la loi.",
      "Le non-respect de ces obligations engage la responsabilité du créateur et peut justifier la résiliation du contrat aux torts de celui-ci.",
    ]);
  } else {
    add("Transparence publicitaire", [
      "Le créateur s'engage à indiquer clairement le caractère commercial de la publication au moyen de la mention « Publicité » ou « Collaboration commerciale », visible pendant toute la durée de diffusion.",
    ]);
  }

  add("Droits d'utilisation du contenu", [
    deal.usage_rights_months
      ? `L'annonceur bénéficie d'un droit d'utilisation du contenu produit pour une durée de **${deal.usage_rights_months} mois** à compter de la livraison, sur ses propres supports de communication.`
      : "L'annonceur bénéficie d'un droit d'utilisation du contenu produit sur ses propres supports de communication, dans les limites convenues entre les Parties sur la plateforme.",
    "Toute utilisation excédant ce périmètre, notamment une exploitation publicitaire payante, doit faire l'objet d'un accord distinct et, le cas échéant, d'une rémunération complémentaire.",
    "Le créateur garantit être titulaire des droits sur le contenu livré et avoir obtenu les autorisations nécessaires des personnes y figurant.",
  ]);

  if (deal.exclusivity) {
    add("Exclusivité", [
      deal.exclusivity_days
        ? `Le créateur s'engage à ne pas promouvoir de produits ou services directement concurrents de ceux de l'annonceur pendant une durée de **${deal.exclusivity_days} jours** à compter de la publication.`
        : "Le créateur s'engage à ne pas promouvoir de produits ou services directement concurrents de ceux de l'annonceur pendant la durée convenue entre les Parties.",
      "Cette obligation est limitée au secteur d'activité de l'annonceur et ne saurait faire obstacle à l'activité générale du créateur.",
    ]);
  } else {
    add("Exclusivité", [
      "Aucune clause d'exclusivité n'est prévue au présent contrat. Le créateur demeure libre de collaborer avec d'autres annonceurs, y compris concurrents.",
    ]);
  }

  if (complete) {
    add("Responsabilité des Parties et droit de la consommation", [
      "Chaque Partie répond des manquements à ses propres obligations. L'annonceur est responsable de l'exactitude des informations qu'il communique sur ses produits ou services, ainsi que de leur conformité à la réglementation applicable, notamment au code de la consommation.",
      "Le créateur est responsable du respect des obligations de transparence publicitaire mentionnées ci-dessus et s'interdit toute pratique commerciale trompeuse au sens des articles L. 121-1 et suivants du code de la consommation.",
      "Les Parties s'interdisent la promotion des biens et services dont la publicité est interdite ou restreinte par la loi n° 2023-451, notamment en matière de chirurgie esthétique, de produits financiers à haut risque, de jeux d'argent auprès des mineurs, et d'abstention thérapeutique.",
      "La plateforme Collabbs intervient en qualité d'intermédiaire technique et de tiers de confiance pour la formalisation du contrat et la sécurisation du paiement. Elle n'est pas partie au contrat et ne répond pas de l'exécution des obligations des Parties.",
    ]);

    add("Données personnelles", [
      "Chaque Partie traite les données personnelles auxquelles elle accède dans le cadre du présent contrat conformément au règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.",
      "Les coordonnées échangées au titre du présent contrat ne peuvent être utilisées à d'autres fins que son exécution, sauf consentement exprès de la personne concernée.",
    ]);
  }

  add("Modification, annulation et résiliation", [
    "Toute modification des termes du présent contrat requiert l'accord des deux Parties, formalisé sur la plateforme Collabbs.",
    "Le contrat peut être annulé d'un commun accord tant que la prestation n'a pas été livrée ; les fonds séquestrés sont alors restitués à l'annonceur.",
    "En cas de manquement grave d'une Partie à ses obligations, l'autre Partie peut résilier le contrat après mise en demeure restée sans effet pendant sept jours.",
  ]);

  if (complete) {
    add("Droit applicable et règlement des différends", [
      "Le présent contrat est soumis au droit français.",
      "En cas de différend, les Parties s'engagent à rechercher une solution amiable, le cas échéant par l'intermédiaire de la plateforme Collabbs. À défaut d'accord, le litige relève de la compétence des juridictions françaises.",
      "Lorsque le créateur agit en qualité de consommateur, les règles de compétence protectrices prévues par le droit de la consommation demeurent applicables.",
    ]);
  }

  const footer = complete
    ? [
        `Contrat référencé **${reference}**, établi le ${dateFr(snapshot.generated_at)} et signé électroniquement par les deux Parties via la plateforme Collabbs.`,
        "La signature électronique est horodatée et conservée par la plateforme. Conformément à l'article 1367 du code civil, elle présente la même valeur probante qu'une signature manuscrite dès lors que le procédé permet d'identifier son auteur et de garantir l'intégrité de l'acte.",
        "Chaque Partie reconnaît avoir pris connaissance de l'intégralité du présent contrat avant de le signer et en conserver un exemplaire.",
      ]
    : [
        `Contrat référencé **${reference}**, établi le ${dateFr(snapshot.generated_at)} et signé électroniquement par les deux Parties via la plateforme Collabbs.`,
        "Ce document est établi sous forme simplifiée : la rémunération cumulée entre ces deux Parties sur l'année civile en cours n'atteint pas le seuil de 1 000 € HT à partir duquel la loi impose un contrat écrit détaillé. Au franchissement de ce seuil, un contrat complet sera établi.",
      ];

  return {
    reference,
    regime,
    generatedAt: snapshot.generated_at,
    parties: { brand, creator },
    clauses,
    footer,
  };
}
