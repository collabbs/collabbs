import { extractHandleFromUrl } from "./social-handle";
import type { OfferId } from "@/components/landing/creators";

/**
 * Le questionnaire d'entrée, et la carte qu'il fabrique.
 *
 * ─── Pourquoi un questionnaire plutôt qu'une inscription ───
 * Aujourd'hui le parcours demande une adresse e-mail, un mot de passe, puis
 * cinq étapes de profil — et ce n'est qu'APRÈS tout ça qu'on voit quelque
 * chose. On demande l'effort avant d'avoir montré la valeur.
 *
 * Ici c'est l'inverse : on construit sa carte d'abord, sans compte, et on la
 * lui montre. Le travail demandé est le même ; « réponds à cinq questions » et
 * « remplis ton profil en cinq étapes » ne sont pas la même expérience.
 *
 * ─── Ce que ce module fait, et ne fait pas ───
 * Il ne touche à rien d'existant. Il produit une carte en mémoire, que le
 * navigateur garde et que l'inscription viendra plus tard convertir en vrai
 * profil. Les identifiants de niches, de plateformes et d'offres sont ceux du
 * produit, pas des doublons : une carte doit pouvoir devenir un profil sans
 * traduction.
 */

export type Cote = "creator" | "brand";

/** Clés de stockage navigateur. Versionnées : la forme changera. */
export const CLE_CARTE = "collabbs.carte.v1";
export const CLE_BRIEF = "collabbs.brief.v1";
/**
 * Le côté choisi. Gardé séparément pour qu'un visiteur qui revient ne
 * repasse pas par « tu es une marque ou un créateur ? » — il a déjà répondu.
 */
export const CLE_COTE = "collabbs.cote.v1";
/**
 * Les briefs qui ont intéressé un visiteur pas encore inscrit.
 *
 * Gardés le temps qu'il crée son compte : à l'inscription, l'écran ne dira pas
 * « crée un compte » mais « tes 3 coups de cœur t'attendent ». Ce n'est plus
 * un formulaire, c'est la récupération de quelque chose qu'on possède déjà.
 */
export const CLE_INTERETS = "collabbs.interets.v1";
/** Les créateurs qu'une marque a repérés avant d'avoir un compte. */
export const CLE_REPERAGES = "collabbs.reperages.v1";

/**
 * Tout ce que le parcours d'entrée garde dans le navigateur.
 *
 * Rassemblé ici pour qu'une remise à zéro n'en oublie aucune : effacer la
 * carte sans effacer le côté choisi laisserait quelqu'un coincé dans le
 * questionnaire créateur alors qu'il voulait tout recommencer.
 */
export const CLES_PARCOURS = [
  CLE_CARTE,
  CLE_BRIEF,
  CLE_COTE,
  CLE_INTERETS,
  CLE_REPERAGES,
] as const;

/* ────────────────────────────────────────────────────────────── créateur ── */

/**
 * Tranches d'audience.
 *
 * On demande une tranche et non un nombre exact : personne ne connaît son
 * compte d'abonnés au millier près, et un champ vide est un abandon. Les
 * bornes reprennent le découpage du marché — nano, micro, milieu, macro —
 * qui est aussi celui des paliers de commission du produit.
 */
export const TRANCHES_AUDIENCE = [
  { id: "nano", label: "moins de 10 000", min: 0, max: 9_999, palier: "Nano" },
  { id: "micro", label: "10 000 à 50 000", min: 10_000, max: 49_999, palier: "Micro" },
  { id: "mid", label: "50 000 à 250 000", min: 50_000, max: 249_999, palier: "Milieu" },
  { id: "macro", label: "plus de 250 000", min: 250_000, max: null, palier: "Macro" },
] as const;

export type TrancheId = (typeof TRANCHES_AUDIENCE)[number]["id"];

