import "server-only";
import type { ContractSnapshot, PartySnapshot } from "@/lib/contract-snapshot";
// Taux unique, celui qu'applique réellement le calcul du versement.
import { PLATFORM_FEE_RATE, dealBreakdown } from "@/lib/deal";

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

/**
 * Libellés des formats, au singulier ET au pluriel.
 *
 * Ce sont des locutions entières, pas des noms isolés : leur pluriel ne se
 * déduit pas en ajoutant un « s ». C'est pourtant ce que faisait le code, et
 * les cinq formats en sortaient fautifs — « 2 vidéo publiée sur les réseaux
 * sociauxs », « 3 contenu généré par l'utilisateur (UGC), livré à
 * l'annonceurs ». Une faute d'accord dans un contrat entame la confiance
 * qu'on lui accorde ; trois des cinq formats produisaient en plus un mot qui
 * n'existe pas.
 */
const FORMAT_LABELS: Record<string, { one: string; many: string }> = {
  video_post: {
    one: "vidéo publiée sur les réseaux sociaux",
    many: "vidéos publiées sur les réseaux sociaux",
  },
  ugc: {
    one: "contenu généré par l'utilisateur (UGC), livré à l'annonceur",
    many: "contenus générés par l'utilisateur (UGC), livrés à l'annonceur",
  },
  story: {
    one: "story publiée sur les réseaux sociaux",
    many: "stories publiées sur les réseaux sociaux",
  },
  reel: {
    one: "reel publié sur les réseaux sociaux",
    many: "reels publiés sur les réseaux sociaux",
  },
  live: {
    one: "session en direct (live)",
    many: "sessions en direct (live)",
  },
};

/**
 * Libellé accordé au nombre. Un format inconnu — ajouté plus tard sans passer
 * par ici — est rendu tel quel plutôt que déformé : mieux vaut un libellé
 * brut qu'un mot inventé.
 */
