import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/landing/Logo";
import OpportunityCard, { type Opportunity } from "./OpportunityCard";

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

function Chip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-ink text-white"
          : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {label}
    </Link>
  );
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
      supabase.from("affiliate_links").select("campaign_id, code").eq("creator_id", user.id),
      supabase.from("applications").select("campaign_id").eq("creator_id", user.id),
    ]);

  if (profileRes.data?.role !== "creator") redirect("/dashboard");

  const niches = nichesRes.data ?? [];
  const platforms = platformsRes.data ?? [];
  const nicheMap = new Map(niches.map((n) => [n.id, n.label]));
  const platMap = new Map(platforms.map((p) => [p.id, { label: p.label, slug: p.slug }]));
  const linkMap = new Map((linksRes.data ?? []).map((l) => [l.campaign_id, l.code]));
  const appliedSet = new Set((appsRes.data ?? []).map((a) => a.campaign_id));

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

  const anyFilter = Boolean(q || type || niche || platform);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-500 transition hover:text-ink"
          >
            Tableau de bord
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
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
            className="shrink-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Rechercher
          </button>
        </form>

        {/* Filtres */}
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Type
            </span>
            {TYPE_FILTERS.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                active={type === t.id}
                href={buildHref({ q, niche, platform, type: type === t.id ? undefined : t.id })}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Réseau
            </span>
            {platforms.map((p) => (
              <Chip
                key={p.id}
                label={p.label}
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Niche
            </span>
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
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {results.length} campagne{results.length > 1 ? "s" : ""}
          </p>
          {anyFilter && (
            <Link href="/opportunities" className="text-sm font-medium text-brand hover:underline">
              Réinitialiser
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
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
