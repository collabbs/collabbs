import "server-only";
import { createAdminClient } from "./supabase/admin";
import { demoDansLeDefile } from "./demo-data";
import { identiteDeMarque, visuelsDeMarque } from "./identite-site";
import { unstable_cache } from "next/cache";

/**
 * L'identité d'un site, mise en cache 24 h.
 *
 * Sans cache, chaque affichage du défilé irait interroger tous les sites des
 * marques : lent pour le visiteur, et impoli pour eux. Une identité visuelle
 * ne change pas d'une heure à l'autre.
 */
const identiteEnCache = unstable_cache(
  async (site: string) => identiteDeMarque(site),
  // La clé porte une version.
  //
  // Les lectures sont gardées 24 h. Sans changer de clé, une correction
  // d'extraction reste invisible une journée entière — on croit avoir livré,
  // et rien ne bouge. Incrémenter la version à chaque correction de lecture
  // écarte les anciennes réponses immédiatement.
  ["identite-site", "v2"],
  { revalidate: 86_400 },
);

/**
 * Les visuels de la marque, mis en cache pour les mêmes raisons.
 *
 * `visuelsDeMarque` essaie du plus riche au plus pauvre : catalogue de la
 * boutique d'abord, images de la page d'accueil ensuite. Mesuré sur huit
 * marques françaises : cinq rendent de vraies images, six rendent quelque
 * chose. Les deux qui ne rendent rien bloquent tout accès automatisé.
 */
const photosEnCache = unstable_cache(
  async (site: string) => visuelsDeMarque(site),
  ["visuels-marque", "v2"],
  { revalidate: 86_400 },
);

/**
 * Le paquet du défilé, côté créateur : des briefs, pas des marques.
 *
 * ─── Pourquoi des briefs ───
 * Si la marque défile sur des créateurs et le créateur sur des marques, le
 * créateur ouvre le défilé et voit UNE marque — il ferme et ne revient pas. Un
 * brief, lui, se renouvelle : une marque en publie plusieurs, ils ont une date,
 * et on se prononce sur du concret plutôt que sur un logo.
 *
 * ─── Pourquoi la clé de service ───
 * Le défilé est public, sans compte : c'est la condition pour qu'il fasse
 * venir du monde. Les campagnes ne sont pas lisibles par un client anonyme via
 * RLS, et il n'est pas question d'ouvrir la table. On lit donc côté serveur et
 * on ne renvoie au navigateur QUE ce qui s'affiche sur une carte — jamais
 * l'identifiant de la marque, ses coordonnées ou ses réglages.
 */

export type BriefDefile = {
  id: string;
  marque: string;
  /**
   * Cette campagne appartient-elle à une marque de démonstration ?
   *
   * `is_demo` était déjà lu par la requête, mais seulement pour FILTRER : il
   * ne montait pas jusqu'à la carte. Les fiches de créateurs fictifs portent
   * un badge « Exemple » depuis le 3 septembre, et son commentaire dit
   * pourquoi — « le visiteur doit savoir en un coup d'œil qu'il regarde à quoi
   * ressemblera la plateforme, pas ce qui s'y trouve déjà ». Le raisonnement
   * vaut mot pour mot dans l'autre sens, et le badge manquait.
   */
  estExemple: boolean;
  produit: string | null;
  type: string;
  /** Montant fixe en euros, si la campagne en propose un. */
  montant: number | null;
  /**
   * Commission en pourcentage. `min`/`max` diffèrent quand la campagne paie
   * par paliers selon la taille du créateur.
   */
  commission: { min: number; max: number } | null;
  /** Intitulé de la campagne. Sert de titre à la fiche détaillée. */
  titre: string | null;
  /** Attentes de la marque, en clair. Uniquement lues sur la fiche. */
  exigences: string | null;
  /** Date de fin, au format AAAA-MM-JJ. */
  echeance: string | null;
  /** Audience minimale demandée, s'il y en a une. */
  audienceMini: number | null;
  spots: number | null;
  /** Intitulés des niches visées, résolus côté serveur. */
  niches: string[];
  /**
   * Image tirée du site de la marque, s'il en expose une.
   *
   * C'est ce qui remplit le haut de la carte, qui n'était qu'un aplat de
   * couleur. On ne demande pas de logo au questionnaire — téléverser avant
   * d'avoir un compte fait abandonner — mais une adresse se donne en une
   * seconde. Voir `identite-site`.
   */
  image: string | null;
  /** Couleur de thème du site, quand il en déclare une. */
  couleurMarque: string | null;
  /** L'enseigne officielle, en grand : ce qui remplace la photo quand il n'y en a pas. */
  enseigne: string | null;
  /** Ses traits sont-ils sombres ? Décide du fond sur lequel on la pose. */
  enseigneSombre: boolean;
  /** Icône carrée (posée seule) plutôt que signature large (posée sur panneau). */
  enseigneCarree: boolean;
  /** Le modèle choisi par la marque : photo pleine carte, ou marque encadrée. */
  modele: "photo" | "logo";
  /**
   * Photos produit de la marque, quand sa boutique les publie.
   *
   * C'est le seul élément qui donne vraiment envie de s'arrêter : un logo
   * identifie, une photo montre des gens qui portent, tiennent, utilisent.
   * Vide quand la marque n'est pas sur une boutique qui les expose — la carte
   * retombe alors sur son traitement graphique.
   */
  photos: string[];
  /**
   * La marque a-t-elle déjà marqué son intérêt pour ce créateur ?
   *
   * C'est la SEULE chose qui déclenche un match. Faux pour l'instant : un
   * visiteur anonyme n'a pas de profil, donc aucune marque ne peut l'avoir
   * repéré. Le champ existe parce que le jour où le repérage sera notifié
   * (`toggleSaveCreator`), c'est ici qu'il se branchera — et parce qu'un match
   * fabriqué serait une promesse de réponse qui ne viendrait jamais.
   */
  dejaInteressee: boolean;
};

