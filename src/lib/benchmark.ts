/**
 * Les repères tarifaires.
 *
 * ─── Le problème qu'ils résolvent ───
 * « Je mets combien ? » est la question qui bloque une marque au moment de
 * publier sa campagne, et un créateur au moment de remplir ses tarifs. Les
 * deux se trompent dans le même sens : la marque propose trop peu et
 * n'obtient personne, le créateur affiche trop peu et le regrette.
 *
 * ─── Le piège, et c'est le vrai sujet de ce fichier ───
 * Une médiane calculée sur trois collaborations est un mensonge présenté
 * comme une statistique. Une place de marché qui démarre en est pleine — et
 * c'est précisément une marque qui a fait confiance à un chiffre inventé qui
 * ne revient jamais.
 *
 * D'où la règle unique : **en dessous de `SEUIL_FIABILITE` observations, on
 * ne calcule rien et on le dit.** Pas de chiffre approximatif, pas de
 * « environ », pas de moyenne sur deux lignes. On bascule alors sur des
 * repères de marché SOURCÉS, présentés comme ce qu'ils sont — des chiffres
 * publiés par d'autres, avec leur origine, pas notre mesure.
 *
 * ─── Pourquoi la médiane et pas la moyenne ───
 * Une seule collaboration à 3 000 € au milieu de dix à 150 € déplace la
 * moyenne à 400 € et ne décrit plus personne. La médiane ignore l'extrême ;
 * l'écart interquartile dit s'il y a consensus ou dispersion, ce qui est
 * l'information réellement utile pour se situer.
 */

/**
 * Le nombre minimum d'observations en dessous duquel on refuse de conclure.
 *
 * Huit n'a rien de magique : c'est le seuil en dessous duquel un quartile
 * n'est plus qu'une paraphrase du minimum et du maximum. Le choisir plus bas
 * ferait passer du bruit pour de la mesure ; plus haut retarderait
 * inutilement le moment où nos propres données deviennent utiles.
 */
export const SEUIL_FIABILITE = 8;

export type Statistiques = {
  /** Combien d'observations ont produit ces chiffres. Toujours affiché. */
  n: number;
  median: number;
  /** Le quart des tarifs est en dessous. */
  q1: number;
  /** Le quart des tarifs est au-dessus. */
  q3: number;
};

/**
 * Le quantile par interpolation linéaire, sur une liste DÉJÀ triée.
 *
 * Interpolation plutôt que « l'élément le plus proche » parce que sur de
 * petits échantillons, arrondir à un élément existant fait sauter le quartile
 * d'une valeur réelle à l'autre dès qu'on ajoute une ligne — le chiffre
 * bougerait de 40 € d'un jour à l'autre sans que le marché ait bougé.
 */
function quantile(triees: readonly number[], p: number): number {
  if (triees.length === 1) return triees[0];
  const position = (triees.length - 1) * p;
  const bas = Math.floor(position);
  const haut = Math.ceil(position);
  if (bas === haut) return triees[bas];
  const poids = position - bas;
  return triees[bas] * (1 - poids) + triees[haut] * poids;
}

/**
 * Les statistiques d'une série de tarifs, ou `null` si on n'a pas de quoi
 * conclure.
 *
 * Renvoyer `null` plutôt qu'un objet à zéro est délibéré : un appelant peut
 * oublier de tester un compteur, il ne peut pas oublier de tester `null`.
 */
export function statistiquesTarifs(prix: readonly number[]): Statistiques | null {
  // Un tarif à zéro n'est pas un tarif bas, c'est un champ non rempli : le
  // compter tirerait toute la distribution vers le bas et ferait proposer aux
  // marques des montants que personne n'accepte.
  const valides = prix.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (valides.length < SEUIL_FIABILITE) return null;
  return {
    n: valides.length,
    median: Math.round(quantile(valides, 0.5)),
    q1: Math.round(quantile(valides, 0.25)),
    q3: Math.round(quantile(valides, 0.75)),
  };
}

/**
 * Un repère de marché publié par quelqu'un d'autre.
 *
 * `source` n'est pas décoratif : c'est ce qui distingue un chiffre qu'on peut
 * défendre d'un chiffre qu'on a inventé. Aucune entrée ne doit exister ici
 * sans une page publique où le lecteur peut aller vérifier.
 */
export type RepereMarche = {
  libelle: string;
  valeur: string;
  source: string;
  url: string;
  releveLe: string;
};

/**
 * Les repères publics du marché français, relevés à la source.
 *
 * Ils ne s'accordent pas entre eux, et **on ne les moyenne surtout pas** :
 * l'écart entre 28 € et 99 € n'est pas du bruit, c'est la différence entre
 * une vidéo brute de 30 secondes commandée en volume et une production
 * livrée montée avec les droits inclus. Les afficher côte à côte informe ;
 * en faire une moyenne fabriquerait un prix qui n'existe nulle part.
 */
export const REPERES_MARCHE: RepereMarche[] = [
  {
    libelle: "Vidéo UGC de 30 s, prix moyen constaté en France",
    valeur: "28 €",
    source: "Influee, simulateur de coût",
    url: "https://influee.co/fr/tarification/creation-ugc",
    releveLe: "2026-08-31",
  },
  {
    libelle: "Vidéo UGC, entrée de gamme annoncée aux créateurs",
    valeur: "à partir de 80 €",
    source: "Influee, page créateurs",
    url: "https://influee.co/fr/pour-createurs",
    releveLe: "2026-08-31",
  },
  {
    libelle: "Vidéo de 15 s livrée montée, droits pub 2 ans inclus",
    valeur: "99 € HT",
    source: "Moggo, prix public",
    url: "https://www.moggo.fr/",
    releveLe: "2026-08-31",
  },
];

/**
 * Ce qu'on affiche, et sur quoi il repose.
 *
 * Le type force l'appelant à traiter les deux cas séparément : nos propres
 * mesures et des repères empruntés ne se présentent pas avec les mêmes mots,
 * et les confondre reviendrait à faire passer les chiffres d'un concurrent
 * pour les nôtres.
 */
export type Reperes =
  | { origine: "collabbs"; stats: Statistiques }
  | { origine: "marche"; reperes: RepereMarche[]; observations: number };

export function reperesTarifaires(prix: readonly number[]): Reperes {
  const stats = statistiquesTarifs(prix);
  if (stats) return { origine: "collabbs", stats };
  return {
    origine: "marche",
    reperes: REPERES_MARCHE,
    // On annonce combien on a vraiment, y compris quand c'est zéro : c'est
    // la phrase qui explique pourquoi on cite quelqu'un d'autre.
    observations: prix.filter((p) => Number.isFinite(p) && p > 0).length,
  };
}

/**
 * La phrase qui accompagne des repères empruntés.
 *
 * Dire « pas encore assez de données » sans dire combien il en manque laisse
 * penser à une panne. Dire le compte réel en fait une étape.
 */
export function phraseObservations(observations: number): string {
  if (observations === 0) {
    return "Aucune collaboration comparable sur Collabbs pour l'instant.";
  }
  if (observations === 1) {
    return "1 seule collaboration comparable sur Collabbs — trop peu pour en tirer un tarif.";
  }
  return `${observations} collaborations comparables sur Collabbs — il en faut ${SEUIL_FIABILITE} pour que la médiane veuille dire quelque chose.`;
}
