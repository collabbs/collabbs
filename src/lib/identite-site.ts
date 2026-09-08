import "server-only";
import { verifierUrlPublique, MAX_REDIRECTIONS } from "./url-publique";
import { analyserLogo, couleurDominante, type AnalyseLogo, type CouleurLogo } from "./couleur-image";
import { logoOfficiel } from "./logo-officiel";
import { convientAUneCarte, dimensionsImage } from "./dimensions-image";
import { luminance, saturation } from "./teinte";

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
  /** URL absolue du LOGO déclaré par le site, ou `null`. */
  image: string | null;
  /** L'image de partage social — une bannière, pas un logo. Candidate photo. */
  partage: string | null;
  /** Toutes les icônes déclarées, de la plus grande à la plus petite. */
  icones: string[];
  /** Couleur de thème déclarée par le site, au format CSS. */
  couleur: string | null;
  /** Nom du site tel qu'il se présente (`og:site_name`). */
  nom: string | null;
};

const VIDE: IdentiteSite = { image: null, partage: null, icones: [], couleur: null, nom: null };

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

/**
 * Demande une version PLUS GRANDE quand l'hébergeur sait en servir une.
 *
 * ─── Le cas qui l'a rendue nécessaire ───
 * cutbyfred.com déclare son logo ainsi :
 *   `/cdn/shop/files/Favicon__Light_mode.png?crop=center&height=32&width=32`
 *
 * La taille est DANS l'adresse. On récupérait donc 32 px, trop petit pour être
 * montré, et la carte tombait sur l'initiale — « le logo ne se met pas tout
 * seul ». Le fichier d'origine est pourtant en haute définition : il suffisait
 * de demander.
 *
 * Shopify accepte `width` et `height` sur toutes ses images. Ça vaut pour une
 * grande partie des boutiques — la plateforme la plus répandue chez les
 * marques qui nous intéressent.
 *
 * Sur les autres hébergeurs on ne touche à rien : inventer des paramètres
 * ferait échouer une adresse qui marchait.
 */
