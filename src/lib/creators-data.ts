import "server-only";
import { profilVisible } from "@/lib/profil-visible";
import { createClient } from "@/lib/supabase/server";
import { OFFER_TYPES, type OfferId } from "@/components/landing/creators";
import { demoCreatorsVisible } from "./demo-data";
import { parTranches } from "./par-tranches";

// Source de vérité = Supabase. Les démos seedées (is_demo) et les vrais
// inscrits qui ont complété leur profil apparaissent ici, sans distinction.

const OFFER_ORDER = OFFER_TYPES.map((o) => o.id) as OfferId[];

const TINTS = [
  "linear-gradient(135deg,#f9a8d4,#c084fc)",
  "linear-gradient(135deg,#67e8f9,#3b82f6)",
  "linear-gradient(135deg,#fdba74,#ec4899)",
  "linear-gradient(135deg,#fcd34d,#ef4444)",
  "linear-gradient(135deg,#c4b5fd,#e879f9)",
  "linear-gradient(135deg,#6ee7b7,#14b8a6)",
  "linear-gradient(135deg,#7dd3fc,#818cf8)",
  "linear-gradient(135deg,#86efac,#22d3ee)",
];
function tintFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}
function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
/**
 * Le « à partir de » d'un créateur.
 *
 * ─── Le défaut que ça répare ───
 * Cette valeur se calculait uniquement depuis `creators.rate_video`,
 * `rate_mention` et `rate_pack`. Or **aucun formulaire n'écrit jamais ces
 * trois colonnes** : elles ne sont que lues. Seuls les profils de
 * démonstration en ont, parce qu'ils ont été insérés directement en base.
 *
 * Résultat en production : 22 des 24 profils de démonstration affichaient un
 * tarif, et zéro des créateurs réels. Une marque qui parcourt la marketplace
 * voyait donc des prix partout SAUF chez les vraies personnes — et le seul
 * créateur qui avait pris la peine de renseigner ses tarifs dans son profil ne
 * les voyait apparaître nulle part.
 *
 * On lit maintenant d'abord ce que le créateur a réellement saisi
 * (`creator_offers.price`), et les anciennes colonnes ne servent plus que de
 * repli — ce qui laisse les profils de démonstration inchangés.
 */
function prixAPartirDe(
  prixDesOffres: Record<string, number | null> | undefined,
  rateVideo: number | null,
  rateMention: number | null,
  ratePack: number | null,
): number | null {
  const saisis = Object.values(prixDesOffres ?? {}).filter(
    (v): v is number => v != null && v > 0,
  );
  if (saisis.length) return Math.min(...saisis);
  const rates = [rateVideo, rateMention, ratePack].filter(
    (v): v is number => v != null && v > 0,
  );
  return rates.length ? Math.min(...rates) : null;
}
function orderOffers(offers: string[]): OfferId[] {
  const set = new Set(offers);
  return OFFER_ORDER.filter((o) => set.has(o));
}

export type MarketplaceCreator = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  platform: string;
  platformSlug: string;
  followers: string;
  engagement: string;
  priceFrom: number | null;
  offers: OfferId[];
  /** `null` tant que le créateur n'a reçu aucun avis — jamais une note inventée. */
  rating: number | null;
  photo: string;
  tint: string;
  niches: string[];
  platformLabels: string[];
  /** Signaux de qualité dérivés des données pour les badges sur la card. */
  isTop: boolean;
  isVerified: boolean;
  isNew: boolean;
  /** Fiche de démonstration : la carte l'annonce au visiteur. */
  isDemo: boolean;
  /** Ville affichée telle que saisie. */
  city: string | null;
  /** Forme normalisée, pour filtrer. */
  citySlug: string | null;
  /** Accepte de se déplacer hors de sa ville. */
  travels: boolean;
  reviewsCount: number;
};

type CreatorRow = {
  id: string;
  handle: string | null;
  rating: number | null;
  engagement: number | null;
  rate_video: number | null;
  rate_mention: number | null;
  rate_pack: number | null;
  verified: boolean | null;
  deals_count: number | null;
  reviews_count: number | null;
  created_at: string | null;
  is_demo: boolean | null;
};

