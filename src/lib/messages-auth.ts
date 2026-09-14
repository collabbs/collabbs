/**
 * Les erreurs d'authentification, dites en français et en clair.
 *
 * Supabase renvoie ses messages en anglais et en langage technique — « Invalid
 * login credentials », « User already registered ». On les affichait tels
 * quels, sur l'écran de connexion, c'est-à-dire au tout premier contact avec le
 * produit et dans une langue qui n'est pas celle du reste de la page.
 *
 * Deux règles pour chaque traduction :
 *  · dire ce qui s'est passé ET quoi faire — une erreur qui ne propose rien
 *    laisse la personne bloquée devant le même formulaire ;
 *  · ne pas révéler si l'adresse existe. « Mot de passe incorrect » confirmerait
 *    qu'un compte existe à cette adresse, ce qui se teste en masse.
 *
 * Un message inconnu passe dans un repli générique plutôt que dans l'anglais :
 * la liste ne peut pas être exhaustive, et une phrase vague en français vaut
 * mieux qu'une phrase précise dans la mauvaise langue.
 */

const TRADUCTIONS: { motif: RegExp; texte: string }[] = [
  {
    motif: /invalid login credentials/i,
    texte:
      "Adresse email ou mot de passe incorrect. Vérifie ta saisie, ou utilise « Oublié ? » pour recevoir un lien.",
  },
  {
    motif: /email not confirmed/i,
    texte:
      "Ton adresse n'est pas encore confirmée. Ouvre le mail qu'on t'a envoyé et clique sur le lien — pense à regarder dans tes spams.",
  },
  {
    motif: /user already registered|already been registered/i,
    texte: "Un compte existe déjà avec cette adresse. Connecte-toi, ou demande un nouveau mot de passe.",
  },
  {
    motif: /password should be at least/i,
    texte: "Ton mot de passe est trop court : il faut au moins 8 caractères.",
  },
  {
    motif: /weak password|password is too weak/i,
    texte: "Ce mot de passe est trop facile à deviner. Ajoute des caractères, ou mélange chiffres et lettres.",
  },
  {
    motif: /unable to validate email|invalid email/i,
    texte: "Cette adresse email n'a pas l'air valide. Vérifie qu'il n'y a pas de faute de frappe.",
  },
  {
    motif: /email rate limit|over_email_send_rate_limit|too many requests/i,
    texte: "Trop de tentatives d'affilée. Attends une minute avant de réessayer.",
  },
  {
    motif: /same password|different from the old/i,
    texte: "Ce mot de passe est identique à l'ancien. Choisis-en un autre.",
  },
  {
    motif: /token has expired|expired|invalid token/i,
    texte: "Ce lien a expiré. Demandes-en un nouveau depuis « Oublié ? ».",
  },
];

export function messageAuth(brut: string | null | undefined): string {
  const texte = (brut ?? "").trim();
  if (!texte) return "Une erreur est survenue. Réessaie.";
  return (
    TRADUCTIONS.find((t) => t.motif.test(texte))?.texte ??
    "La connexion n'a pas pu aboutir. Réessaie, et écris-nous si ça persiste."
  );
}
