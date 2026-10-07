import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ce que Shopify nous envoie, et comment on s'assure que c'est bien lui.
 *
 * ─── Pourquoi une signature et pas un secret dans l'URL ───
 * Shopify ne permet pas d'ajouter un en-tête à ses webhooks : impossible donc
 * de réutiliser le `Authorization: Bearer` du postback. Mettre le secret dans
 * l'adresse serait pire — il finirait dans les journaux d'accès de Vercel, des
 * CDN et de tout intermédiaire, et quiconque les lit pourrait fabriquer des
 * ventes.
 *
 * Shopify signe donc chaque envoi : empreinte HMAC-SHA256 du corps brut,
 * encodée en base64, dans l'en-tête `X-Shopify-Hmac-Sha256`. On refait le
 * calcul de notre côté. C'est exactement ce qu'on fait déjà pour Stripe.
 */

/** En-tête qui porte la signature. */
export const EN_TETE_SIGNATURE = "x-shopify-hmac-sha256";
/** En-tête qui dit de quelle boutique vient l'appel. */
export const EN_TETE_BOUTIQUE = "x-shopify-shop-domain";
/** En-tête qui dit de quel évènement il s'agit. */
export const EN_TETE_SUJET = "x-shopify-topic";

/**
 * La signature est-elle la bonne ?
 *
 * Le corps doit être le TEXTE BRUT reçu, pas un objet re-sérialisé : un
 * espace ou un ordre de clés différent change l'empreinte, et toutes les
 * ventes seraient rejetées — en silence, puisqu'un webhook refusé ne se voit
 * nulle part.
 */
export function signatureValide(
  corpsBrut: string,
  signatureRecue: string | null,
  secret: string | null,
): boolean {
  if (!signatureRecue || !secret) return false;
  const attendue = createHmac("sha256", secret).update(corpsBrut, "utf8").digest("base64");
  const a = Buffer.from(attendue);
  const b = Buffer.from(signatureRecue);
  // Longueurs différentes : `timingSafeEqual` lèverait. On répond faux, et on
  // le fait sans comparer caractère par caractère, pour ne pas renseigner un
  // attaquant sur la longueur attendue.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Normalise un domaine de boutique pour la comparaison. */
export function domaineBoutique(valeur: string | null | undefined): string | null {
  const t = (valeur ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return t || null;
}

type AttributDeCommande = { name?: unknown; value?: unknown };

export type CommandeShopify = {
  id?: unknown;
  order_number?: unknown;
  name?: unknown;
  total_price?: unknown;
  current_total_price?: unknown;
  note_attributes?: AttributDeCommande[];
  checkout_token?: unknown;
  created_at?: unknown;
};

/**
 * La référence du créateur, telle qu'elle voyage dans la commande.
 *
 * Le tracker l'écrit dans les attributs du panier ; Shopify les restitue dans
 * `note_attributes`. On ne fait confiance à rien de ce qu'on y trouve : la
 * forme est déclarée par la boutique, pas par nous.
 */
export function referenceDeLaCommande(commande: CommandeShopify): {
  code: string | null;
  clicke: string | null;
} {
  const attrs = Array.isArray(commande.note_attributes) ? commande.note_attributes : [];
  let code: string | null = null;
  let clicke: string | null = null;
  for (const a of attrs) {
    if (!a || typeof a.name !== "string") continue;
    const valeur = typeof a.value === "string" ? a.value.trim() : "";
    if (!valeur) continue;
    if (a.name === "collabbs_ref") code = valeur;
    if (a.name === "collabbs_clicked_at") clicke = valeur;
  }
  return { code, clicke };
}

/**
 * Le montant de la commande, en nombre.
 *
 * Shopify envoie des montants en CHAÎNE (« 629.95 ») et non en nombre. Les
 * lire sans conversion donnerait `NaN` à la première multiplication, et une
 * commission à zéro — sans erreur nulle part.
 */
export function montantDeLaCommande(commande: CommandeShopify): number {
  const brut = commande.current_total_price ?? commande.total_price;
  const n = Number(typeof brut === "string" ? brut.replace(",", ".") : brut);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Le numéro qui identifie cette commande, et une seule.
 *
 * C'est lui qui empêche de payer deux fois la même vente : Shopify réessaie un
 * webhook jusqu'à huit fois s'il n'obtient pas de réponse rapide, et un
 * créateur ne doit pas toucher huit commissions pour une commande.
 */
export function referenceExterne(commande: CommandeShopify): string | null {
  for (const champ of [commande.id, commande.order_number, commande.checkout_token]) {
    if (typeof champ === "number" && Number.isFinite(champ)) return `shopify-${champ}`;
    if (typeof champ === "string" && champ.trim()) return `shopify-${champ.trim()}`;
  }
  return null;
}
