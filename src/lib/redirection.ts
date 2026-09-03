/**
 * Un chemin de redirection fourni par le client est-il sûr ?
 *
 * Le paramètre `next` traverse les formulaires d'inscription et de connexion
 * pour ramener la personne là où elle voulait aller. Il vient donc de
 * l'extérieur, et `redirect()` de Next suit une URL ABSOLUE sans broncher :
 * `next=https://exemple-malveillant.test` enverrait un utilisateur qui vient
 * de saisir son mot de passe sur un autre domaine, depuis un lien qui porte
 * notre nom. C'est le scénario classique de l'hameçonnage par redirection
 * ouverte.
 *
 * On n'accepte donc qu'un chemin interne, et on refuse en particulier :
 *  - les URL absolues (`https://…`, `//…` qui vaut protocole-relatif),
 *  - tout ce qui ne commence pas par une simple barre oblique,
 *  - les barres obliques inversées, que certains navigateurs normalisent en
 *    `/` — `/\exemple.test` deviendrait `//exemple.test`.
 */
export function cheminInterne(brut: string | null | undefined, defaut = "/start"): string {
  const v = (brut ?? "").trim();
  if (!v) return defaut;
  if (!v.startsWith("/")) return defaut;
  // `//hôte` et `/\hôte` sortent du site malgré la barre oblique initiale.
  if (v.startsWith("//") || v.startsWith("/\\")) return defaut;
  return v;
}
