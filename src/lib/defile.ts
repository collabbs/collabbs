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
  ["identite-site"],
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
  ["visuels-marque"],
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
export async function briefsDuDefile(): Promise<BriefDefile[]> {
  const admin = createAdminClient();

  const requete = admin
    .from("campaigns")
    .select(
      "id, name, description, requirements, type, fixed_amount, commission_value, commission_nano, commission_macro, spots, ends_at, min_subscribers, product_image_url, brands!inner(name, is_demo, website), campaign_niches(niche_id)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  const [{ data, error }, { data: niches }] = await Promise.all([
    demoDansLeDefile() ? requete : requete.neq("brands.is_demo", true),
    // Les libellés, une fois pour toutes : la carte affiche « Sport », pas
    // l'identifiant 4. Sans ça il n'y avait rien d'utile à montrer, et la
    // carte restait vide aux deux tiers.
    admin.from("niches").select("id, label"),
  ]);

  if (error || !data) return [];
  const libelle = new Map((niches ?? []).map((n) => [n.id, n.label]));

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

  return data.map((c) => ({
    id: c.id,
    marque: c.brands?.name ?? "Une marque",
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
        ? "photo"
        : "logo",
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
    dejaInteressee: false,
  }));
}
