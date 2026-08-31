import { lookup } from "dns/promises";

/**
 * Garde-fou contre le SSRF.
 *
 * ─── La faille que ce fichier ferme ───
 * `/api/track/verify-install` va chercher le site de la marque côté serveur
 * pour y constater la présence du script de suivi. L'URL vient de la marque
 * elle-même, et n'importe qui peut créer un compte marque.
 *
 * Sans contrôle, il suffisait d'inscrire `http://169.254.169.254/…` — l'adresse
 * de métadonnées des hébergeurs cloud — ou `http://127.0.0.1:5432` comme site
 * web pour faire interroger le réseau interne PAR NOTRE PROPRE SERVEUR. La
 * réponse n'est pas renvoyée telle quelle, mais le message d'erreur annonce le
 * code HTTP obtenu : de quoi cartographier ce qui écoute et sur quel port. Une
 * faille aveugle reste une faille.
 *
 * ─── Pourquoi les redirections comptent autant que l'URL ───
 * Valider seulement l'adresse saisie ne sert à rien : un domaine public tout à
 * fait ordinaire peut répondre `302` vers `169.254.169.254`. C'est le
 * contournement classique. Chaque saut doit donc être revalidé, ce qui interdit
 * de laisser `fetch` suivre les redirections tout seul.
 *
 * ─── Ce qu'on ne peut pas fermer complètement ───
 * Entre la vérification DNS et la connexion, le nom peut changer de réponse
 * (« DNS rebinding »). S'en protéger vraiment demanderait de se connecter à
 * l'adresse IP vérifiée en portant le nom d'hôte dans l'en-tête, ce que
 * `fetch` ne permet pas. La fenêtre est étroite et le gain pour l'attaquant
 * reste un code HTTP : on l'accepte, mais on l'écrit plutôt que de laisser
 * croire que le trou est bouché.
 */

/** Les ports d'un site web. Tout le reste est un service, pas une vitrine. */
const PORTS_AUTORISES = new Set(["", "80", "443"]);

/**
 * Cette adresse IP appartient-elle à un réseau qu'on n'a rien à joindre ?
 *
 * Séparée du reste pour être testable sans réseau : c'est la règle qui décide,
 * et c'est elle qu'il faut pouvoir vérifier ligne à ligne.
 */
export function estAdresseInterne(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0) return true; // « cette machine »
    if (a === 10) return true; // privé
    if (a === 127) return true; // boucle locale
    if (a === 169 && b === 254) return true; // lien-local, et métadonnées cloud
    if (a === 172 && b >= 16 && b <= 31) return true; // privé
    if (a === 192 && b === 168) return true; // privé
    if (a === 100 && b >= 64 && b <= 127) return true; // partagé opérateur
    if (a >= 224) return true; // multidiffusion et réservé
    return false;
  }

  const v6 = ip.toLowerCase().split("%")[0];
  if (v6 === "::" || v6 === "::1") return true; // indéterminée, boucle locale
  if (v6.startsWith("fe80")) return true; // lien-local
  if (/^f[cd]/.test(v6)) return true; // unique-local
  // Adresse IPv4 déguisée en IPv6 : on retombe sur la règle IPv4, sans quoi
  // `::ffff:127.0.0.1` passerait tranquillement.
  const mappee = v6.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappee) return estAdresseInterne(mappee[1]);
  return false;
}

export type Verdict =
  | { ok: true; url: URL }
  | { ok: false; raison: "schema" | "port" | "dns" | "interne" };

/**
 * Cette URL est-elle joignable sans danger ?
 *
 * La résolution DNS est faite ici, avant toute connexion : c'est le seul
 * moment où l'on sait vers quoi le nom pointe réellement.
 */
export async function verifierUrlPublique(brut: string): Promise<Verdict> {
  let url: URL;
  try {
    url = new URL(brut);
  } catch {
    return { ok: false, raison: "schema" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    // Ferme d'un coup `file://`, `gopher://` et compagnie.
    return { ok: false, raison: "schema" };
  }
  if (!PORTS_AUTORISES.has(url.port)) return { ok: false, raison: "port" };

  let adresses: { address: string }[];
  try {
    adresses = await lookup(url.hostname, { all: true });
  } catch {
    return { ok: false, raison: "dns" };
  }
  if (adresses.length === 0) return { ok: false, raison: "dns" };
  // UNE seule adresse interne suffit à refuser : un nom qui répond à la fois
  // une adresse publique et une adresse locale est précisément le piège.
  if (adresses.some((a) => estAdresseInterne(a.address))) {
    return { ok: false, raison: "interne" };
  }
  return { ok: true, url };
}

/** Nombre de redirections qu'on accepte de suivre, chacune revalidée. */
export const MAX_REDIRECTIONS = 3;
