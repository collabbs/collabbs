import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OpportunityCard, { type Opportunity } from "./OpportunityCard";
import FilterChip from "@/components/FilterChip";
import FiltersDrawer from "@/components/landing/FiltersDrawer";
import FilterPopover from "@/components/FilterPopover";
import PlatformIcon from "@/components/PlatformIcon";

export const metadata = { title: "Opportunités — Collabbs" };

type Params = { q?: string; type?: string; niche?: string; platform?: string };

const TYPE_FILTERS: { id: string; label: string }[] = [
  { id: "affiliation", label: "Affiliation" },
  { id: "video", label: "Paiement fixe" },
  { id: "performance", label: "Performance" },
  { id: "hybrid", label: "Hybride" },
];

function buildHref(params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/opportunities?${s}` : "/opportunities";
}

// Chip = FilterChip (optimistic feedback).
function Chip(props: { label: React.ReactNode; href: string; active: boolean }) {
  return <FilterChip {...props} />;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { q, type, niche, platform } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, campaignsRes, nichesRes, platformsRes, linksRes, appsRes] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("campaigns")
        .select(
          "id, name, description, type, fixed_amount, commission_value, commission_nano, commission_macro, min_subscribers, spots, created_at, brands(name, logo_url), campaign_niches(niche_id), campaign_platforms(platform_id)",
        )
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase.from("niches").select("id, label").order("label"),
      supabase.from("platforms").select("id, label, slug").order("id"),
      supabase.from("affiliate_links").select("id, campaign_id, code").eq("creator_id", user.id),
      supabase.from("applications").select("campaign_id").eq("creator_id", user.id),
    ]);

  if (profileRes.data?.role !== "creator") redirect("/dashboard");

  const niches = nichesRes.data ?? [];
  const platforms = platformsRes.data ?? [];
  const nicheMap = new Map(niches.map((n) => [n.id, n.label]));
  const platMap = new Map(platforms.map((p) => [p.id, { label: p.label, slug: p.slug }]));
  const linkRows = linksRes.data ?? [];
  const linkMap = new Map(linkRows.map((l) => [l.campaign_id, l.code]));
  const appliedSet = new Set((appsRes.data ?? []).map((a) => a.campaign_id));

  // Clics par campagne (le créateur peut lire les events de ses propres liens)
  const myEventsRes = await supabase
    .from("affiliate_events")
    .select("link_id, type, commission_amount")
    .in(
      "link_id",
      linkRows.map((l) => l.id),
    );
  const linkToCampaign = new Map(linkRows.map((l) => [l.id, l.campaign_id]));
  const clicksByCampaign = new Map<string, number>();
  const gainsByCampaign = new Map<string, number>();
  for (const e of myEventsRes.data ?? []) {
    const cid = linkToCampaign.get(e.link_id);
    if (!cid) continue;
    if (e.type === "click")
      clicksByCampaign.set(cid, (clicksByCampaign.get(cid) ?? 0) + 1);
    else if (e.type === "sale")
      gainsByCampaign.set(cid, (gainsByCampaign.get(cid) ?? 0) + (e.commission_amount ?? 0));
  }

  const query = (q ?? "").trim().toLowerCase();
  const results = (campaignsRes.data ?? []).filter((c) => {
    if (type && c.type !== type) return false;
    if (niche && !c.campaign_niches.some((x) => x.niche_id === Number(niche))) return false;
    if (platform && !c.campaign_platforms.some((x) => x.platform_id === Number(platform)))
      return false;
    if (query) {
      const hay = `${c.name} ${c.description ?? ""} ${c.brands?.name ?? ""}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const activeFilterCount =
    (type ? 1 : 0) + (niche ? 1 : 0) + (platform ? 1 : 0);
  const anyFilter = Boolean(q) || activeFilterCount > 0;

  // Chips réutilisées dans drawer mobile ET popovers desktop.
  const typeChips = (
    <div className="flex flex-wrap gap-2">
      {TYPE_FILTERS.map((t) => (
        <Chip
          key={t.id}
          label={t.label}
          active={type === t.id}
          href={buildHref({ q, niche, platform, type: type === t.id ? undefined : t.id })}
        />
      ))}
    </div>
  );
  const platformChips = (
    <div className="flex flex-wrap gap-2">
      {platforms.map((p) => (
        <Chip
          key={p.id}
          label={
            <span className="inline-flex items-center gap-1.5">
              <PlatformIcon slug={p.slug} className="h-3.5 w-3.5 shrink-0" />
              <span>{p.label}</span>
            </span>
          }
          active={platform === String(p.id)}
          href={buildHref({
            q,
            type,
            niche,
            platform: platform === String(p.id) ? undefined : String(p.id),
          })}
        />
      ))}
    </div>
  );
  const nicheChips = (
    <div className="flex flex-wrap gap-2">
      {niches.map((n) => (
        <Chip
          key={n.id}
          label={n.label}
          active={niche === String(n.id)}
          href={buildHref({
            q,
            type,
            platform,
            niche: niche === String(n.id) ? undefined : String(n.id),
          })}
        />
      ))}
    </div>
  );

  const activeTypeLabel =
    type ? TYPE_FILTERS.find((t) => t.id === type)?.label ?? null : null;
  const activePlatformLabel = platform
    ? platforms.find((p) => String(p.id) === platform)?.label ?? null
    : null;
  const activeNicheLabel = niche
    ? niches.find((n) => String(n.id) === niche)?.label ?? null
    : null;

  // Drawer mobile : 3 groupes empilés.
  const filterGroups = (
    <div className="space-y-5">
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Type
        </p>
        {typeChips}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Réseau
        </p>
        {platformChips}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Niche
        </p>
        {nicheChips}
      </div>

      {activeFilterCount > 0 && (
        <div className="border-t border-zinc-100 pt-4">
          <Link
            href="/opportunities"
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
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Opportunités
        </h1>
        <p className="mt-2 text-zinc-600">
          Trouve les campagnes faites pour toi. Active ton lien d&apos;affiliation en
          1 clic ou candidate.
        </p>

        {/* Recherche */}
        <form action="/opportunities" className="mt-6 flex max-w-xl items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher une marque, un produit…"
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
          <FiltersDrawer activeCount={activeFilterCount}>{filterGroups}</FiltersDrawer>
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <FilterPopover label="Type" activeLabel={activeTypeLabel}>
              {typeChips}
            </FilterPopover>
            <FilterPopover label="Réseau" activeLabel={activePlatformLabel}>
              {platformChips}
            </FilterPopover>
            <FilterPopover label="Niche" activeLabel={activeNicheLabel}>
              {nicheChips}
            </FilterPopover>
            {activeFilterCount > 0 && (
              <Link
                href="/opportunities"
                className="ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-ink"
              >
                <span>↻</span>
                <span>Réinitialiser</span>
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {results.length} campagne{results.length > 1 ? "s" : ""}
          </p>
          {anyFilter && !activeFilterCount && (
            <Link href="/opportunities" className="text-sm font-medium text-brand hover:underline">
              Effacer la recherche
            </Link>
          )}
        </div>

        {results.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
            <p className="font-semibold text-ink">Aucune campagne ne correspond</p>
            <p className="mt-1 text-sm text-zinc-500">
              Essaie d&apos;élargir tes filtres.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((c) => {
              const opportunity: Opportunity = {
                id: c.id,
                name: c.name,
                description: c.description,
                type: c.type,
                fixedAmount: c.fixed_amount,
                commissionValue: c.commission_value,
                tiers: { nano: c.commission_nano, macro: c.commission_macro },
                minSubscribers: c.min_subscribers,
                spots: c.spots,
                brandName: c.brands?.name ?? "Marque",
                brandLogo: c.brands?.logo_url ?? null,
                niches: c.campaign_niches
                  .map((x) => nicheMap.get(x.niche_id))
                  .filter((v): v is string => Boolean(v)),
                platforms: c.campaign_platforms
                  .map((x) => platMap.get(x.platform_id))
                  .filter((v): v is { label: string; slug: string } => Boolean(v)),
              };
              const code = linkMap.get(c.id);
              const status: "none" | "linked" | "applied" = code
                ? "linked"
                : appliedSet.has(c.id)
                  ? "applied"
                  : "none";
              return (
                <OpportunityCard
                  key={c.id}
                  opportunity={opportunity}
                  initialStatus={status}
                  initialCode={code}
                  clicks={clicksByCampaign.get(c.id) ?? 0}
                  gains={gainsByCampaign.get(c.id) ?? 0}
                />
              );
            })}
          </div>
        )}
    </>
  );
}
