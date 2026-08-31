/**
 * L'envoi du produit, de l'adresse à la réception.
 *
 * Quatre moments, et un seul acteur attendu à chaque fois. C'est ce qui rend
 * l'écran lisible : à tout instant, une des deux parties sait exactement ce
 * qu'elle a à faire, et l'autre sait qu'elle attend.
 */

export type EtatExpedition =
  /** Le créateur n'a pas encore donné où envoyer. */
  | "adresse_manquante"
  /** L'adresse est là, la marque doit expédier. */
  | "a_expedier"
  /** C'est parti, le créateur attend son colis. */
  | "en_transit"
  /** Reçu : le créateur peut produire. */
  | "recu";

export type DealExpedition = {
  shipping_address?: unknown;
  shipped_at?: string | null;
  received_at?: string | null;
};

export function etatExpedition(deal: DealExpedition): EtatExpedition {
  if (deal.received_at) return "recu";
  if (deal.shipped_at) return "en_transit";
  return adresseLivraison(deal.shipping_address) ? "a_expedier" : "adresse_manquante";
}

/**
 * L'adresse de livraison.
 *
 * `line2`, `phone` et `note` sont facultatifs ; le reste ne l'est pas — une
 * adresse sans code postal ni ville n'est pas une adresse, c'est un brouillon
 * qui fera revenir le colis.
 */
export type Adresse = {
  name: string;
  line1: string;
  line2?: string;
  zip: string;
  city: string;
  country: string;
  phone?: string;
  note?: string;
};

/**
 * Relit l'adresse stockée en `jsonb`.
 *
 * La colonne accepte n'importe quelle forme : on ne fait donc pas confiance à
 * ce qu'on y trouve. Une adresse incomplète est traitée comme absente plutôt
 * que rendue à moitié — un écran qui affiche « 12 rue … , , » ne rend service
 * à personne, et la marque croirait pouvoir expédier.
 */
export function adresseLivraison(valeur: unknown): Adresse | null {
  if (!valeur || typeof valeur !== "object") return null;
  const v = valeur as Record<string, unknown>;
  const texte = (cle: string) => (typeof v[cle] === "string" ? (v[cle] as string).trim() : "");
  const name = texte("name");
  const line1 = texte("line1");
  const zip = texte("zip");
  const city = texte("city");
  const country = texte("country");
  if (!name || !line1 || !zip || !city || !country) return null;
  return {
    name,
    line1,
    line2: texte("line2") || undefined,
    zip,
    city,
    country,
    phone: texte("phone") || undefined,
    note: texte("note") || undefined,
  };
}

/** L'adresse sur une seule ligne, pour la recopier d'un geste. */
export function adresseEnUneLigne(a: Adresse): string {
  return [a.name, a.line1, a.line2, `${a.zip} ${a.city}`, a.country].filter(Boolean).join(", ");
}

/**
 * Lien de suivi public, quand on sait le construire.
 *
 * On ne couvre que les transporteurs les plus courants en France, et on rend
 * `null` pour les autres : un lien fabriqué au hasard qui tombe sur une page
 * d'erreur est pire que pas de lien — le créateur croirait le colis perdu.
 */
export function lienDeSuivi(transporteur: string | null, numero: string | null): string | null {
  if (!transporteur || !numero) return null;
  const n = encodeURIComponent(numero.trim());
  switch (transporteur.trim().toLowerCase()) {
    case "colissimo":
    case "la poste":
      return `https://www.laposte.fr/outils/suivre-vos-envois?code=${n}`;
    case "chronopost":
      return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${n}`;
    case "mondial relay":
      return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${n}`;
    case "dhl":
      return `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${n}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "gls":
      return `https://gls-group.com/FR/fr/suivi-colis?match=${n}`;
    case "dpd":
      return `https://www.dpd.fr/trace/${n}`;
    default:
      return null;
  }
}

/** Transporteurs proposés. « Autre » reste possible en saisie libre. */
export const TRANSPORTEURS = [
  "Colissimo",
  "Chronopost",
  "Mondial Relay",
  "DPD",
  "GLS",
  "UPS",
  "DHL",
  "FedEx",
] as const;