async function loadRelations(ids: string[]) {
  const supabase = await createClient();
  /* ⚠️ `parTranches` et NON un `.in(ids)` direct.
     Au-delà d'environ 300 identifiants, PostgREST met huit secondes là où il
     en met cent millisecondes — l'URL de la requête dépasse une taille au-delà
     de laquelle elle n'est plus servie normalement. Mesuré avec 500 créateurs
     en base : cet appel-ci faisait à lui seul 8 s, et l'annuaire 16,8 s. Le
     détail des mesures est dans `lib/par-tranches`. */
  const [profs, cps, cns, cos, platRes, nicheRes] = await Promise.all([
    parTranches(ids, (t) =>
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", t),
    ),
    // Les colonnes de vérification arrivent avec la migration 0037. Si elle
    // n'est pas encore appliquée, la requête échouerait et — le gating exigeant
    // au moins un réseau — la marketplace se viderait SILENCIEUSEMENT. On
    // retente donc sans ces colonnes plutôt que de tout perdre.
    parTranches(ids, (t) =>
      supabase
        .from("creator_platforms")
        .select("creator_id, platform_id, subscribers, handle, url, verified_at, verified_source")
        .in("creator_id", t)
        .then(async (res) => {
          if (!res.error) return res;
          console.warn(
            "[creators-data] colonnes de vérification absentes — repli sans elles. Applique la migration 0037.",
          );
          return supabase
            .from("creator_platforms")
            .select("creator_id, platform_id, subscribers, handle, url")
            .in("creator_id", t);
        }),
    ),
    parTranches(ids, (t) =>
      supabase.from("creator_niches").select("creator_id, niche_id").in("creator_id", t),
    ),
    parTranches(ids, (t) =>
      supabase.from("creator_offers").select("creator_id, offer, price").in("creator_id", t),
    ),
    supabase.from("platforms").select("id, label, slug"),
    supabase.from("niches").select("id, label"),
  ]);
  // `parTranches` rend déjà les lignes : on garde la forme attendue plus bas.
  const profsRes = { data: profs };
  const cpsRes = { data: cps };
  const cnsRes = { data: cns };
  const cosRes = { data: cos };

  const platMap = new Map(
    (platRes.data ?? []).map((p) => [p.id, { label: p.label, slug: p.slug }]),
  );
  const nicheMap = new Map((nicheRes.data ?? []).map((n) => [n.id, n.label]));
  const profMap = new Map((profsRes.data ?? []).map((p) => [p.id, p]));

  const platsBy = new Map<
    string,
    {
      label: string;
      slug: string;
      subs: number;
      handle: string | null;
      url: string | null;
      /** Date à laquelle l'audience a été constatée auprès de la plateforme. */
      verifiedAt: string | null;
      verifiedSource: string | null;
    }[]
  >();
  for (const cp of cpsRes.data ?? []) {
    const p = platMap.get(cp.platform_id);
    if (!p) continue;
    const arr = platsBy.get(cp.creator_id) ?? [];
    arr.push({
      label: p.label,
      slug: p.slug,
      subs: cp.subscribers ?? 0,
      handle: cp.handle ?? null,
      url: cp.url ?? null,
      verifiedAt: (cp as { verified_at?: string | null }).verified_at ?? null,
      verifiedSource: (cp as { verified_source?: string | null }).verified_source ?? null,
    });
    platsBy.set(cp.creator_id, arr);
  }
  const nichesBy = new Map<string, string[]>();
  for (const cn of cnsRes.data ?? []) {
    const label = nicheMap.get(cn.niche_id);
    if (!label) continue;
    const arr = nichesBy.get(cn.creator_id) ?? [];
    arr.push(label);
    nichesBy.set(cn.creator_id, arr);
  }
  const offersBy = new Map<string, string[]>();
  // Map créateur → offre → prix (pour exposer le prix réel de chaque offre
  // sur la fiche publique, vs un priceFrom = min global qui mentait).
  const offerPriceBy = new Map<string, Record<string, number | null>>();
  for (const co of cosRes.data ?? []) {
    const arr = offersBy.get(co.creator_id) ?? [];
    arr.push(co.offer);
    offersBy.set(co.creator_id, arr);
    const priceMap = offerPriceBy.get(co.creator_id) ?? {};
    priceMap[co.offer] = co.price ?? null;
    offerPriceBy.set(co.creator_id, priceMap);
  }

  return { profMap, platsBy, nichesBy, offersBy, offerPriceBy };
}

