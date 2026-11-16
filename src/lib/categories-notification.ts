/**
 * À quelle famille appartient chaque notification.
 *
 * Sert à une seule chose : décider si un COURRIEL part, quand la personne a
 * coupé une famille dans ses réglages. Le centre de notifications dans le
 * produit, lui, garde tout — ces familles ne le concernent pas.
 *
 * ─── Le défaut est « essentiel », et c'est délibéré ───
 * Un type qui n'apparaît pas dans cette carte est traité comme essentiel,
 * donc toujours envoyé. Le sens de cet oubli compte : quelqu'un qui ajoute un
 * type et oublie de le ranger fait recevoir un courriel de trop — agaçant.
 * L'inverse ferait taire, un jour, un « tu viens d'être payé » — et personne
 * ne s'en apercevrait, puisqu'un courriel qui ne part pas ne laisse aucune
 * trace chez son destinataire.
 *
 * Entre les deux erreurs possibles, on choisit celle qui se répare.
 */

export type FamilleNotification = "essentiel" | "suivi" | "rappels";

/**
 * Le suivi d'une collaboration : où en est-on, et qui joue.
 * Coupable sans rien casser — tout reste dans le produit.
 */
const SUIVI = new Set([
  "deal_proposed",
  "deal_accepted",
  "deal_terms_updated",
  "deal_validated",
  "deal_delivered",
  "deliverable_submitted",
  "deliverable_approved",
  "deliverable_revision_requested",
  "application_received",
  "application_accepted",
  "application_rejected",
  "campaign_invitation",
  "message",
  "review_received",
  "brand_review_received",
  "match",
  "in_kind_declared",
  "affiliate_joined",
  "pixel_sale_to_review",
  "first_affiliate_click",
]);

/**
 * Les relances et les découvertes. C'est la famille qu'on coupe quand on
 * trouve qu'on reçoit trop — et c'est bien celle-là qu'il faut pouvoir
 * couper, plutôt que de tout envoyer en indésirables.
 */
const RAPPELS = new Set([
  "rappel_defile",
  "profile_incomplete_reminder",
  "weekly_digest_creator",
  "welcome",
  "account_onboarding",
]);

/**
 * Tout le reste est essentiel : de l'argent qui bouge, une obligation légale,
 * une échéance dépassée, un compte à relier pour être payé. On ne propose pas
 * de les couper, et on l'explique dans les réglages plutôt que de laisser
 * croire à un oubli.
 */
export function familleDe(type: string): FamilleNotification {
  if (SUIVI.has(type)) return "suivi";
  if (RAPPELS.has(type)) return "rappels";
  return "essentiel";
}

/** La colonne de `profiles` qui commande cette famille, s'il y en a une. */
export function reglageDe(
  famille: FamilleNotification,
): "mails_suivi" | "mails_rappels" | null {
  if (famille === "suivi") return "mails_suivi";
  if (famille === "rappels") return "mails_rappels";
  return null;
}
