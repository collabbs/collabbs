/**
 * Le jeton de session du tunnel.
 *
 * Tiré au hasard, gardé dans le navigateur, sans aucun lien avec une
 * personne. Il ne sert qu'à recoller les étapes d'un même passage : sans lui
 * on saurait combien de fois chaque étape est atteinte, mais pas combien de
 * gens vont de la première à la dernière — or c'est exactement la question.
 */
const CLE = "collabbs.session.v1";

export function jetonDeSession(): string {
  if (typeof window === "undefined") return "";
  try {
    const existant = window.localStorage.getItem(CLE);
    if (existant) return existant;
    const neuf = crypto.randomUUID();
    window.localStorage.setItem(CLE, neuf);
    return neuf;
  } catch {
    // Navigation privée, stockage refusé : on mesure moins, on ne casse rien.
    return "";
  }
}
