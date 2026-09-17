/**
 * L'adresse du site d'une marque, ramenée à ce qu'elle doit être.
 *
 * ─── Ce qu'on y trouvait ───
 * Le champ acceptait n'importe quel texte, tel quel. Une marque colle ce
 * qu'elle a dans sa barre d'adresse, et ce qu'elle a dans sa barre d'adresse
 * est souvent une page atteinte par une publicité :
 *
 *   https://www.exemple.fr/fr/?utm_source=google&gclid=Cj0KCQjwh4TV…
 *
 * Trois conséquences, aucune visible tout de suite :
 *  · la fiche publique de la marque renvoie vers une page portant les
 *    paramètres publicitaires de quelqu'un d'autre ;
 *  · la vérification d'installation du tracker va chercher CETTE page-là ;
 *  · le jour où la marque compare son site à ce qu'affiche Collabbs, elle y
 *    voit une adresse qu'elle ne reconnaît pas, et doute du reste.
 *
 * ─── Ce qu'on garde ───
 * Le schéma, le domaine, le chemin. On jette la requête et l'ancre : elles
 * décrivent une visite, pas un site. Et on impose `https` — un site marchand
 * qui n'est pas en HTTPS en 2026 ne prendra de toute façon aucun paiement.
 */

export function normaliserSiteMarque(saisie: string | null | undefined): string | null {
  const brut = (saisie ?? "").trim();
  if (!brut) return null;

  // Une marque tape rarement le schéma. L'absence n'est pas une erreur.
  const avecSchema = /^https?:\/\//i.test(brut) ? brut : `https://${brut}`;

  let url: URL;
  try {
    url = new URL(avecSchema);
  } catch {
    return null;
  }

  // Un domaine sans point n'existe pas sur l'internet public. Le refuser ici
  // évite d'aller interroger « localhost » ou un nom de machine interne.
  if (!url.hostname.includes(".")) return null;

  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  // Un chemin réduit à « / » n'apporte rien et allonge l'affichage.
  const chemin = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${chemin}`;
}
