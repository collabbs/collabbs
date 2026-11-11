/**
 * D'où vient cette visite : le canal d'origine.
 *
 * ─── La question à laquelle ça répond ───
 * Le test de sortie se lit sur une ligne — combien de collaborations payées
 * par des marques non démarchées. Mais ce qu'on fait ENSUITE dépend d'une
 * autre question : lequel des trois canaux a payé ? Un canal peut remplir le
 * questionnaire sans jamais sortir une carte, et un autre amener trois
 * personnes dont deux paient. Sans origine mesurée, huit semaines produisent
 * un chiffre sans explication.
 *
 * ─── Pourquoi une liste fermée ───
 * `utm_source` vient de l'URL, donc de n'importe qui. Sans borne, le premier
 * robot qui passe avec `?utm_source=<script>` écrit sa chaîne dans la mesure,
 * et il suffit d'une poignée de visites bizarres pour qu'un tableau
 * hebdomadaire devienne illisible. On ne garde donc que les canaux qu'on a
 * décidé de tester ; tout le reste compte comme une arrivée directe.
 *
 * ─── Ce qu'on ne garde pas ───
 * Ni le référent complet, ni la page d'atterrissage, ni aucun identifiant
 * publicitaire. Une étiquette de canal, et rien d'autre. C'est la même règle
 * que `lib/tunnel.ts` : de quoi compter des passages, pas de quoi reconnaître
 * quelqu'un.
 *
 * ─── Le premier contact gagne ───
 * L'origine est écrite une seule fois et jamais remplacée. Quelqu'un qui
 * arrive par TikTok, repart, puis revient par une recherche Google reste
 * attribué à TikTok : la question du test est « qui nous a fait découvrir »,
 * pas « quel onglet était ouvert au moment de payer ».
 */

/**
 * Les canaux du plan de sortie du 05/11, et eux seuls.
 *
 *  - `createurs` : un créateur a envoyé un lien à sa marque (canal n° 1)
 *  - `eleves`    : annonce aux élèves du coaching
 *  - `creatikk`  : clients Creatikk
 *  - `tiktok`, `instagram` : le compte de contenu (canal n° 2)
 *  - `seo`       : arrivée depuis un moteur de recherche (canal n° 3)
 */
export const CANAUX = [
  "createurs",
  "eleves",
  "creatikk",
  "tiktok",
  "instagram",
  "seo",
] as const;

export type Canal = (typeof CANAUX)[number];

const CLE = "collabbs.origine.v1";

/** Les moteurs dont une arrivée compte comme référencement. */
const MOTEURS = ["google.", "bing.", "duckduckgo.", "qwant.", "ecosia.", "yahoo.", "brave."];

/** Vrai si la valeur est un canal que nous mesurons. */
export function estUnCanal(v: unknown): v is Canal {
  return typeof v === "string" && (CANAUX as readonly string[]).includes(v);
}

/**
 * La décision, isolée de toute lecture du navigateur.
 *
 * Séparée exprès : les tests du produit tournent sans DOM — « ce qu'on
 * vérifie ici, c'est du calcul pur » (`vitest.config.ts`). En sortant la règle
 * de la plomberie, elle se teste sans ajouter jsdom au projet.
 *
 * L'URL gagne sur le référent : elle est explicite, c'est nous qui l'avons
 * écrite dans le lien.
 *
 * @param recherche la query string, avec ou sans « ? »
 * @param referent  `document.referrer`, éventuellement vide
 */
export function canalDepuis(recherche: string, referent: string): Canal | null {
  try {
    const source = new URLSearchParams(recherche).get("utm_source");
    if (estUnCanal(source)) return source;

    if (!referent) return null;
    const hote = new URL(referent).hostname.toLowerCase();
    // Un retour depuis notre propre site n'est pas une arrivée.
    if (hote === "collabbs.com" || hote.endsWith(".collabbs.com")) return null;
    if (MOTEURS.some((m) => hote.includes(m))) return "seo";
    return null;
  } catch {
    // Référent illisible : on ne devine pas.
    return null;
  }
}

/**
 * Le canal de cette visite, mémorisé au premier contact.
 *
 * Renvoie `null` pour une arrivée directe — c'est une réponse, pas un échec :
 * « personne ne nous a amenés » est une information du test.
 */
export function origineDeSession(): Canal | null {
  if (typeof window === "undefined") return null;

  const maintenant = () => canalDepuis(window.location.search, document.referrer);

  try {
    const deja = window.localStorage.getItem(CLE);
    if (estUnCanal(deja)) return deja;
    // Une arrivée directe déjà constatée ne se recalcule pas : sinon un retour
    // par Google réécrirait l'origine d'une visite venue de TikTok. C'est tout
    // l'objet du marqueur « direct » : distinguer « jamais mesuré » de
    // « mesuré, et c'était direct ».
    if (deja === "direct") return null;

    const canal = maintenant();
    window.localStorage.setItem(CLE, canal ?? "direct");
    return canal;
  } catch {
    // Navigation privée, stockage refusé : on mesure moins, on ne casse rien.
    return maintenant();
  }
}
