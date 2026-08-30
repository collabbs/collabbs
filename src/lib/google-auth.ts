/**
 * La connexion Google est-elle réellement disponible ?
 *
 * `signInWithOAuth` ne renvoie pas d'erreur quand le fournisseur n'est pas
 * activé : il fait NAVIGUER le navigateur vers Supabase, qui répond
 * `{"msg":"Unsupported provider: provider is not enabled"}` en JSON brut,
 * plein écran. Aucun `catch` ne rattrape ça. Tant que le fournisseur n'est pas
 * configuré des deux côtés (Google Cloud + Supabase), on n'affiche pas le
 * bouton : mieux vaut ne rien proposer que d'envoyer les gens dans un mur.
 *
 * Poser `NEXT_PUBLIC_GOOGLE_AUTH=1` (local et Vercel) une fois la
 * configuration faite.
 */
export function googleActif(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";
}