const CHAMPS_CARTE =
  "id, handle, rating, engagement, rate_video, rate_mention, rate_pack, verified, deals_count, reviews_count, created_at, city, city_slug, travels, is_demo";

/**
 * Une page de fiches créateurs, les mieux notées d'abord.
 *
 * `de`/`a` sont inclusifs, comme `.range()`. Les profils de démonstration
 * peuplent l'annuaire tant que les vrais créateurs ne sont pas arrivés : un
 * catalogue à une seule fiche ne convertit personne. Voir
 * `demoCreatorsVisible` pour le raisonnement et le risque assumé.
 */
async function lireFiches(de?: number, a?: number): Promise<CreatorRow[]> {
  const supabase = await createClient();
  /* ⚠️ `id` en second critère, et ce n'est pas cosmétique.
     Tous les créateurs sans avis ont une note NULLE. Un tri sur la seule
     colonne `rating` les laisse donc tous à égalité, et Postgres n'est pas
     tenu de rendre deux fois le même ordre entre des lignes à égalité. Dès
     qu'on lit par `.range()`, un ordre instable fait SAUTER des fiches d'une
     page à l'autre et en DOUBLE d'autres. Mesuré le 23/10/2026 sur le projet
     de développement, en parcourant la table par pages de 200 sans ce second
     critère : 502 lignes lues, 499 distinctes, 3 doublons — donc 3 créateurs
     que le défilé ne proposait jamais. Un critère unique en second rend le
     découpage reproductible : 502 lues, 502 distinctes, 0 doublon. */
  let requete = supabase
    .from("creators")
    .select(CHAMPS_CARTE)
    .order("rating", { ascending: false })
    .order("id", { ascending: true });
  if (de !== undefined && a !== undefined) requete = requete.range(de, a);
  const { data } = demoCreatorsVisible() ? await requete : await requete.neq("is_demo", true);
  return (data ?? []) as CreatorRow[];
}

/** Carte marketplace : créateurs « complets » (photo, réseau, niche, offre). */
export async function getMarketplaceCreators(): Promise<MarketplaceCreator[]> {
  return construireCartes(await lireFiches());
}

/**
 * Transforme des fiches en cartes, en écartant les profils incomplets.
 *
 * Le tri des réseaux, la note, les badges et la règle de visibilité vivent
 * ici et nulle part ailleurs : l'annuaire, la shortlist et le défilé doivent
 * montrer EXACTEMENT les mêmes créateurs, sinon une marque voit dans le
 * défilé quelqu'un qu'elle ne retrouve pas dans l'annuaire.
 */