export type CarteCreateur = {
  cote: "creator";
  /** Pseudo, extrait du lien collé. */
  handle: string | null;
  /** Slug de plateforme : "tiktok", "instagram", "youtube"… */
  plateforme: string | null;
  audience: TrancheId | null;
  niches: string[];
  offres: OfferId[];
  /**
   * Un prix PAR offre, en euros.
   *
   * Un seul « prix d'entrée » était faux : personne ne facture une vidéo UGC
   * au même tarif qu'une vidéo postée sur son propre compte. Et deux des cinq
   * formats — affiliation et performance — ne se facturent pas en euros du
   * tout : ce sont des commissions. Leur demander un prix n'avait aucun sens.
   *
   * Le produit stocke déjà un prix par offre (`creator_offers.price`) : la
   * carte peut donc devenir un vrai profil sans traduction.
   */
  prix: Partial<Record<OfferId, number>>;
};

/**
 * Les formats qui se facturent au forfait.
 *
 * Les deux autres — affiliation, performance — se rémunèrent au pourcentage
 * des ventes. On ne demande donc pas de prix pour eux, et on le dit.
 */
export const OFFRES_AU_FORFAIT: readonly OfferId[] = ["ugc", "post", "story"];

export function carteCreateurVide(): CarteCreateur {
  return {
    cote: "creator",
    handle: null,
    plateforme: null,
    audience: null,
    niches: [],
    offres: [],
    prix: {},
  };
}

/* ────────────────────────────────────────────────────────────── marque ──── */

/**
 * Ce que la marque fabrique n'est PAS une fiche d'entreprise, c'est un brief.
 *
 * Un créateur ne fait pas défiler des logos, il fait défiler des propositions.
 * Demander à une marque son secteur et son site produirait une carte que
 * personne ne regarde ; lui demander ce qu'elle cherche produit une carte sur
 * laquelle on peut se prononcer.
 */
export const MODES_REMUNERATION = [
  { id: "fixe", label: "Un montant fixe" },
  { id: "commission", label: "Une commission sur les ventes" },
  { id: "les-deux", label: "Les deux" },
] as const;

export type ModeRemunerationId = (typeof MODES_REMUNERATION)[number]["id"];

export type CarteMarque = {
  cote: "brand";
  nom: string | null;
  /** Ce que la marque vend, en clair. Pas un secteur dans une liste fermée. */
  produit: string | null;
  formats: OfferId[];
  remuneration: ModeRemunerationId | null;
  /** Montant fixe en euros. */
  montant: number | null;
  /** Pourcentage de commission. */
  commission: number | null;
  /** Échéance au format AAAA-MM-JJ. */
  echeance: string | null;
};

export function carteMarqueVide(): CarteMarque {
  return {
    cote: "brand",
    nom: null,
    produit: null,
    formats: [],
    remuneration: null,
    montant: null,
    commission: null,
    echeance: null,
  };
}

export type Carte = CarteCreateur | CarteMarque;

/* ────────────────────────────────────────────────── lecture d'un lien ───── */

/**
 * Reconnaît la plateforme d'une URL de profil.
 *
 * `extractHandleFromUrl` rend le pseudo mais pas la plateforme, alors que la
 * carte a besoin des deux. On ne duplique pas son travail : on ajoute
 * seulement la reconnaissance du domaine.
 */
const DOMAINES: { motif: RegExp; slug: string }[] = [
  { motif: /tiktok\.com/i, slug: "tiktok" },
  { motif: /instagram\.com/i, slug: "instagram" },
  { motif: /youtube\.com|youtu\.be/i, slug: "youtube" },
  { motif: /(?:twitter|x)\.com/i, slug: "twitter" },
  { motif: /twitch\.tv/i, slug: "twitch" },
  { motif: /linkedin\.com/i, slug: "linkedin" },
  { motif: /snapchat\.com/i, slug: "snapchat" },
  { motif: /facebook\.com/i, slug: "facebook" },
];

