import Link from "next/link";
import AppOrLandingShell from "@/components/app/AppOrLandingShell";
import CreatorCard from "@/components/landing/CreatorCard";
import { NICHES, PLATFORMS, OFFER_TYPES, type OfferId } from "@/components/landing/creators";
import { getMarketplaceCreators } from "@/lib/creators-data";
import { createClient } from "@/lib/supabase/server";
import SaveCreatorButton from "@/components/landing/SaveCreatorButton";
import FiltersDrawer from "@/components/landing/FiltersDrawer";
import FilterChip from "@/components/FilterChip";
import FilterPopover from "@/components/FilterPopover";
import PlatformIcon from "@/components/PlatformIcon";

/** Mappe un nom d'affichage de plateforme vers le slug attendu par PlatformIcon. */
function platformSlug(label: string): string {
  const l = label.toLowerCase();
  if (l === "x") return "twitter";
  return l;
}

export const metadata = {
  title: "Parcourir les créateurs — Collabbs",
};

type Params = {
  q?: string;
  niche?: string;
  platform?: string;
  offre?: string;
};

function buildHref(params: Params): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `/creators?${s}` : "/creators";
}

// Chip = FilterChip (client component avec feedback optimiste).
// Petit wrapper pour conserver les props existantes.
function Chip(props: { label: React.ReactNode; href: string; active: boolean }) {
  return <FilterChip {...props} />;
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { q, niche, platform, offre } = await searchParams;

  const query = (q ?? "").trim().toLowerCase();
  const all = await getMarketplaceCreators();

  // Si le visiteur est une marque connectée, on récupère ses créateurs sauvés
  // pour afficher le cœur rempli sur les cartes correspondantes.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isBrandViewer = false;
  const savedIds = new Set<string>();
  if (user) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (viewer?.role === "brand") {
      isBrandViewer = true;
      const { data: saves } = await supabase
        .from("brand_creator_saves")
        .select("creator_id")
        .eq("brand_id", user.id);
      for (const s of saves ?? []) savedIds.add(s.creator_id);
    }
  }
  const results = all.filter((c) => {
    if (query) {
      const haystack = `${c.name} ${c.handle} ${c.niches.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (niche && !c.niches.includes(niche)) return false;
    if (platform && !c.platformLabels.includes(platform)) return false;
    if (offre && !c.offers.includes(offre as OfferId)) return false;
    return true;
  });

  const activeCount =
    (niche ? 1 : 0) + (platform ? 1 : 0) + (offre ? 1 : 0);

  // Chips par groupe (réutilisées dans le drawer mobile ET les popovers desktop).
  const offerChips = (
    <div className="flex flex-wrap gap-2">
      {OFFER_TYPES.map((o) => (
        <Chip
          key={o.id}
          label={`${o.emoji} ${o.short}`}
          active={offre === o.id}
          href={buildHref({ q, niche, platform, offre: offre === o.id ? undefined : o.id })}
        />
      ))}
    </div>
  );
  const platformChips = (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => (
        <Chip
          key={p}
          label={
            <span className="inline-flex items-center gap-1.5">
              <PlatformIcon slug={platformSlug(p)} className="h-3.5 w-3.5 shrink-0" />
              <span>{p}</span>
            </span>
          }
          active={platform === p}
          href={buildHref({ q, niche, platform: platform === p ? undefined : p, offre })}
        />
      ))}
    </div>
  );
  const nicheChips = (
    <div className="flex flex-wrap gap-2">
      {NICHES.map((n) => (
        <Chip
          key={n}
          label={n}
          active={niche === n}
          href={buildHref({ q, niche: niche === n ? undefined : n, platform, offre })}
        />
      ))}
    </div>
  );

  const activeOfferLabel =
    offre ? OFFER_TYPES.find((o) => o.id === offre)?.short ?? null : null;

  // Drawer mobile : version verticale empilée des 3 groupes.
  const filterGroups = (
    <div className="space-y-5">
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Offre
        </p>
        {offerChips}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Plateforme
        </p>
        {platformChips}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Niche
        </p>
        {nicheChips}
      </div>

      {activeCount > 0 && (
        <div className="border-t border-zinc-100 pt-4">
          <Link
            href="/creators"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <span>↻</span>
            <span>Réinitialiser les filtres</span>
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <AppOrLandingShell contentClassName="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
      <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl">
          Trouvez le créateur idéal
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Parcourez librement les profils. Payez à la vidéo ou lancez une
          affiliation en 1 clic — créez un compte pour collaborer.
        </p>

        {/* Recherche */}
        <form action="/creators" className="mt-6 flex max-w-xl items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher une niche, un créateur…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 sm:px-5"
          >
            <span className="hidden sm:inline">Rechercher</span>
            <span className="sm:hidden">🔍</span>
          </button>
        </form>

        {/* Filtres : drawer sur mobile, barre de popovers compacts sur desktop */}
        <div className="mt-4">
          <FiltersDrawer activeCount={activeCount}>{filterGroups}</FiltersDrawer>
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <FilterPopover label="Offre" activeLabel={activeOfferLabel}>
              {offerChips}
            </FilterPopover>
            <FilterPopover label="Plateforme" activeLabel={platform ?? null}>
              {platformChips}
            </FilterPopover>
            <FilterPopover label="Niche" activeLabel={niche ?? null}>
              {nicheChips}
            </FilterPopover>
            {activeCount > 0 && (
              <Link
                href="/creators"
                className="ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-ink"
              >
                <span>↻</span>
                <span>Réinitialiser</span>
              </Link>
            )}
          </div>
        </div>

        {/* Résultats */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {results.length} créateur{results.length > 1 ? "s" : ""}
          </p>
        </div>

        {results.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((c) => (
              <CreatorCard
                key={c.handle}
                creator={c}
                href={`/creators/${c.handle}`}
                overlay={
                  isBrandViewer ? (
                    <SaveCreatorButton creatorId={c.id} initialSaved={savedIds.has(c.id)} />
                  ) : null
                }
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
            <p className="font-semibold text-ink">Aucun créateur ne correspond</p>
            <p className="mt-1 text-sm text-zinc-500">
              Essayez d&apos;élargir vos filtres, ou{" "}
              <Link href="/creators" className="font-medium text-brand hover:underline">
                réinitialisez la recherche
              </Link>
              .
            </p>
          </div>
        )}
    </AppOrLandingShell>
  );
}