async function construireCartes(rows: CreatorRow[]): Promise<MarketplaceCreator[]> {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  const { profMap, platsBy, nichesBy, offersBy, offerPriceBy } = await loadRelations(ids);

  const NOW = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const result: MarketplaceCreator[] = [];
  for (const c of rows) {
    const prof = profMap.get(c.id);
    const plats = (platsBy.get(c.id) ?? []).slice().sort((a, b) => b.subs - a.subs);
    const niches = nichesBy.get(c.id) ?? [];
    const offers = orderOffers(offersBy.get(c.id) ?? []);

    // Gating : un profil n'apparaît que s'il est complet. La règle vit dans
    // `lib/profil-visible` et PAS ici, parce que le tableau de bord du créateur
    // doit appliquer exactement la même — il en appliquait une autre, plus
    // permissive, et laissait donc des créateurs invisibles sans les prévenir.
    const pseudo = c.handle;
    const photo = prof?.avatar_url;
    // `pseudo` et `photo` sont redits ici pour TypeScript seulement : la règle
    // les garantit déjà, mais il ne peut pas le déduire d'un appel de fonction.
    if (
      !profilVisible({
        pseudo: Boolean(pseudo),
        photo: Boolean(photo),
        plateforme: plats.length > 0,
        niche: niches.length > 0,
        offre: offers.length > 0,
      }) ||
      !pseudo ||
      !photo
    )
      continue;

    const main = plats[0];
    // NE PAS inventer de note. Le code écrivait `c.rating ?? 5` : un créateur
    // sans le moindre avis s'affichait avec la note MAXIMALE. C'est la même
    // faute que le badge « Vérifié » posé à la main sur tous les comptes de
    // démonstration — fabriquer une preuve de confiance. Une marque choisit un
    // créateur sur ces signaux.
    const rating = c.rating ?? null;
    const dealsCount = c.deals_count ?? 0;
    const reviewsCount = c.reviews_count ?? 0;
    // « Vérifié » signifie désormais UNE seule chose : l'audience d'au moins un
    // réseau a été constatée auprès de l'API de la plateforme. Le booléen
    // `creators.verified` ne concerne que la vérification d'identité et ne doit
    // plus faire lever ce badge — il valait `true` sur tous les comptes de démo.
    const verified = plats.some((p) => Boolean(p.verifiedAt));
    const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
    const isNew = createdMs > 0 && NOW - createdMs < THIRTY_DAYS_MS;
    // "Top" = vétéran avec excellente note. Au moins 5 deals OU 5 reviews + note ≥ 4.8.
    const isTop = rating !== null && rating >= 4.8 && (dealsCount >= 5 || reviewsCount >= 5);

    result.push({
      id: c.id,
      name: prof.display_name ?? "Créateur",
      handle: pseudo,
      niche: niches[0],
      platform: main.label,
      platformSlug: main.slug,
      followers: fmtFollowers(main.subs),
      engagement: c.engagement != null ? `${c.engagement}%` : "—",
      priceFrom: prixAPartirDe(
        offerPriceBy.get(c.id),
        c.rate_video,
        c.rate_mention,
        c.rate_pack,
      ),
      offers,
      rating,
      photo,
      city: (c as { city?: string | null }).city ?? null,
      citySlug: (c as { city_slug?: string | null }).city_slug ?? null,
      travels: Boolean((c as { travels?: boolean | null }).travels),
      tint: tintFor(pseudo),
      niches,
      platformLabels: plats.map((p) => p.label),
      isTop,
      isVerified: verified,
      isNew,
      isDemo: Boolean(c.is_demo),
      reviewsCount,
    });
  }
  return result;
}

/** Ce qu'on envoie au navigateur pour le défilé côté marque. */
const PAQUET_DEFILE = 50;
/** Fiches lues par passage. Sous la marche des ~350 lignes de PostgREST. */
const PASSAGE_DEFILE = 200;
/** Au plus 2 000 fiches parcourues : au-delà, la marque a vu le catalogue. */
const PASSAGES_DEFILE_MAX = 10;

/**
 * Le paquet du défilé côté marque.
 *
 * ─── Pourquoi ce n'est pas `getMarketplaceCreators()` ───
 * Le défilé envoyait TOUT l'annuaire au navigateur et laissait celui-ci
 * écarter ce qui avait déjà défilé. Deux conséquences, mesurées le
 * 23/10/2026 avec 500 créateurs en base :
 *
 *  - 330 ko de propriétés sérialisées pour un écran où la marque verra douze
 *    cartes. Le poids grandit avec chaque inscription, sur un écran qui
 *    s'ouvre surtout au téléphone.
 *  - la mémoire ne vivait que dans le navigateur. `enregistrerVues` écrivait
 *    bien en base, mais personne ne la relisait : sur un second appareil, la
 *    marque revoyait tout depuis le début.
 *
 * On lit donc ce qui a déjà défilé, puis on balaie par passages jusqu'à
 * remplir un paquet. Non connecté, il n'y a rien à croiser : un seul passage,
 * exactement comme avant.
 */
export type PaquetDeCreateurs = {
  createurs: MarketplaceCreator[];
  /**
   * Combien de créateurs la marque n'a pas encore vus, APRÈS ce paquet.
   *
   * Même raisonnement que `PaquetDeBriefs.restants` dans `lib/defile.ts` :
   * c'est le nombre que l'écran de fin annonce, il était calculé sur la
   * taille du paquet, et c'est lui qui donne une raison de revenir.
   *
   * BORNE INFÉRIEURE : on retranche toutes les cartes déjà vues du total des
   * fiches, alors que certaines portent des profils devenus incomplets —
   * donc sortis du catalogue, donc hors du total. Et le total compte les
   * fiches, pas les profils COMPLETS : une fiche sans photo n'apparaît
   * jamais dans le défilé. Les deux écarts vont dans le même sens, celui de
   * la prudence. Annoncer moins que la réalité ne se démentira pas.
   */
  restants: number;
};