export type LectureLien = { handle: string; plateforme: string } | null;

/**
 * Accepte une URL complète, mais aussi ce que les gens collent réellement :
 * « tiktok.com/@moi » sans protocole, ou « @moi » tout court.
 *
 * Un questionnaire qui refuse « @moi » parce qu'il attendait une URL perd la
 * personne à la première question.
 */
export function lireLienProfil(brut: string, plateformeConnue?: string): LectureLien {
  const v = brut.trim();
  if (!v) return null;

  const domaine = DOMAINES.find((d) => d.motif.test(v));
  if (domaine) {
    const handle = extractHandleFromUrl(v.startsWith("http") ? v : `https://${v}`, domaine.slug);
    return handle ? { handle, plateforme: domaine.slug } : null;
  }

  // Pas de domaine reconnu : c'est peut-être un simple pseudo. On ne devine
  // alors pas la plateforme — l'écran la demande séparément.
  const pseudo = v.replace(/^@/, "");
  if (!pseudo || /[\s/]/.test(pseudo)) return null;
  if (!plateformeConnue) return null;
  return { handle: pseudo, plateforme: plateformeConnue };
}

/* ────────────────────────────────────────────────────── avancement ─────── */

export type Avancement = {
  /** De 0 à 100. Ce qui s'affiche pendant qu'on répond. */
  pourcentage: number;
  /** La carte peut-elle être montrée ? */
  montrable: boolean;
  /** Ce qui manque encore, en clair. */
  manquants: string[];
};

/**
 * Une carte est « montrable » dès qu'elle a de quoi ressembler à quelque
 * chose — pas dès qu'elle est complète.
 *
 * La différence est délibérée : on veut pouvoir afficher un aperçu vivant
 * pendant que la personne répond, sinon elle remplit à l'aveugle. La règle de
 * VISIBILITÉ dans le produit, elle, reste `evaluerProfil` et n'est pas touchée
 * ici : une carte montrable n'est pas encore un profil publiable.
 */
export function avancementCreateur(c: CarteCreateur): Avancement {
  const manquants: string[] = [];
  if (!c.handle) manquants.push("ton pseudo");
  if (!c.plateforme) manquants.push("ton réseau");
  if (!c.audience) manquants.push("ta taille d'audience");
  if (c.niches.length === 0) manquants.push("ta niche");
  if (c.offres.length === 0) manquants.push("ce que tu proposes");
  const auForfait = c.offres.filter((o) => OFFRES_AU_FORFAIT.includes(o));
  if (auForfait.length > 0 && auForfait.some((o) => c.prix[o] == null)) {
    manquants.push("tes tarifs");
  }
  const total = 5;
  const faits = total - manquants.length;
  return {
    pourcentage: Math.round((faits / total) * 100),
    montrable: Boolean(c.handle && c.plateforme),
    manquants,
  };
}

export function avancementMarque(c: CarteMarque): Avancement {
  const manquants: string[] = [];
  if (!c.nom) manquants.push("le nom de ta marque");
  if (!c.produit) manquants.push("ce que tu vends");
  if (c.formats.length === 0) manquants.push("le format recherché");
  if (!c.remuneration) manquants.push("comment tu rémunères");
  if (c.remuneration && c.montant === null && c.commission === null) {
    manquants.push("le montant");
  }
  const total = 5;
  const faits = Math.max(0, total - manquants.length);
  return {
    pourcentage: Math.round((faits / total) * 100),
    montrable: Boolean(c.nom && c.produit),
    manquants,
  };
}

/** Libellé de la tranche, pour l'afficher sur la carte. */
export function libelleTranche(id: TrancheId | null): string | null {
  if (!id) return null;
  return TRANCHES_AUDIENCE.find((t) => t.id === id)?.palier ?? null;
}