export function versionPlusGrande(url: string, taille = 512): string {
  try {
    const u = new URL(url);
    const estShopify = u.hostname.includes("cdn.shopify.com") || u.pathname.includes("/cdn/shop/");
    if (!estShopify) return url;
    const largeur = Number(u.searchParams.get("width") ?? 0);
    const hauteur = Number(u.searchParams.get("height") ?? 0);
    if (!largeur && !hauteur) return url;

    // ⚠️ On agrandit, on ne déforme pas.
    //
    // Premier essai : `width=512&height=512` sur tout. Ça écrasait la
    // signature de cut by fred, qui fait 1392×223 — et, effet de bord plus
    // sournois, les proportions lues DANS l'adresse devenaient carrées, donc
    // la carte la traitait comme une icône. Un agrandissement doit multiplier,
    // pas imposer.
    if (largeur && hauteur) {
      const facteur = taille / Math.max(largeur, hauteur);
      if (facteur <= 1) return url;
      u.searchParams.set("width", String(Math.round(largeur * facteur)));
      u.searchParams.set("height", String(Math.round(hauteur * facteur)));
    } else {
      u.searchParams.set(largeur ? "width" : "height", String(taille));
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Les images de la page qui se présentent comme le logo de la marque.
 *
 * ─── Pourquoi chercher là ───
 * On ne regardait que les icônes déclarées (`<link rel="icon">`). Or beaucoup
 * de boutiques y mettent une favicon minuscule — cut by fred en a une de
 * 35 px — tout en affichant leur vrai logo dans l'en-tête ou le pied de page.
 * Le logo était sous nos yeux et on ne le cherchait pas.
 *
 * Le mot « logo » dans l'adresse, la classe ou le texte alternatif est ici un
 * signal POSITIF — l'exact inverse du tri des photos, où il sert à écarter.
 * Le même mot ne veut pas dire la même chose selon ce qu'on cherche.
 */
function logosDeLaPage(html: string): string[] {
  const trouves: string[] = [];
  const motif = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(html)) !== null && trouves.length < 8) {
    const balise = m[0];
    if (!/logo/i.test(balise)) continue;
    const src =
      /(?:data-src|src)=["']([^"']+)["']/i.exec(balise)?.[1] ??
      // Certains thèmes ne mettent l'adresse que dans `srcset`.
      /srcset=["']([^"'\s,]+)/i.exec(balise)?.[1];
    if (src) trouves.push(src.replace(/&amp;/g, "&"));
  }
  return trouves;
}

/**
 * Toutes les icônes déclarées par la page, de la plus grande à la plus petite.
 *
 * ─── Pourquoi pas la première ───
 * On prenait le premier `rel="icon"` rencontré. Chez creatikk.io c'est
 * `favicon.svg` — un format qu'on ne décode pas — alors que la même page
 * déclare un `android-chrome-512x512.png`. On se rabattait donc sur l'icône du
 * service de domaines, qui rend du 256 px AGRANDI depuis une petite source :
 * d'où le logo flou signalé.
 *
 * L'attribut `sizes` dit la taille. Quand il manque, le nom du fichier la
 * contient presque toujours (`android-chrome-512x512.png`). À défaut on la
 * suppose petite : mieux vaut sous-estimer un candidat que gonfler un mauvais.
 */
function iconesDeclarees(html: string): { url: string; taille: number }[] {
  const trouvees: { url: string; taille: number }[] = [];
  const motif = /<link\b[^>]*rel=["'][^"']*\bicon\b[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(html)) !== null) {
    const balise = m[0];
    const href = /href=["']([^"']+)["']/i.exec(balise)?.[1];
    if (!href) continue;
    // Le SVG et l'ICO ne se mesurent pas : on ne peut pas décider s'ils sont
    // assez nets pour être montrés en grand.
    if (/\.(svg|ico)($|\?)/i.test(href)) continue;

    const declaree = /sizes=["'](\d+)x\d+["']/i.exec(balise)?.[1];
    const dansLeNom = /(\d{2,4})x\d{2,4}/.exec(href)?.[1];
    trouvees.push({
      url: href,
      taille: Number(declaree ?? dansLeNom ?? 0),
    });
  }
  return trouvees.sort((a, b) => b.taille - a.taille);
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
      return icone ? { ...VIDE, image: icone } : VIDE;
    }
    finale = courante;
    // On ne lit que l'en-tête du document : tout ce qui nous intéresse est
    // dans le `<head>`, et une page de plusieurs mégaoctets n'a aucune raison
    // de traverser le réseau pour trois balises.
    // 600 ko, et pas 120.
    //
    // Les métadonnées tiennent dans les premiers kilo-octets, d'où la borne
    // initiale. Mais le LOGO affiché vit souvent dans le pied de page : celui
    // de cutbyfred.com est à l'octet 539 000 d'une page qui en fait 565 000.
    // On le cherchait dans une portion où il ne pouvait pas être.
    //
    // La page est de toute façon déjà téléchargée ; la borne ne limite que le
    // travail des expressions régulières, qui est négligeable à cette taille.
    html = (await reponse.text()).slice(0, 600_000);
  } catch {
    const icone = await faviconSeul(verdict.url);
    return icone ? { ...VIDE, image: icone } : VIDE;
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

  // ─── LE LOGO N'EST PAS L'IMAGE DE PARTAGE ───
  //
  // `og:image` venait en premier. C'était une erreur de nature : cette balise
  // porte l'image de PARTAGE, celle qui s'affiche quand on colle un lien sur
  // un réseau. C'est presque toujours une bannière ou une illustration — pas
  // un logo. Résultat visible : lemlist se présentait avec un graphique
  // (« Home - Graph URL.png ») et creatikk avec sa bannière d'accueil.
  //
  // Les icônes déclarées, elles, SONT des logos : c'est leur seule raison
  // d'exister. `apple-touch-icon` fait 180 px avec un fond plein, c'est le
  // meilleur candidat ; l'icône classique suit ; la favicon ferme la marche.
  // Les icônes déclarées, de la plus grande à la plus petite, plus le chemin
  // conventionnel de l'icône Apple — souvent présente sur le disque sans être
  // déclarée dans la page, et toujours en 180 px.
  // ⚠️ Les icônes DÉCLARÉES d'abord, les devinées ensuite.
  //
  // `/apple-touch-icon.png` est un chemin conventionnel qu'on tente à
  // l'aveugle : chez respire.co il répond 404. Il devenait pourtant le logo
  // retenu et écrasait l'icône du service de domaines, qui fonctionne — la
  // carte affichait donc l'initiale alors qu'un logo existait.
  //
  // Un chemin deviné reste utile pour l'enseigne, où chaque candidate est
  // téléchargée et mesurée : une adresse morte y est écartée d'elle-même.
  // Mais il ne peut pas servir de logo sans avoir été vérifié.
  const declarees = [
    // ⚠️ Absolu D'ABORD, agrandissement ensuite : `versionPlusGrande` analyse
    // une adresse complète, et échouerait en silence sur `/cdn/shop/...`.
    ...iconesDeclarees(html).map((i) => {
      const abs = absolu(i.url);
      return abs === null ? null : versionPlusGrande(abs);
    }),
    absolu(lien(html, "apple-touch-icon")),
    // Le logo affiché dans la page : une icône déclarée est plus sûre, mais
    // quand elle est minuscule c'est lui qui sauve la carte.
    ...logosDeLaPage(html).map((u) => {
      const abs = absolu(u);
      return abs === null ? null : versionPlusGrande(abs);
    }),
  ].filter((u): u is string => u !== null);

  const devinees = [absolu(new URL("/apple-touch-icon.png", finale).toString())].filter(
    (u): u is string => u !== null,
  );
  const icones = [...declarees, ...devinees];

  // Le logo ne se choisit que parmi ce que le site a DÉCLARÉ.
  const image = declarees[0] ?? (await faviconSeul(finale));

  // L'image de partage n'est pas perdue pour autant : elle rejoint les
  // candidates PHOTO, où elle est jugée sur ses dimensions comme les autres.
  const partage =
    absolu(meta(html, "og:image:secure_url")) ??
    absolu(meta(html, "og:image")) ??
    absolu(meta(html, "twitter:image"));

  return {
    image,
    partage,
    icones,
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

  // L'image de partage rejoint les candidates. Elle avait été essayée puis
  // retirée parce qu'elle produisait des cartes floues — mais c'était avant
  // qu'on sache mesurer : une bannière est désormais écartée sur ses
  // proportions, et une vraie photo de partage passe comme les autres.
  const partage =
    meta(html, "og:image:secure_url") ?? meta(html, "og:image") ?? meta(html, "twitter:image");
  if (partage) candidats.push(partage);

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
/**
 * Lit les premiers octets d'une image — juste son en-tête.
 *
 * On ne rapatrie pas le fichier : les dimensions vivent dans les tout premiers
 * octets. On demande un intervalle, et si le serveur l'ignore on lit le flux
 * par morceaux en s'arrêtant dès qu'on en a assez.
 */
async function enteteImage(url: string, maximum = 65_536): Promise<Uint8Array | null> {
  const controle = await verifierUrlPublique(url);
  if (!controle.ok) return null;
  try {
    const r = await fetch(controle.url, {
      redirect: "follow",
      headers: { "User-Agent": AGENT, Range: `bytes=0-${maximum - 1}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok || !r.body) return null;

    const lecteur = r.body.getReader();
    const morceaux: Uint8Array[] = [];
    let total = 0;
    while (total < maximum) {
      const { done, value } = await lecteur.read();
      if (done || !value) break;
      morceaux.push(value);
      total += value.length;
    }
    // Couper la lecture évite de laisser filer le reste du fichier.
    await lecteur.cancel().catch(() => {});

    const assemble = new Uint8Array(total);
    let o = 0;
    for (const m of morceaux) {
      assemble.set(m, o);
      o += m.length;
    }
    return assemble;
  } catch {
    return null;
  }
}

/**
 * Ne garde que les images qui peuvent réellement porter une carte.
 *
 * ─── Ce que ça corrige ───
 * On affichait n'importe quoi en grand : un pixel de traçage Facebook sur la
 * carte de creatikk.io, `blue_header.png` sur bobochic, `Header_12.png` sur
 * lemlist et pennylane. Tout comptait comme « une photo trouvée » — et la
 * carte était vide ou floue.
 *
 * Filtrer sur le NOM ne pouvait pas marcher : `facebook.com/tr?id=…` ne
 * contient aucun mot suspect, et `Header_12.png` est un nom banal. Les
 * dimensions tranchent : un mouchard fait 1×1, une bannière est trois fois
 * plus large que haute, une photo produit est carrée ou portrait.
 *
 * Les vérifications partent ensemble : une par une, six images feraient six
 * allers-retours en série.
 */
async function garderLesVraiesPhotos(urls: string[], combien: number): Promise<string[]> {
  const verdicts = await Promise.all(
    urls.map(async (u) => {
      const entete = await enteteImage(u);
      return entete && convientAUneCarte(dimensionsImage(entete)) ? u : null;
    }),
  );
  return verdicts.filter((u): u is string => u !== null).slice(0, combien);
}

export async function visuelsDeMarque(url: string): Promise<string[]> {
  // On demande plus de candidats qu'il n'en faut : le tri en écarte beaucoup,
  // et six candidats ne donneraient pas six photos.
  const catalogue = await garderLesVraiesPhotos(await photosProduit(url, 12), 6);
  if (catalogue.length > 0) return catalogue;

  return garderLesVraiesPhotos(await imagesDeLaPage(url, 16), 6);
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

  // ─── UNE COULEUR DE MARQUE, PAS UNE COULEUR DE BARRE ───
  //
  // `theme-color` teinte la barre du navigateur. Beaucoup de sites y mettent
  // du noir ou du gris parce que ça va avec leur interface — creatikk.io
  // déclare #070509. Tant qu'elle passait devant, leur carte restait noire
  // alors que leur logo est un dégradé violet. C'est l'exact defaut signalé :
  // « un gros fond noir, ça donne tout sauf envie ».
  //
  // On ne la jette pas pour autant : quand un site déclare une VRAIE teinte,
  // c'est un choix délibéré et il vaut mieux que ce qu'on devine. On la retient
  // donc seulement si elle est colorée — sinon c'est le logo qui parle.
  const declaree = site.couleur;
  const declareeUtile =
    declaree !== null &&
    saturation(declaree) >= 0.2 &&
    luminance(declaree) > 0.03 &&
    luminance(declaree) < 0.9;

  const duLogo = officiel?.couleur ?? null;
  let couleur = duLogo ?? (declareeUtile ? declaree : null);

  // Faute des deux, on lit les pixels du logo du site.
  for (const candidat of [logo, parDomaine]) {
    if (couleur || !candidat) continue;
    const teinte = await couleurDuLogo(candidat);
    if (teinte?.vive) couleur = teinte.couleur;
  }

  // En dernier recours, la balise même terne : un gris choisi vaut mieux que
  // le gris par défaut de la carte.
  couleur = couleur ?? declaree;

  // ─── Ce qu'on montre EN GRAND ───
  //
  // L'enseigne officielle d'abord. À défaut, le logo du site : dans la moitié
  // des cas il fait 180 px ou plus et se montre parfaitement. En dessous de
  // 96 px on s'abstient — agrandi, un logo devient une tache.
  //
  // Deux candidats, car on ne décode que le PNG : un logo en JPEG, ICO ou SVG
  // n'est pas mesurable. Le service de domaines, lui, rend toujours du PNG.
  let enseigne = officiel?.url ?? null;
  let enseigneSombre = officiel?.sombre ?? false;
  let enseigneCarree = false;

  if (!enseigne) {
    // ⚠️ On garde la PLUS GRANDE, pas la première qui passe.
    //
    // La première suffisante était retenue, et c'était souvent l'icône du
    // service de domaines — qui rend du 256 px agrandi depuis une petite
    // source, donc flou une fois montré en grand. creatikk.io déclare pourtant
    // un `android-chrome-512x512.png` : il fallait aller le chercher.
    //
    // Les candidates sont testées ensemble ; une seule sera affichée, mais on
    // ne sait laquelle qu'après les avoir mesurées.
    const candidates = [...site.icones, logo, parDomaine].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    const uniques = [...new Set(candidates)].slice(0, 6);

    const mesurees = await Promise.all(
      uniques.map(async (url) => ({ url, analyse: await analyserLogoDistant(url) })),
    );

    let meilleure: { url: string; analyse: NonNullable<AnalyseLogo> } | null = null;
    for (const m of mesurees) {
      if (!m.analyse || m.analyse.largeur < 96) continue;
      if (!meilleure || m.analyse.largeur > meilleure.analyse.largeur) {
        meilleure = { url: m.url, analyse: m.analyse };
      }
    }

    if (meilleure) {
      enseigne = meilleure.url;
      enseigneSombre = meilleure.analyse.sombre;
      // Au-delà de 2,5 fois plus large que haut, c'est une signature, pas une
      // icône : elle se traite comme une enseigne officielle.
      enseigneCarree =
        meilleure.analyse.largeur / Math.max(1, meilleure.analyse.hauteur) < 2.5;
    } else {
      // ─── Le vectoriel, faute de mieux ───
      //
      // On écartait les SVG parce qu'on ne sait pas les décoder. C'était
      // confondre deux choses : la mesure sert à savoir si une image sera
      // NETTE une fois agrandie. Un vectoriel l'est toujours — la question ne
      // se pose pas. cut by fred n'a qu'une favicon de 35 px, mais affiche sa
      // signature en SVG dans son pied de page : c'est elle qu'il faut prendre.
      //
      // Ce qu'on ignore, c'est son TON. On la pose donc sur un panneau clair,
      // le pari sûr : la plupart des logos sont dessinés en traits sombres.
      const vectoriel = candidates.find((u) => /\.svg($|\?)/i.test(u));
      if (vectoriel) {
        enseigne = vectoriel;
        enseigneSombre = true;
        // Les proportions se lisent parfois dans l'adresse elle-même.
        const l = Number(/[?&]width=(\d+)/.exec(vectoriel)?.[1] ?? 0);
        const h = Number(/[?&]height=(\d+)/.exec(vectoriel)?.[1] ?? 0);
        enseigneCarree = l > 0 && h > 0 ? l / h < 2.5 : false;
      }
    }
  }

  return { logo, couleur, enseigne, enseigneSombre, enseigneCarree };
}