export async function createursDuDefile(marqueId?: string): Promise<PaquetDeCreateurs> {
  const dejaVues = new Set<string>();
  if (marqueId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cartes_vues")
      .select("cible_id")
      .eq("viewer_id", marqueId);
    for (const v of data ?? []) dejaVues.add(v.cible_id);
  }

  const paquet: MarketplaceCreator[] = [];
  // Une inscription survenue entre deux passages décale la fenêtre et peut
  // ramener une fiche déjà prise. Deux fois la même carte dans un paquet, et
  // la marque la voit revenir après l'avoir écartée.
  const dejaDansLePaquet = new Set<string>();
  for (let passage = 0; passage < PASSAGES_DEFILE_MAX; passage++) {
    const de = passage * PASSAGE_DEFILE;
    const fiches = await lireFiches(de, de + PASSAGE_DEFILE - 1);
    if (fiches.length === 0) break;

    /* On écarte les vues AVANT de charger les relations : une fiche déjà vue
       ne vaut pas quatre requêtes de plus. */
    const neuves = fiches.filter((f) => !dejaVues.has(f.id) && !dejaDansLePaquet.has(f.id));
    for (const carte of await construireCartes(neuves)) {
      if (dejaDansLePaquet.has(carte.id)) continue;
      dejaDansLePaquet.add(carte.id);
      paquet.push(carte);
      if (paquet.length >= PAQUET_DEFILE) break;
    }
    // Un passage incomplet veut dire qu'on a touché le fond de la table.
    if (paquet.length >= PAQUET_DEFILE || fiches.length < PASSAGE_DEFILE) break;
  }

  /* Un `count` et rien d'autre : pas de liste d'identifiants dans l'URL, donc
     pas de falaise à 350 UUID (voir `par-tranches.ts`). La condition est
     celle de `lireFiches`. */
  const supabase = await createClient();
  const total = supabase.from("creators").select("id", { count: "exact", head: true });
  const { count } = demoCreatorsVisible() ? await total : await total.neq("is_demo", true);

  return {
    createurs: paquet,
    restants: Math.max(0, (count ?? 0) - dejaVues.size - paquet.length),
  };
}

export type CreatorProfileData = {
  id: string;
  name: string;
  handle: string;
  /**
   * Fiche de démonstration ? Exposé parce que la PAGE doit le savoir : depuis
   * qu'on réaffiche ces profils en production, ils sont atteignables par les
   * moteurs via les liens du catalogue. Sans `noindex`, Google indexerait
   * deux douzaines de créateurs inventés sur le domaine — et une page
   * désindexée reste des mois dans les caches.
   */
  isDemo: boolean;
  bio: string | null;
  /** `null` tant qu'aucun avis n'a été reçu. */
  rating: number | null;
  reviewsCount: number;
  dealsCount: number;
  engagement: string;
  priceFrom: number | null;
  offers: OfferId[];
  /** Prix par offre (clé = OfferId). Pour les offres non-payées au fixe
   *  (perf, affil), la valeur est null. */
  offerPrices: Partial<Record<OfferId, number | null>>;
  photo: string | null;
  tint: string;
  niches: string[];
  platforms: {
    label: string;
    slug: string;
    followers: string;
    handle: string | null;
    url: string | null;
    /** Audience constatée auprès de la plateforme, pas seulement déclarée. */
    verified: boolean;
    verifiedAt: string | null;
  }[];
  mainPlatform: { label: string; slug: string } | null;
  totalFollowers: string;
  isTop: boolean;
  isVerified: boolean;
  isNew: boolean;
  portfolio: {
    id: string;
    url: string;
    title: string | null;
    thumbnailUrl: string | null;
    platformSlug: string | null;
    viewCount: number | null;
    durationSeconds: number | null;
    isShort: boolean;
  }[];
};

