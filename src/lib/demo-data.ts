import "server-only";

/**
 * Les créateurs de démonstration doivent-ils apparaître dans la marketplace ?
 *
 * La base contient 24 profils fictifs (`creators.is_demo`) : photographies de
 * banque d'images, tarifs inventés, avis et notes semés à la main. Ils rendent
 * l'outil présentable pendant qu'on le construit — et ils deviennent un
 * mensonge le jour où un vrai visiteur arrive, parce que rien ne les distingue
 * d'un créateur réel. Une marque peut leur écrire.
 *
 * Règle : **visibles en développement, invisibles en production.** Le travail
 * quotidien garde son annuaire peuplé, le site public ne montre que des
 * personnes réelles — sans qu'on ait à supprimer quoi que ce soit, ni à
 * penser à le faire le jour J.
 *
 * `NEXT_PUBLIC_SHOW_DEMO_CREATORS` force l'un ou l'autre : « 1 » les affiche
 * (utile sur une préproduction de démonstration), « 0 » les cache.
 */
export function demoCreatorsVisibles(): boolean {
  const forcage = process.env.NEXT_PUBLIC_SHOW_DEMO_CREATORS;
  if (forcage === "1") return true;
  if (forcage === "0") return false;
  return process.env.NODE_ENV !== "production";
}