/**
 * Les campagnes ouvertes, telles qu'un visiteur non connecté peut les voir.
 *
 * Même filtre que `/opportunities` : les marques de démonstration restent
 * masquées en production. Une carte qui ne peut jamais répondre est pire
 * qu'une carte absente — le visiteur investit un geste dans le vide.
 */
/** Ce qu'on envoie au navigateur. Le paquet du jour en fait 12 ; on en garde
 *  d'avance pour que les cartes déjà vues puissent être écartées sans vider
 *  l'écran. */
const TAILLE_PAQUET = 50;
/** Ce qu'on lit par passage. Sous la marche des ~350 lignes de PostgREST. */
const TAILLE_PASSAGE = 200;
/** Au plus 2 000 campagnes parcourues. Quelqu'un qui en a vu autant a vu le
 *  catalogue ; aller plus loin coûterait plus que ça ne rapporte. */
const PASSAGES_MAX = 10;

/** Un passage de campagnes actives publiques, du plus récent au plus ancien. */
function lireUnPassage(admin: ReturnType<typeof createAdminClient>, passage: number) {
  const requete = admin
    .from("campaigns")
    .select(
      "id, brand_id, name, description, requirements, type, fixed_amount, commission_value, commission_nano, commission_macro, spots, ends_at, min_subscribers, product_image_url, brands!inner(name, is_demo, website), campaign_niches(niche_id)",
    )
    .eq("status", "active")
    .eq("privee", false)
    /* ⚠️ `id` en second critère, et ce n'est pas cosmétique.
       Des campagnes publiées dans la même seconde partagent `created_at`, et
       Postgres n'est pas tenu de rendre deux fois le même ordre entre des
       lignes à égalité : en lisant par `.range()`, un ordre instable fait
       sauter des briefs d'une page à l'autre et en double d'autres. Mesuré le
       23/10/2026 sur le projet de développement, en parcourant 1 245
       campagnes par pages de 200 sans ce second critère : 1 101 distinctes et
       144 doublons — donc 144 campagnes, un brief sur neuf, que le défilé ne
       proposait jamais à personne. Avec `id` : 1 245 distinctes, 0 doublon. */
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(passage * TAILLE_PASSAGE, passage * TAILLE_PASSAGE + TAILLE_PASSAGE - 1);
  return demoDansLeDefile() ? requete : requete.neq("brands.is_demo", true);
}

/** Les cartes que cette personne a déjà écartées, d'où qu'elle vienne. Sans
 *  cette lecture, le paquet repart de zéro sur un second appareil et lui
 *  remontre ce qu'elle a déjà vu. */
async function cartesDejaVues(
  admin: ReturnType<typeof createAdminClient>,
  createurId?: string,
): Promise<Set<string>> {
  if (!createurId) return new Set();
  const { data } = await admin
    .from("cartes_vues")
    .select("cible_id")
    .eq("viewer_id", createurId);
  return new Set((data ?? []).map((v) => v.cible_id));
}

/** Les marques qui ont déjà retenu CE créateur : c'est ce qui rend le match
 *  possible. Ne se sait qu'une fois connecté. */
