/**
 * Fabrique le code promo d'un créateur pour une campagne.
 *
 * Un code promo doit être ATTRIBUABLE : une vente arrive avec un code, et il
 * faut savoir qui l'a diffusée pour le payer. Un code partagé par tous les
 * créateurs ne le permet pas — c'est pour ça que le code saisi par la marque
 * devient un préfixe (« MAISON » → « MAISON-JULIEN ») plutôt qu'un code
 * commun. La marque garde un code reconnaissable, le créateur garde le sien.
 *
 * Le code doit aussi être TAPABLE : il finit saisi à la main dans un panier,
 * souvent depuis un téléphone, parfois lu à voix haute dans une vidéo. D'où
 * les majuscules sans accents, et l'absence des caractères qu'on confond
 * (0/O, 1/I/L).
 */

const SANS_AMBIGUITE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Retire accents, espaces et ponctuation ; garde lettres et chiffres. */
function normaliser(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function suffixe(longueur = 2): string {
  let s = "";
  for (let i = 0; i < longueur; i++) {
    s += SANS_AMBIGUITE[Math.floor(Math.random() * SANS_AMBIGUITE.length)];
  }
  return s;
}

/**
 * @param prefixe  le code saisi par la marque, s'il y en a un
 * @param handle   l'identifiant public du créateur
 * @param tentative numéro d'essai : à chaque collision, le suffixe s'allonge
 */
export function fabriquerCodePromo(
  prefixe: string | null | undefined,
  handle: string | null | undefined,
  tentative = 0,
): string {
  const base = normaliser(handle ?? "").slice(0, 12) || "CREATEUR";
  const tete = normaliser(prefixe ?? "").slice(0, 10);
  const corps = tete ? `${tete}-${base}` : base;
  // Le suffixe garantit l'unicité même quand deux créateurs ont des handles
  // qui se normalisent pareil (« Léa.M » et « lea-m »).
  return `${corps}-${suffixe(2 + tentative)}`;
}