function formatLabelFor(format: string, quantity: number): string {
  const entry = FORMAT_LABELS[format];
  if (!entry) return format;
  return quantity > 1 ? entry.many : entry.one;
}

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
    `**Nature de la prestation** : ${quantity} ${formatLabelFor(deal.format, quantity)}.`,
    deal.brand_notes
      ? `**Attentes de l'annonceur** : ${deal.brand_notes}`
      : "Les attentes détaillées de l'annonceur sont celles échangées entre les Parties sur la plateforme Collabbs, annexées au présent contrat.",
    "Le créateur conserve la maîtrise éditoriale de son contenu, dans le respect des attentes ci-dessus et de la réglementation applicable.",
  ]);

  // ATTENTION — le contrat énonçait « la somme de X, montant net revenant au
  // créateur » en reprenant le montant BRUT de la collaboration. Or la
  // plateforme en déduit sa commission : sur 1 400 €, le créateur en reçoit
  // 1 260 €. Le contrat affirmait donc par écrit un montant que le créateur
  // n'allait pas toucher. Constaté le 30 août 2026 en comparant le contrat à
  // l'écran de la collaboration.
  //
  // Les trois montants sont énoncés séparément : ce que reçoit le créateur, ce
  // que la plateforme facture EN PLUS à l'annonceur, et le total déboursé. Un
  // contrat ne peut pas dire autre chose que ce qui se passe.
  //
  // La rédaction précédente disait « la plateforme prélève 10 %, le net
  // revenant au créateur s'élève à… » — c'était exact tant que la commission
  // était déduite de sa part. Elle ne l'est plus.
  const { fee: dealFee, gross: dealTotal } = dealBreakdown(deal.amount);

  add("Rémunération et avantages en nature", [
    `En contrepartie de la prestation, le créateur perçoit la somme de **${eur(deal.amount)}**, sans aucune retenue de la part de la plateforme.`,
    `La commission de la plateforme Collabbs, égale à **${Math.round(PLATFORM_FEE_RATE * 100)} %** de cette somme soit ${eur(dealFee)}, est facturée à l'annonceur en supplément. Le montant total déboursé par l'annonceur s'élève ainsi à **${eur(dealTotal)}**.`,
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
      ? // Le PÉRIMÈTRE est écrit noir sur blanc, et c'est le point qui compte :
        // une clause qui dit seulement « six mois » sans dire pour quel usage
        // se règle au tribunal le jour où l'annonceur pousse le contenu en
        // publicité payante. Le prix payé pour ces droits y figure aussi —
        // c'est ce qui rend la cession opposable.
        `L'annonceur bénéficie d'un droit d'utilisation du contenu produit pour une durée de **${deal.usage_rights_months} mois** à compter de la livraison, ${
          deal.usage_rights_scope === "paid"
            ? "sur ses propres supports de communication **ainsi qu'en diffusion publicitaire payante**, y compris auprès d'audiences n'appartenant pas à la communauté du créateur"
            : "sur ses **propres supports de communication uniquement**, à l'exclusion de toute diffusion publicitaire payante"
        }.${
          deal.usage_rights_fee
            ? ` Cette cession est rémunérée **${deal.usage_rights_fee} €**, compris dans le montant total de la collaboration.`
            : ""
        }`
      // La formulation précédente renvoyait « aux limites convenues entre les
      // Parties sur la plateforme » — alors qu'aucun écran ne permettait d'en
      // convenir. Une clause qui renvoie à un accord inexistant ne protège
      // personne. À défaut de durée fixée, on énonce la règle protectrice :
      // pas de réutilisation au-delà de la publication convenue.
      : "À défaut de durée convenue entre les Parties, le droit d'utilisation de l'annonceur est limité à la publication réalisée par le créateur dans le cadre de la présente collaboration, à l'exclusion de toute réutilisation ultérieure sur ses propres supports.",
    // Sans cette condition, le contrat interdisait à la ligne suivante la
    // diffusion publicitaire qu'il venait d'accorder à la ligne précédente.
    deal.usage_rights_scope === "paid"
      ? "Toute utilisation excédant le périmètre et la durée ci-dessus doit faire l'objet d'un accord distinct et, le cas échéant, d'une rémunération complémentaire."
      : "Toute utilisation excédant ce périmètre, notamment une exploitation publicitaire payante, doit faire l'objet d'un accord distinct et, le cas échéant, d'une rémunération complémentaire.",
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

/**
 * Instantané d'un contrat-cadre d'affiliation.
 *
 * Il ne fige PAS les taux de commission : une relation d'affiliation dure, les
 * campagnes s'ajoutent, les barèmes changent. Un contrat signé en mars ne peut
 * pas décrire une campagne rejointe en juillet. Il fige donc la RELATION — les
 * parties, les obligations, la durée — et renvoie, pour les montants, aux
 * conditions de chaque campagne telles qu'affichées au moment où le créateur
 * active son lien. C'est ainsi que fonctionnent les contrats-cadres réels.
 */
export type AffiliateContractSnapshot = {
  version: 1;
  kind: "affiliate";
  generated_at: string;
  period_year: number;
  brand: PartySnapshot;
  creator: PartySnapshot;
  /** Commissions déjà acquises au moment de l'établissement, à titre indicatif. */
  earned_to_date: number;
  /** Frais de plateforme à la charge de l'annonceur, en pourcentage. */
  platform_fee_pct: number;
  /** Délai de validation d'une commission, en jours. */
  validation_days: number;
  /** Seuil de déclenchement d'un versement, en euros. */
  min_payout: number;
};

/**
 * Assemble le contrat-cadre d'affiliation.
 *
 * Établi dès que le cumul annuel entre les deux parties franchit le seuil légal
 * de 1 000 €, quel que soit le canal — l'affiliation compte au même titre que
 * les collaborations, et n'avait jusqu'ici aucun contrat.
 */
export function buildAffiliateContractDocument(params: {
  reference: string;
  snapshot: AffiliateContractSnapshot;
}): ContractDocument {
  const { reference, snapshot } = params;
  const { brand, creator } = snapshot;
  if (!brand || !creator) {
    throw new Error(
      `Contrat ${reference} : instantané incomplet, impossible de générer le document.`,
    );
  }

  const clauses: Clause[] = [];
  let n = 0;
  const add = (title: string, paragraphs: string[]) =>
    clauses.push({ number: String(++n), title, paragraphs });

  add("Parties au contrat", [
    `**L'annonceur** — ${partyIdentity(brand, "annonceur")}`,
    `**Le créateur** — ${partyIdentity(creator, "créateur")}`,
    "Ci-après désignés ensemble « les Parties ».",
  ]);

  add("Objet du contrat", [
    `Le présent contrat-cadre définit les conditions dans lesquelles le créateur promeut les produits ou services de l'annonceur au moyen de liens de suivi, de codes promotionnels ou d'actions rémunérées, mis à disposition par la plateforme Collabbs.`,
    "Il régit une relation continue et ne porte sur aucune prestation déterminée : chaque campagne à laquelle le créateur choisit d'adhérer fixe ses propres conditions de rémunération, portées à sa connaissance avant toute adhésion.",
    `Il est établi pour l'année civile ${snapshot.period_year} et couvre l'ensemble des rémunérations d'affiliation versées entre les Parties au cours de cette période.`,
  ]);

  add("Rémunération", [
    "Le créateur perçoit, pour chaque vente, action ou événement rémunéré qui lui est attribué, la commission prévue par la campagne concernée, telle qu'affichée sur la plateforme au moment où il active son lien de suivi.",
    `La commission est acquise au créateur à l'issue d'un délai de validation de **${snapshot.validation_days} jours** courant à compter de l'événement, destiné à couvrir les annulations et remboursements. Elle est versée dès lors que le total acquis atteint **${eur(snapshot.min_payout)}**.`,
    `Les frais de la plateforme, égaux à **${snapshot.platform_fee_pct} %** de la commission, sont supportés par l'annonceur **en sus** de celle-ci. La commission annoncée au créateur n'en est jamais diminuée.`,
    snapshot.earned_to_date > 0
      ? `À la date d'établissement du présent contrat, les commissions acquises au créateur au titre de la relation s'élèvent à **${eur(snapshot.earned_to_date)}**.`
      : "Aucune commission n'était acquise à la date d'établissement du présent contrat.",
  ]);

  add("Transparence publicitaire", [
    "Conformément à la loi n° 2023-451 du 9 juin 2023 encadrant l'influence commerciale, le créateur s'engage à indiquer de manière **explicite, claire et lisible, tout au long de la diffusion**, le caractère commercial de toute publication réalisée au titre du présent contrat, au moyen de la mention « Publicité » ou « Collaboration commerciale ».",
    "Cette obligation s'applique à toute publication comportant un lien de suivi ou un code promotionnel, y compris lorsque la rémunération dépend du résultat.",
    "Le créateur s'engage en outre à signaler toute image retouchée ainsi que tout contenu généré ou modifié par intelligence artificielle représentant une personne, dans les conditions prévues par la loi.",
  ]);

  add("Obligations du créateur", [
    "Le créateur promeut les produits ou services de l'annonceur de bonne foi et s'interdit toute pratique destinée à générer artificiellement des clics, des ventes ou des actions, notamment l'achat de trafic, l'usage de robots, l'auto-attribution de commissions sur ses propres achats, ou la diffusion de son lien par courrier électronique non sollicité.",
    "Toute rémunération obtenue par de tels moyens est indue et peut être annulée par l'annonceur, y compris après versement.",
    "Le créateur conserve la maîtrise éditoriale de ses contenus, dans le respect de la réglementation applicable et des attentes portées à sa connaissance par la campagne.",
  ]);

  add("Droits d'utilisation des contenus", [
    "Sauf accord distinct, l'annonceur ne dispose d'aucun droit d'exploitation des contenus publiés par le créateur au titre du présent contrat.",
    "Toute reprise de ces contenus par l'annonceur, notamment à des fins publicitaires payantes, requiert un accord exprès et, le cas échéant, une rémunération complémentaire.",
    "Le créateur garantit être titulaire des droits sur les contenus qu'il publie et avoir obtenu les autorisations nécessaires des personnes y figurant.",
  ]);

  add("Responsabilité des Parties et droit de la consommation", [
    "L'annonceur est responsable de l'exactitude des informations qu'il communique sur ses produits ou services, de leur conformité à la réglementation applicable, ainsi que de l'exécution des commandes qui en résultent.",
    "Le créateur est responsable du respect des obligations de transparence publicitaire mentionnées ci-dessus et s'interdit toute pratique commerciale trompeuse au sens des articles L. 121-1 et suivants du code de la consommation.",
    "Les Parties s'interdisent la promotion des biens et services dont la publicité est interdite ou restreinte par la loi n° 2023-451, notamment en matière de chirurgie esthétique, de produits financiers à haut risque, de jeux d'argent auprès des mineurs, et d'abstention thérapeutique.",
    "La plateforme Collabbs intervient en qualité d'intermédiaire technique et de tiers de confiance pour la formalisation du contrat, le suivi des attributions et la sécurisation des versements. Elle n'est pas partie au contrat et ne répond pas de l'exécution des obligations des Parties.",
  ]);

  add("Données personnelles", [
    "Chaque Partie traite les données personnelles auxquelles elle accède dans le cadre du présent contrat conformément au règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.",
    "Les liens de suivi reposent sur des identifiants déposés sur les terminaux des visiteurs de l'annonceur. Il appartient à ce dernier d'en informer ses visiteurs et de recueillir, le cas échéant, leur consentement.",
  ]);

  add("Durée, modification et résiliation", [
    `Le présent contrat couvre l'année civile ${snapshot.period_year}. Il se poursuit tant que la relation d'affiliation demeure active et fait l'objet d'un nouvel établissement à chaque année civile.`,
    "Chaque Partie peut y mettre fin à tout moment, sans motif ni préavis, en désactivant les liens de suivi concernés. Les commissions déjà acquises restent dues.",
    "Toute modification requiert l'accord des deux Parties, formalisé sur la plateforme Collabbs. Une évolution des conditions d'une campagne ne s'applique qu'aux événements postérieurs à sa publication.",
  ]);

  add("Droit applicable et règlement des différends", [
    "Le présent contrat est soumis au droit français.",
    "En cas de différend, les Parties s'engagent à rechercher une solution amiable, le cas échéant par l'intermédiaire de la plateforme Collabbs. À défaut d'accord, le litige relève de la compétence des juridictions françaises.",
    "Lorsque le créateur agit en qualité de consommateur, les règles de compétence protectrices prévues par le droit de la consommation demeurent applicables.",
  ]);

  return {
    reference,
    regime: "complete",
    generatedAt: snapshot.generated_at,
    parties: { brand, creator },
    clauses,
    footer: [
      `Contrat-cadre référencé **${reference}**, établi le ${dateFr(snapshot.generated_at)} et signé électroniquement par les deux Parties via la plateforme Collabbs.`,
      "La signature électronique est horodatée et conservée par la plateforme. Conformément à l'article 1367 du code civil, elle présente la même valeur probante qu'une signature manuscrite dès lors que le procédé permet d'identifier son auteur et de garantir l'intégrité de l'acte.",
      "Chaque Partie reconnaît avoir pris connaissance de l'intégralité du présent contrat avant de le signer et en conserver un exemplaire.",
    ],
  };
}