async function marquesQuiOntRetenu(
  admin: ReturnType<typeof createAdminClient>,
  createurId?: string,
): Promise<Set<string>> {
  if (!createurId) return new Set();
  const { data } = await admin
    .from("brand_creator_saves")
    .select("brand_id")
    .eq("creator_id", createurId);
  return new Set((data ?? []).map((r) => r.brand_id));
}

/**
 * Le paquet, avec la réciprocité RÉELLE quand on sait qui regarde.
 *
 * ─── Pourquoi ce paramètre ───
 * `dejaInteressee` déclenche l'écran de match. Il était figé à `false` : la
 * mécanique existait, câblée nulle part, donc aucun match n'a jamais eu lieu.
 * On a longtemps hésité à en simuler un — c'eût été promettre une réponse qui
 * ne viendrait pas.
 *
 * La vraie réciprocité existe pourtant : une marque qui a retenu un créateur
 * l'a écrit dans `brand_creator_saves`. Si ce créateur aime ensuite une de ses
 * campagnes, c'est un match, au sens plein — les deux se sont choisis.
 *
 * Ça ne peut se savoir qu'une fois connecté : un visiteur anonyme n'a pas
 * d'identité à croiser. Le match devient donc une raison d'avoir un compte,
 * au lieu d'un artifice pour en faire créer un.
 */