/**
 * À quelle question reprendre quand quelqu'un revient.
 *
 * Sa carte est dans le navigateur, mais l'étape en cours, elle, ne survit pas
 * au rechargement. Sans ça, on lui redemande son pseudo alors que sa carte
 * l'affiche déjà — il croit avoir tout perdu et il repart.
 *
 * On rend donc la première question restée sans réponse. Une carte terminée
 * rend la dernière étape : on ne renvoie personne dans un questionnaire qu'il
 * a fini.
 */
export function premiereEtapeIncomplete(c: CarteCreateur): number {
  if (!c.handle || !c.plateforme) return 0;
  if (!c.audience) return 1;
  if (c.niches.length === 0) return 2;
  if (c.offres.length === 0) return 3;
  return 4;
}

/**
 * À quelle question reprendre côté marque.
 *
 * Même raison que pour le créateur : le brief survit au rechargement, l'étape
 * en cours non. Sans ça on redemande le nom de la marque à quelqu'un dont la
 * carte l'affiche déjà.
 */
export function premiereEtapeIncompleteMarque(c: CarteMarque): number {
  if (!c.nom || !c.produit) return 0;
  if (c.formats.length === 0) return 1;
  if (!c.remuneration || (c.montant === null && c.commission === null)) return 2;
  return 3;
}

/* ──────────────────────────────────────────────── contenus abîmés ──────── */

/**
 * Réparer une valeur venue du navigateur plutôt que de faire tomber l'écran.
 *
 * Le stockage local survit aux déploiements : quelqu'un qui a répondu à une
 * version antérieure du questionnaire garde une carte d'une forme qui n'existe
 * plus. Il suffit alors qu'un champ attendu comme un tableau soit absent pour
 * qu'un `.map()` lève et que toute la page affiche « Oups ».
 *
 * Ces fonctions ne valident pas : elles RÉPARENT. Un champ inconnu est
 * remplacé par sa valeur par défaut, et la personne reprend son parcours sans
 * rien remarquer. Perdre une réponse est désagréable ; perdre l'écran entier
 * fait fermer l'onglet.
 */

function texteOuNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function nombreOuNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** N'accepte que les chaînes, et ignore le reste. */
export function listeDeTextes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

export function normaliserCarteCreateur(v: unknown): CarteCreateur {
  const base = carteCreateurVide();
  if (!v || typeof v !== "object") return base;
  const o = v as Record<string, unknown>;
  const tranches = TRANCHES_AUDIENCE.map((t) => t.id) as readonly string[];
  return {
    cote: "creator",
    handle: texteOuNull(o.handle),
    plateforme: texteOuNull(o.plateforme),
    audience:
      typeof o.audience === "string" && tranches.includes(o.audience)
        ? (o.audience as TrancheId)
        : null,
    niches: listeDeTextes(o.niches),
    offres: listeDeTextes(o.offres) as OfferId[],
    prix: (() => {
      const brut = o.prix;
      if (!brut || typeof brut !== "object") return {};
      const propre: Partial<Record<OfferId, number>> = {};
      for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
        const n = nombreOuNull(valeur);
        if (n !== null) propre[cle as OfferId] = n;
      }
      return propre;
    })(),
  };
}

export function normaliserCarteMarque(v: unknown): CarteMarque {
  const base = carteMarqueVide();
  if (!v || typeof v !== "object") return base;
  const o = v as Record<string, unknown>;
  const modes = MODES_REMUNERATION.map((m) => m.id) as readonly string[];
  return {
    cote: "brand",
    nom: texteOuNull(o.nom),
    produit: texteOuNull(o.produit),
    formats: listeDeTextes(o.formats) as OfferId[],
    remuneration:
      typeof o.remuneration === "string" && modes.includes(o.remuneration)
        ? (o.remuneration as ModeRemunerationId)
        : null,
    montant: nombreOuNull(o.montant),
    commission: nombreOuNull(o.commission),
    echeance: texteOuNull(o.echeance),
  };
}