/** Profil public d'un créateur par son handle. */
export async function getCreatorByHandle(handle: string): Promise<CreatorProfileData | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("creators")
    .select(
      "id, handle, bio, rating, reviews_count, deals_count, engagement, rate_video, rate_mention, rate_pack, verified, created_at, is_demo",
    )
    .eq("handle", handle)
    .maybeSingle();
  if (!c) return null;
  // Même règle que l'annuaire : en production, une fiche de démonstration
  // n'existe pas. Sans ça, elle resterait atteignable par lien direct — et
  // c'est justement ce que fait quelqu'un à qui on a envoyé le profil.
  if (c.is_demo && !demoCreatorsVisible()) return null;

  const { profMap, platsBy, nichesBy, offersBy, offerPriceBy } =
    await loadRelations([c.id]);
  const prof = profMap.get(c.id);
  const plats = (platsBy.get(c.id) ?? []).slice().sort((a, b) => b.subs - a.subs);
  const totalSubs = plats.reduce((sum, p) => sum + p.subs, 0);

  // Portfolio (public via RLS). Trié par vues décroissantes pour montrer
  // d'abord les vidéos qui marchent le mieux (puis fallback sur position
  // pour les items sans stats).
  const { data: portfolioData } = await supabase
    .from("creator_portfolio_items")
    .select(
      "id, url, title, thumbnail_url, platform_slug, view_count, duration_seconds, is_short, position",
    )
    .eq("creator_id", c.id)
    .order("view_count", { ascending: false, nullsFirst: false })
    .order("position");

  // Même règle que sur la vitrine : pas d'avis, pas de note inventée.
  const rating = c.rating ?? null;
  const dealsCount = c.deals_count ?? 0;
  const reviewsCount = c.reviews_count ?? 0;
  // Même règle sur la fiche publique : le badge suit la vérification réelle.
  const verified = plats.some((p) => Boolean(p.verifiedAt));
  const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
  const NOW = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const isNew = createdMs > 0 && NOW - createdMs < THIRTY_DAYS_MS;
  const isTop = rating !== null && rating >= 4.8 && (dealsCount >= 5 || reviewsCount >= 5);

  return {
    id: c.id,
    name: prof?.display_name ?? "Créateur",
    handle: c.handle ?? handle,
    isDemo: c.is_demo === true,
    bio: c.bio,
    rating,
    reviewsCount,
    dealsCount,
    engagement: c.engagement != null ? `${c.engagement}%` : "—",
    priceFrom: prixAPartirDe(
      offerPriceBy.get(c.id),
      c.rate_video,
      c.rate_mention,
      c.rate_pack,
    ),
    offers: orderOffers(offersBy.get(c.id) ?? []),
    offerPrices: (offerPriceBy.get(c.id) ?? {}) as Partial<Record<OfferId, number | null>>,
    photo: prof?.avatar_url ?? null,
    tint: tintFor(c.handle ?? handle),
    niches: nichesBy.get(c.id) ?? [],
    platforms: plats.map((p) => ({
      label: p.label,
      slug: p.slug,
      followers: fmtFollowers(p.subs),
      handle: p.handle,
      url: p.url,
      /** Vrai seulement si l'audience a été constatée auprès de la plateforme. */
      verified: Boolean(p.verifiedAt),
      verifiedAt: p.verifiedAt,
    })),
    mainPlatform: plats[0] ? { label: plats[0].label, slug: plats[0].slug } : null,
    totalFollowers: fmtFollowers(totalSubs),
    isTop,
    isVerified: verified,
    isNew,
    portfolio: (portfolioData ?? []).map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      thumbnailUrl: p.thumbnail_url,
      platformSlug: p.platform_slug,
      viewCount: p.view_count,
      durationSeconds: p.duration_seconds,
      isShort: p.is_short ?? false,
    })),
  };
}

export type CreatorReview = {
  brandName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

/** Avis publics reçus par un créateur (avec le nom de la marque). */
export async function getCreatorReviews(creatorId: string): Promise<CreatorReview[]> {
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("brand_id, rating, comment, created_at")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });
  const rows = reviews ?? [];
  if (rows.length === 0) return [];

  const brandIds = [...new Set(rows.map((r) => r.brand_id))];
  const brands = await parTranches(brandIds, (t) =>
    supabase.from("brands").select("id, name").in("id", t),
  );
  const nameMap = new Map(brands.map((b) => [b.id, b.name]));

  return rows.map((r) => ({
    brandName: nameMap.get(r.brand_id) ?? "Marque",
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
  }));
}