export async function briefsDuDefile(createurId?: string): Promise<BriefDefile[]> {
  const admin = createAdminClient();

  /* ─── CE QUE LA PERSONNE A DÉJÀ VU SE LIT AVANT, PAS APRÈS ───

     La requête demandait les 50 campagnes les plus récentes, et les cartes
     déjà vues étaient retirées ENSUITE. Un créateur qui avait fait défiler
     ces 50 obtenait donc un paquet vide, et l'écran de fin lui annonçait
     « Tu as tout vu » — mesuré le 23/10/2026 sur le projet de développement
     avec 874 campagnes actives publiques en base, dont 824 qu'il n'avait
     jamais vues. L'écran affirmait le contraire de la vérité, et le créateur
     n'avait aucune raison de revenir.

     On ne peut pas non plus exclure les vues dans la requête : la liste
     repartirait dans l'URL, et au-delà de ~350 UUID elle coûte huit secondes
     (voir `par-tranches.ts`) — le problème se déplacerait, il ne
     disparaîtrait pas.

     On balaie donc par passages, du plus récent au plus ancien, en s'arrêtant
     dès qu'on a de quoi remplir un paquet. Anonyme, `dejaVues` est vide : un
     seul passage, exactement comme avant. */
  const [{ data: niches }, dejaVues, marquesInteressees] = await Promise.all([
    // Les libellés, une fois pour toutes : la carte affiche « Sport », pas
    // l'identifiant 4. Sans ça il n'y avait rien d'utile à montrer, et la
    // carte restait vide aux deux tiers.
    admin.from("niches").select("id, label"),
    cartesDejaVues(admin, createurId),
    marquesQuiOntRetenu(admin, createurId),
  ]);
  const libelle = new Map((niches ?? []).map((n) => [n.id, n.label]));

  const data: NonNullable<Awaited<ReturnType<typeof lireUnPassage>>["data"]> = [];
  // Une campagne publiée entre deux passages décale la fenêtre et peut
  // ramener un brief déjà pris. Deux fois la même carte, et le créateur la
  // revoit après l'avoir écartée.
  const dejaPris = new Set<string>();
  for (let passage = 0; passage < PASSAGES_MAX; passage++) {
    const { data: lot, error } = await lireUnPassage(admin, passage);
    if (error || !lot) break;
    for (const c of lot) {
      if (!dejaVues.has(c.id) && !dejaPris.has(c.id)) {
        dejaPris.add(c.id);
        data.push(c);
      }
      if (data.length >= TAILLE_PAQUET) break;
    }
    // Un lot incomplet veut dire qu'on a touché le fond de la table.
    if (data.length >= TAILLE_PAQUET || lot.length < TAILLE_PASSAGE) break;
  }
  if (data.length === 0) return [];

  // Une seule lecture par site, en parallèle : plusieurs campagnes d'une même
  // marque ne doivent pas déclencher plusieurs requêtes.
  const sites = [
    ...new Set(
      data
        .map((c) => c.brands?.website)
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0),
    ),
  ];
  const identites = new Map(
    await Promise.all(
      sites.map(async (site) => [site, await identiteEnCache(site)] as const),
    ),
  );
  const photos = new Map(
    await Promise.all(sites.map(async (site) => [site, await photosEnCache(site)] as const)),
  );

  const briefs: BriefDefile[] = data.map((c) => ({
    id: c.id,
    marque: c.brands?.name ?? "Une marque",
    estExemple: Boolean(c.brands?.is_demo),
    // La carte n'en montre que deux lignes, mais la FICHE a besoin du texte
    // entier : on ne tronque donc plus ici. Une campagne dont on ne peut pas
    // lire les attentes ne se choisit pas.
    produit: c.description ?? null,
    titre: c.name ?? null,
    exigences: c.requirements ?? null,
    echeance: c.ends_at ?? null,
    audienceMini: c.min_subscribers != null ? Number(c.min_subscribers) : null,
    type: c.type ?? "video",
    montant: c.fixed_amount != null ? Number(c.fixed_amount) : null,
    // Une campagne à paliers n'a pas de `commission_value` : elle porte un taux
    // par tranche d'audience. Sans ce repli, sa carte s'affichait SANS AUCUN
    // montant — et une carte sans rémunération est une carte qu'on passe.
    commission: (() => {
      const bornes = [c.commission_value, c.commission_nano, c.commission_macro]
        .filter((v): v is number => v != null)
        .map(Number);
      if (bornes.length === 0) return null;
      return { min: Math.min(...bornes), max: Math.max(...bornes) };
    })(),
    spots: c.spots ?? null,
    niches: (c.campaign_niches ?? [])
      .map((n) => libelle.get(n.niche_id))
      .filter((l): l is string => Boolean(l)),
    image: c.brands?.website ? (identites.get(c.brands.website)?.logo ?? null) : null,
    couleurMarque: c.brands?.website
      ? (identites.get(c.brands.website)?.couleur ?? null)
      : null,
    enseigne: c.brands?.website ? (identites.get(c.brands.website)?.enseigne ?? null) : null,
    enseigneSombre: c.brands?.website
      ? (identites.get(c.brands.website)?.enseigneSombre ?? false)
      : false,
    enseigneCarree: c.brands?.website
      ? (identites.get(c.brands.website)?.enseigneCarree ?? false)
      : false,
    // ⚠️ Une photo trouvée vaut choix de la photo.
    //
    // La règle était : modèle photo SEULEMENT si la marque avait téléversé son
    // image. Conséquence — quarante cartes de démo avaient de vraies photos
    // extraites de leur site, et pas une seule ne les affichait : le modèle
    // « logo » les jetait. Les photos étaient bien dans la page, invisibles.
    //
    // Le modèle dit quel est le SUJET quand il y a le choix. S'il y a une
    // image, quelle que soit sa provenance, c'est elle le sujet — une photo
    // dit toujours plus qu'un logo.
    modele:
      c.product_image_url ||
      (c.brands?.website && (photos.get(c.brands.website) ?? []).length > 0)
        ? ("photo" as const)
        : ("logo" as const),
    /* ─── L'IMAGE CHOISIE PASSE DEVANT ───

       Le défilé ne lisait QUE le site de la marque. L'image qu'elle avait
       elle-même retenue au questionnaire — obligatoire pour publier, stockée
       dans `product_image_url` — n'arrivait jamais jusqu'ici : la carte
       re-scrutait le site et ignorait le choix.

       Conséquence : la règle « pas de campagne sans visuel » ne servait à
       rien pour les marques dont on ne sait rien lire. Elles donnaient une
       photo, et la carte affichait quand même son repli. C'est exactement le
       cas qu'elle devait couvrir.

       Sa photo d'abord, donc, puis celles du site en renfort. */
    photos: [
      ...(typeof c.product_image_url === "string" && c.product_image_url.trim()
        ? [c.product_image_url.trim()]
        : []),
      ...(c.brands?.website ? (photos.get(c.brands.website) ?? []) : []),
    ],
    dejaInteressee: marquesInteressees.has(c.brand_id ?? ""),
  }));

  /* ─── LES CARTES QUI PORTENT UNE PHOTO PASSENT DEVANT ───

     Le paquet suivait l'ordre de création. Les six dernières campagnes créées
     étaient celles de marques sans photo exploitable — donc les six premières
     cartes du défilé étaient les plus pauvres, et on jugeait le produit
     là-dessus : « y en a absolument aucune avec photo ».

     Un paquet s'ouvre sur ce qu'il a de meilleur. Ça ne cache rien : les
     cartes sans photo restent dans le paquet, elles passent après. */
  // Plus de `.filter(!dejaVues.has(…))` ici : l'exclusion se fait pendant le
  // balayage, sinon elle vide le paquet au lieu de le renouveler.
  return briefs
    .sort((a, b) => {
      const forceA = a.photos.length > 0 ? 2 : a.enseigne ? 1 : 0;
      const forceB = b.photos.length > 0 ? 2 : b.enseigne ? 1 : 0;
      return forceB - forceA;
    });
}
