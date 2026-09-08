import "server-only";
import { verifierUrlPublique, MAX_REDIRECTIONS } from "./url-publique";
import { analyserLogo, couleurDominante, type AnalyseLogo, type CouleurLogo } from "./couleur-image";
import { logoOfficiel } from "./logo-officiel";

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
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/**
 * Les en-têtes d'un vrai navigateur, pas seulement son nom.
 *
 * Mesuré : avec le seul `User-Agent`, sephora.fr renvoyait 403 — j'en avais
 * conclu un peu vite que le refus était définitif. Avec la panoplie complète
 * (langue, `Sec-Fetch-*`, `sec-ch-ua`), le même site a répondu 200. Les
 * protections regardent la COHÉRENCE des en-têtes, pas l'agent seul.
 *
 * Ça ne rend pas tout accessible : Decathlon et Leroy Merlin refusent quand
 * même, et Sephora répond une fois sur deux. Mais c'était gratuit, et ça
 * ouvre des sites qu'on croyait fermés.
 */
const ENTETES: Record<string, string> = {
  "User-Agent": AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  "sec-ch-ua": '"Chromium";v="128", "Not)A;Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

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
        headers: ENTETES,
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


/* ══════════════════════════════════════════════ photos de produit ═══════ */

/**
 * Les photos produit d'une boutique Shopify.
 *
 * ─── Pourquoi ça change tout ───
 * L'identité d'un site donne un LOGO. Un logo sur une carte, c'est mieux qu'un
 * aplat, mais ça n'accroche pas l'œil : il n'y a ni humain, ni matière, ni
 * rien à regarder. Les photos produit, elles, montrent des gens qui portent le
 * vêtement, tiennent l'objet, utilisent le service. C'est ce qui fait s'arrêter
 * dans un fil.
 *
 * Shopify expose `/products.json` publiquement, sans authentification, sur
 * toute boutique — et une grande part des marques qui cherchent des créateurs
 * sont dessus. On demande donc, poliment, ce que la boutique publie déjà.
 *
 * ─── Le détail qui décide ───
 * `www.gymshark.com/products.json` répond 403 (protection anti-robot sur le
 * domaine principal) là où `gymshark.com/products.json` répond 200. On essaie
 * donc les deux formes : c'est la différence entre aucune image et cinquante.
 *
 * ─── Ce qu'on ne fait pas ───
 * Aucune image n'est rapatriée : on garde les URL du CDN de la marque. Et on
 * s'arrête à quelques produits — on ne moissonne pas un catalogue.
 */
export async function photosProduit(url: string, combien = 6): Promise<string[]> {
  let origine: URL;
  try {
    origine = new URL(url);
  } catch {
    return [];
  }

  // Sans `www` d'abord : c'est la forme qui passe le plus souvent.
  const hotes = [origine.hostname.replace(/^www\./, ""), origine.hostname];

  for (const hote of [...new Set(hotes)]) {
    const cible = `https://${hote}/products.json?limit=${Math.min(combien * 3, 30)}`;
    const controle = await verifierUrlPublique(cible);
    if (!controle.ok) continue;

    try {
      const r = await fetch(controle.url, {
        redirect: "follow",
        headers: { "User-Agent": AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) continue;
      if (!(r.headers.get("content-type") ?? "").includes("json")) continue;

      const data: unknown = await r.json();
      const produits = (data as { products?: unknown[] })?.products;
      if (!Array.isArray(produits)) continue;

      const images = produits
        .map((p) => {
          const img = (p as { images?: { src?: string }[] })?.images?.[0]?.src;
          return typeof img === "string" ? img : null;
        })
        .filter((src): src is string => src !== null && src.startsWith("https://"));

      if (images.length > 0) return images.slice(0, combien);
    } catch {
      /* boutique injoignable ou format inattendu : on essaie l'autre forme */
    }
  }

  return [];
}


/**
 * Les images d'une page d'accueil, en dernier recours.
 *
 * Toutes les marques ne sont pas sur Shopify. Mais toute page d'accueil de
 * marque est pleine de photos — c'est même sa raison d'être. On les récupère
 * donc directement du HTML quand le catalogue n'est pas exposé.
 *
 * Le tri est l'essentiel : une page contient aussi des pictogrammes, des
 * drapeaux, des logos de moyens de paiement, des pixels de suivi. On écarte
 * donc tout ce qui ressemble à de l'interface, et on ne garde que ce qui a une
 * chance d'être une photo — les CDN d'images ayant l'habitude d'annoncer une
 * largeur dans l'URL, on s'en sert quand elle est là.
 */
const REJETS = /sprite|icon|logo|favicon|badge|flag|payment|placeholder|pixel|1x1|blank|avatar|arrow|chevron|social|\.svg($|\?)/i;

/*
 * ─── Pourquoi `og:image` ne sert PAS de photo de repli ───
 *
 * Essayé, mesuré, retiré. L'idée semblait bonne : `og:image` est choisie par
 * la marque pour se représenter, et angarde.com n'a que celle-là. Une fois en
 * place, sa carte est devenue MOINS bonne que sans — son image de partage est
 * une bannière large avec le nom en gros ; recadrée au format portrait de la
 * carte, il n'en restait qu'un flou gris illisible.
 *
 * C'est le pire cas possible : ne rien trouver, la carte le gère avec son
 * traitement typographique. Trouver une mauvaise image et la mettre en grand,
 * personne ne le rattrape.
 *
 * Ce qui rendrait ce repli utilisable, c'est de connaître les PROPORTIONS de
 * l'image avant de la poser : une bannière 1200×630 se recadre mal, une photo
 * carrée non. Tant qu'on ne les mesure pas, s'abstenir vaut mieux.
 */

export async function imagesDeLaPage(url: string, combien = 6): Promise<string[]> {
  const verdict = await verifierUrlPublique(url);
  if (!verdict.ok) return [];

  let html: string;
  let base: URL;
  try {
    const r = await fetch(verdict.url, {
      redirect: "follow",
      headers: ENTETES,
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    base = new URL(r.url);
    html = (await r.text()).slice(0, 400_000);
  } catch {
    return [];
  }

  const candidats: string[] = [];
  // `src`, mais aussi les attributs de chargement différé : les sites lourds
  // en photos les mettent presque tous en `data-src`, et s'en tenir à `src`
  // ne rendrait que les pictogrammes.
  const motif = /<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(html)) !== null && candidats.length < 120) {
    candidats.push(m[1]);
  }

  // `srcset` et `<source>` : sur les sites récents, `src` ne contient souvent
  // qu'un pixel transparent et TOUTES les vraies adresses sont là. Mesuré sur
  // veja-store.com — cinquante-quatre photos qu'on ne voyait pas.
  const motifJeu = /(?:data-srcset|srcset)=["']([^"']+)["']/gi;
  while ((m = motifJeu.exec(html)) !== null && candidats.length < 240) {
    for (const morceau of m[1].split(",")) {
      // « adresse 2x » ou « adresse 640w » : l'adresse est le premier mot.
      const adresse = morceau.trim().split(/\s+/)[0];
      if (adresse) candidats.push(adresse);
    }
  }

  const vues = new Set<string>();
  const gardees: string[] = [];
  for (const brut of candidats) {
    if (REJETS.test(brut)) continue;
    let abs: string;
    try {
      const u = new URL(brut, base);
      if (u.protocol === "http:") u.protocol = "https:";
      if (u.protocol !== "https:") continue;
      abs = u.toString();
    } catch {
      continue;
    }
    if (vues.has(abs)) continue;
    vues.add(abs);
    gardees.push(abs);
    if (gardees.length >= combien) break;
  }

  return gardees;
}

/**
 * Le visuel d'une marque, par ordre de préférence.
 *
 * C'est la chaîne complète : on essaie du plus riche au plus pauvre, et on
 * s'arrête au premier qui donne quelque chose. Une marque n'a qu'UNE chose à
 * fournir — son adresse — et le reste se débrouille.
 */
export async function visuelsDeMarque(url: string): Promise<string[]> {
  const catalogue = await photosProduit(url);
  if (catalogue.length > 0) return catalogue;

  const page = await imagesDeLaPage(url);
  if (page.length > 0) return page;

  return [];
}

/**
 * Le logo d'un domaine, via le service public de Google.
 *
 * Dernier filet quand le site lui-même est inaccessible. Il répond pour des
 * domaines que nous ne pouvons pas joindre — Decathlon, par exemple, dont la
 * protection bloque aussi bien notre lecture qu'un service de capture d'écran.
 *
 * On demande 256 px : en dessous, c'est un pictogramme, et une carte
 * construite autour d'un pictogramme flou est pire qu'une carte sans image.
 * Ça reste un LOGO, jamais une photo — donc un repli, pas une solution.
 */
export function logoDuDomaine(url: string): string | null {
  try {
    const hote = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    if (!hote) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hote)}&sz=256`;
  } catch {
    return null;
  }
}

/**
 * La couleur de la marque, lue dans les pixels de son logo.
 *
 * ─── Pourquoi passer par le logo ───
 * `theme-color` répond pour les sites qui nous laissent lire leur page. Or
 * c'est précisément sur ceux qui refusent — les grosses enseignes, protection
 * anti-robot — qu'on n'a rien d'autre à montrer. Leur logo, lui, reste
 * joignable par le service de favicons.
 *
 * Ne lève jamais et ne bloque jamais : sans couleur, la carte garde son
 * traitement neutre, exactement comme avant.
 */
export async function analyserLogoDistant(url: string): Promise<AnalyseLogo | null> {
  const octets = await octetsDuLogo(url);
  return octets ? analyserLogo(octets) : null;
}

/** Rapatrie les octets d'un logo, avec les mêmes garde-fous que partout. */
async function octetsDuLogo(urlLogo: string): Promise<Uint8Array | null> {
  const controle = await verifierUrlPublique(urlLogo);
  if (!controle.ok) return null;
  try {
    const r = await fetch(controle.url, {
      redirect: "follow",
      headers: { "User-Agent": AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const octets = new Uint8Array(await r.arrayBuffer());
    return octets.length > 400_000 ? null : octets;
  } catch {
    return null;
  }
}

export async function couleurDuLogo(urlLogo: string): Promise<CouleurLogo | null> {
  const controle = await verifierUrlPublique(urlLogo);
  if (!controle.ok) return null;
  try {
    const r = await fetch(controle.url, {
      redirect: "follow",
      headers: { "User-Agent": AGENT },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    // Une icône dépasse rarement 100 ko. Au-delà, ce n'est pas ce qu'on croit
    // lire, et on ne veut pas décompresser n'importe quoi en mémoire.
    const octets = new Uint8Array(await r.arrayBuffer());
    if (octets.length > 400_000) return null;
    return couleurDominante(octets);
  } catch {
    return null;
  }
}

/**
 * L'identité d'une marque, telle que la carte en a besoin : un logo et une
 * couleur, chacun avec son repli.
 *
 * Écrite parce que le questionnaire et le défilé enchaînaient les mêmes appels
 * chacun de leur côté — et pas tout à fait : le défilé n'essayait pas le
 * service de logos, donc une marque injoignable y perdait son logo alors que
 * le questionnaire le trouvait. Une seule fonction, un seul comportement.
 */
/**
 * Rend ce que la promesse donne, ou le repli passé le délai.
 *
 * La promesse n'est pas annulée — on cesse de l'attendre. Sans conséquence
 * ici : rien n'est écrit, et les requêtes portent déjà leur propre expiration.
 */
async function avecPlafond<T>(promesse: Promise<T>, ms: number, repli: T): Promise<T> {
  return Promise.race([
    promesse.catch(() => repli),
    new Promise<T>((resoudre) => setTimeout(() => resoudre(repli), ms)),
  ]);
}

export type IdentiteMarque = {
  /** Petit, carré : la pastille d'identification. */
  logo: string | null;
  /** La couleur de la marque, au format CSS. */
  couleur: string | null;
  /** Grand, officiel : l'enseigne, montrée en grand faute de photo. */
  enseigne: string | null;
  /** Les traits de l'enseigne sont-ils sombres ? Décide du fond qu'on lui met. */
  enseigneSombre: boolean;
  /**
   * L'enseigne est-elle une icône carrée plutôt qu'une signature large ?
   *
   * Les deux ne se posent pas pareil. Une signature (« DECATHLON ») a besoin
   * d'un panneau clair derrière elle pour se lire. Une icône carrée porte déjà
   * son propre fond : lui ajouter un panneau donne un autocollant collé sur
   * une feuille. Elle se pose donc seule, comme une icône d'application.
   */
  enseigneCarree: boolean;
};

export async function identiteDeMarque(url: string): Promise<IdentiteMarque> {
  // En parallèle : le site peut être lent ou muet, Wikidata n'en dépend pas.
  //
  // ⏱ La lecture du site a son PROPRE plafond, plus court que celui de
  // l'ensemble. Sans lui, un site lent consommait tout le budget et le reste
  // n'avait plus le temps de s'exécuter : petitbateau.fr ressortait sans
  // logo alors que son icône de domaine répond en 200 ms. Un garde-fou qui
  // fait échouer ce qu'il devait protéger.
  const [site, officiel] = await Promise.all([
    avecPlafond(identiteDuSite(url), 4500, VIDE),
    avecPlafond(logoOfficiel(url), 6000, null),
  ]);

  // Deux logos, deux usages. La pastille est un carré de 44 px : un favicon y
  // va bien, une enseigne large y serait illisible. L'enseigne, elle, se
  // montre en grand — c'est elle qui remplace la photo absente.
  const parDomaine = logoDuDomaine(url);
  const logo = site.image ?? parDomaine;

  // La couleur du logo officiel prime.
  //
  // J'avais mis `theme-color` en premier, en me disant que c'était la marque
  // qui l'avait choisie. Mais `theme-color` teinte la barre du navigateur, pas
  // l'identité : beaucoup de sites y mettent un gris neutre. Boulanger en est
  // l'exemple — leur balise donne #434748 quand leur logo, et leur marque,
  // sont orange. La carte devenait grise pour une marque qui ne l'est pas.
  //
  // Le logo officiel ne rend une couleur que lorsqu'il en porte VRAIMENT une
  // (`vive`) : un logo noir ne renvoie rien, et `theme-color` reprend alors
  // la main. L'ordre ne perd donc aucune information, il la hiérarchise.
  let couleur = officiel?.couleur ?? site.couleur ?? null;
  if (!couleur && logo) couleur = (await couleurDuLogo(logo))?.couleur ?? null;

  // Second essai, sur le logo du service de domaines.
  //
  // Le logo que le site expose lui-même est souvent un `.ico` ou un `.svg` —
  // deux formats qu'on ne décode pas. Sans ce rattrapage, Sephora ressortait
  // sans couleur alors que son logo était parfaitement lisible ailleurs : on
  // butait sur le format, pas sur la marque. Le service, lui, rend un PNG.
  if (!couleur && parDomaine && parDomaine !== logo) {
    couleur = (await couleurDuLogo(parDomaine))?.couleur ?? null;
  }

  // ─── Ce qu'on montre EN GRAND ───
  //
  // L'enseigne officielle d'abord. À défaut, le logo du site lui-même : dans
  // la moitié des cas il fait 180 px ou plus (faguo 256, sezane 194, angarde
  // 800×204) et se montre donc parfaitement. On affichait pourtant une simple
  // lettre à sa place — on avait le vrai logo sous la main et on ne s'en
  // servait pas.
  //
  // En dessous de 96 px, on s'abstient : agrandi, un logo devient une tache,
  // et une lettre nette vaut mieux qu'un logo sale.
  let enseigne = officiel?.url ?? null;
  let enseigneSombre = officiel?.sombre ?? false;
  let enseigneCarree = false;

  //
  // Deux candidats, dans l'ordre : le logo que le site expose, puis celui du
  // service de domaines. Le premier est le plus juste, mais on ne sait décoder
  // que le PNG — un logo en JPEG, en ICO ou en SVG n'est pas mesurable, donc
  // pas montrable en grand. C'est ce qui écartait Petit Bateau, dont l'icône
  // de domaine fait pourtant 180 px. Le second candidat rattrape ces cas : le
  // service rend toujours du PNG.
  for (const candidat of [logo, parDomaine]) {
    if (enseigne || !candidat) continue;
    const analyse = await analyserLogoDistant(candidat);
    if (!analyse || analyse.largeur < 96) continue;
    enseigne = candidat;
    enseigneSombre = analyse.sombre;
    // Au-delà de 2,5 fois plus large que haut, c'est une signature, pas une
    // icône : elle se traite comme une enseigne officielle.
    enseigneCarree = analyse.largeur / Math.max(1, analyse.hauteur) < 2.5;
  }

  return { logo, couleur, enseigne, enseigneSombre, enseigneCarree };
}
