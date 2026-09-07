import "server-only";
import { verifierUrlPublique, MAX_REDIRECTIONS } from "./url-publique";

/**
 * Récupérer l'identité visuelle d'une marque depuis son site.
 *
 * ─── Pourquoi ───
 * La carte d'une campagne était un rectangle de couleur : on ne demande pas de
 * logo au questionnaire, parce que téléverser une image avant d'avoir un
 * compte fait abandonner. Mais une marque donne son adresse en une seconde —
 * et un site expose presque toujours son identité dans son code.
 *
 * ─── Ce qu'on lit, dans l'ordre ───
 * 1. `og:image` — l'image de partage social. La plus grande et la mieux
 *    choisie : c'est celle que la marque a retenue pour se présenter ailleurs.
 * 2. `apple-touch-icon` — 180 px, fond plein, sans transparence. Un vrai logo.
 * 3. `<link rel="icon">` puis `/favicon.ico` — le dernier recours, souvent
 *    minuscule mais toujours présent.
 * 4. `theme-color` — la couleur de la marque. Elle habille la carte même
 *    quand aucune image n'est exploitable.
 *
 * ─── Ce qu'on ne fait PAS ───
 * Aucune image n'est rapatriée ni ré-hébergée : on garde l'URL et le
 * navigateur la charge. Copier le logo d'une marque sur nos serveurs poserait
 * une question de droits qu'on n'a aucune raison de se poser.
 *
 * ─── Sur l'agent utilisateur ───
 * On se présente comme un navigateur. Ce n'est pas anodin, donc c'est écrit
 * ici plutôt que caché : les protections anti-robot des gros sites marchands
 * (Sephora, Decathlon…) renvoient 403 à tout agent inconnu, y compris pour
 * leur favicon. Or on ne parcourt pas un site, on lit UNE page, UNE fois, à la
 * demande de son propre propriétaire qui vient de nous donner son adresse.
 * C'est ce que font tous les aperçus de lien. Certains refuseront quand même,
 * et c'est prévu : on retombe alors sur la carte colorée.
 *
 * ─── Sécurité ───
 * L'adresse vient d'un formulaire public : sans garde-fou, on aurait offert à
 * n'importe qui un moyen de faire émettre des requêtes à notre serveur vers
 * son réseau interne. `verifierUrlPublique` refuse les adresses privées et
 * borne les redirections — c'est le même garde-fou que le suivi d'affiliation.
 */

export type IdentiteSite = {
  /** URL absolue d'une image représentative, ou `null`. */
  image: string | null;
  /** Couleur de thème déclarée par le site, au format CSS. */
  couleur: string | null;
  /** Nom du site tel qu'il se présente (`og:site_name`). */
  nom: string | null;
};

const VIDE: IdentiteSite = { image: null, couleur: null, nom: null };

/** Voir le commentaire d'en-tête : un agent inconnu se fait refuser. */
const AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Dernier recours : le favicon, demandé directement.
 *
 * Un site peut refuser sa page d'accueil et servir son icône, ou l'inverse —
 * les deux cas se produisent en pratique. Tenter les deux double les chances
 * d'avoir quelque chose à montrer.
 */
async function faviconSeul(origine: URL): Promise<string | null> {
  const cible = new URL("/favicon.ico", origine);
  const controle = await verifierUrlPublique(cible.toString());
  if (!controle.ok) return null;
  try {
    const r = await fetch(controle.url, {
      redirect: "follow",
      headers: { "User-Agent": AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    // Un 200 qui renvoie du HTML est une page d'erreur déguisée, pas une icône.
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return controle.url.toString();
  } catch {
    return null;
  }
}

/** Extrait le contenu d'une balise meta, quel que soit l'ordre des attributs. */
function meta(html: string, cle: string): string | null {
  const motifs = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${cle}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${cle}["']`, "i"),
  ];
  for (const m of motifs) {
    const trouve = html.match(m);
    if (trouve?.[1]) return trouve[1].trim();
  }
  return null;
}

/** Extrait le `href` d'un `<link rel="…">`. */
function lien(html: string, rel: string): string | null {
  const motifs = [
    new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]*href=["']([^"']+)["']`, "i"),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*${rel}[^"']*["']`, "i"),
  ];
  for (const m of motifs) {
    const trouve = html.match(m);
    if (trouve?.[1]) return trouve[1].trim();
  }
  return null;
}

/** Une couleur CSS plausible, et rien d'autre : ce texte finit dans du style. */
function couleurPlausible(v: string | null): string | null {
  if (!v) return null;
  const t = v.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return t;
  if (/^rgba?\([\d\s.,%/]+\)$/i.test(t)) return t;
  if (/^[a-z]{3,20}$/i.test(t)) return t.toLowerCase();
  return null;
}

/**
 * Lit l'identité visuelle d'un site.
 *
 * Ne lève jamais : une marque dont le site répond mal ne doit pas être
 * empêchée de publier. On rend simplement ce qu'on a trouvé, et le reste de
 * l'interface se débrouille sans.
 */
export async function identiteDuSite(url: string): Promise<IdentiteSite> {
  const verdict = await verifierUrlPublique(url);
  if (!verdict.ok) return VIDE;

  let html: string;
  let finale: URL;
  try {
    // ⚠️ On suit les redirections À LA MAIN, en revalidant chaque saut.
    //
    // `redirect: "follow"` aurait annulé tout le garde-fou : il suffit qu'un
    // site public réponde une redirection vers une adresse interne pour que
    // notre serveur y aille de lui-même. La vérification d'origine ne protège
    // que le PREMIER appel — c'est exactement ce que `MAX_REDIRECTIONS` et son
    // commentaire « chacune revalidée » prévoyaient dans ce projet.
    let courante = verdict.url;
    let reponse: Response | null = null;

    for (let saut = 0; saut <= MAX_REDIRECTIONS; saut++) {
      const r = await fetch(courante, {
        redirect: "manual",
        headers: {
          "User-Agent": AGENT,
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(6000),
      });

      if (r.status >= 300 && r.status < 400) {
        const suivante = r.headers.get("location");
        if (!suivante) return VIDE;
        const cible = new URL(suivante, courante);
        const controle = await verifierUrlPublique(cible.toString());
        if (!controle.ok) return VIDE;
        courante = controle.url;
        continue;
      }

      reponse = r;
      break;
    }

    if (!reponse || !reponse.ok) {
      // La page est refusée : l'icône passe peut-être quand même.
      const icone = await faviconSeul(verdict.url);
      return icone ? { image: icone, couleur: null, nom: null } : VIDE;
    }
    finale = courante;
    // On ne lit que l'en-tête du document : tout ce qui nous intéresse est
    // dans le `<head>`, et une page de plusieurs mégaoctets n'a aucune raison
    // de traverser le réseau pour trois balises.
    html = (await reponse.text()).slice(0, 120_000);
  } catch {
    const icone = await faviconSeul(verdict.url);
    return icone ? { image: icone, couleur: null, nom: null } : VIDE;
  }

  const absolu = (chemin: string | null): string | null => {
    if (!chemin) return null;
    try {
      const u = new URL(chemin, finale);
      if (u.protocol === "https:") return u.toString();
      if (u.protocol !== "http:") return null;
      // Une image en `http` serait bloquée par le navigateur sur une page
      // servie en `https`. On BASCULE plutôt que de jeter : beaucoup de sites
      // déclarent encore leur `og:image` en http alors que leur hébergeur
      // répond en https depuis longtemps — Gymshark en est un exemple. Si
      // l'adresse sécurisée n'existe pas, l'image ne se chargera pas et la
      // carte retombera sur sa couleur, ce qui est déjà le cas sans elle.
      u.protocol = "https:";
      return u.toString();
    } catch {
      return null;
    }
  };

  const image =
    // `og:image:secure_url` d'abord : quand il existe, c'est la version https
    // que le site déclare lui-même.
    absolu(meta(html, "og:image:secure_url")) ??
    absolu(meta(html, "og:image")) ??
    absolu(meta(html, "twitter:image")) ??
    absolu(lien(html, "apple-touch-icon")) ??
    absolu(lien(html, "icon")) ??
    (await faviconSeul(finale));

  return {
    image,
    couleur: couleurPlausible(meta(html, "theme-color")),
    nom: meta(html, "og:site_name"),
  };
}

export { MAX_REDIRECTIONS };
