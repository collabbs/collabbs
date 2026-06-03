import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/EmptyState";

export const metadata = { title: "Mon activité — Collabbs" };

const eur = (n: number) => `${n.toLocaleString("fr-FR")}€`;

const APP_STATUS_META: Record<
  string,
  { label: string; tone: string }
> = {
  pending: { label: "En attente", tone: "bg-amber-50 text-amber-700" },
  accepted: { label: "Acceptée", tone: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Refusée", tone: "bg-zinc-100 text-zinc-500" },
  withdrawn: { label: "Retirée", tone: "bg-zinc-100 text-zinc-500" },
};

const CAMPAIGN_TYPE_BAND: Record<string, string> = {
  affiliation: "from-emerald-400 to-teal-500",
  video: "from-purple-500 to-pink-500",
  performance: "from-amber-400 to-orange-500",
  hybrid: "from-cyan-400 via-purple-500 to-pink-500",
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "creator") redirect("/dashboard");

  // Mes liens d'affiliation + leurs perfs
  const { data: links } = await supabase
    .from("affiliate_links")
    .select("id, campaign_id, code, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });
  const linkRows = links ?? [];

  // Events de chaque lien
  const linkIds = linkRows.map((l) => l.id);
  const { data: events } = linkIds.length
    ? await supabase
        .from("affiliate_events")
        .select("link_id, type, commission_amount, sale_amount")
        .in("link_id", linkIds)
    : { data: [] };
  const perfByLink = new Map<
    string,
    { clicks: number; sales: number; gains: number }
  >();
  for (const e of events ?? []) {
    const cur = perfByLink.get(e.link_id) ?? { clicks: 0, sales: 0, gains: 0 };
    if (e.type === "click") cur.clicks++;
    else if (e.type === "sale") {
      cur.sales++;
      cur.gains += Number(e.commission_amount ?? 0);
    }
    perfByLink.set(e.link_id, cur);
  }

  // Mes candidatures
  const { data: apps } = await supabase
    .from("applications")
    .select("id, campaign_id, status, created_at, message")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });
  const appRows = apps ?? [];

  // Mes deals
  const { data: deals } = await supabase
    .from("deals")
    .select("id, brand_id, title, status, amount, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const dealRows = deals ?? [];

  // Métadonnées campagnes + marques (pour résoudre noms/logos en un seul endroit)
  const campaignIds = Array.from(
    new Set([
      ...linkRows.map((l) => l.campaign_id),
      ...appRows.map((a) => a.campaign_id),
    ]),
  );
  const { data: campaignsData } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, name, type, status, brand_id, brands(name, logo_url)")
        .in("id", campaignIds)
    : { data: [] };
  const campaignMap = new Map((campaignsData ?? []).map((c) => [c.id, c]));

  const brandIds = Array.from(
    new Set([
      ...dealRows.map((d) => d.brand_id),
      ...(campaignsData ?? []).map((c) => c.brand_id),
    ]),
  );
  const { data: brandsData } = brandIds.length
    ? await supabase.from("brands").select("id, name, logo_url").in("id", brandIds)
    : { data: [] };
  const brandMap = new Map((brandsData ?? []).map((b) => [b.id, b]));

  // Stats top
  const totalClicks = Array.from(perfByLink.values()).reduce(
    (s, p) => s + p.clicks,
    0,
  );
  const totalGains = Array.from(perfByLink.values()).reduce(
    (s, p) => s + p.gains,
    0,
  );
  const pendingApps = appRows.filter((a) => a.status === "pending").length;
  const activeDeals = dealRows.filter(
    (d) => d.status === "negotiation" || d.status === "active",
  ).length;

  const isEmpty =
    linkRows.length === 0 && appRows.length === 0 && dealRows.length === 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            Créateur 🎨
          </span>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Mon activité
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tes liens, candidatures et deals en un seul endroit.
          </p>
        </div>
        <Link
          href="/opportunities"
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Trouver d&apos;autres opportunités →
        </Link>
      </div>

      {/* Stats overview */}
      {!isEmpty && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatBlock
            icon="🔗"
            tone="emerald"
            value={String(linkRows.length)}
            label="Liens actifs"
          />
          <StatBlock
            icon="⏳"
            tone="brand"
            value={String(pendingApps)}
            label="Candidatures en attente"
          />
          <StatBlock
            icon="🤝"
            tone="amber"
            value={String(activeDeals)}
            label="Deals en cours"
          />
          <StatBlock
            icon="💸"
            tone="emerald"
            value={eur(totalGains)}
            label="Gagné en affiliation"
            hint={`${totalClicks} clic${totalClicks > 1 ? "s" : ""} total`}
          />
        </div>
      )}

      {isEmpty && (
        <div className="mt-8">
          <EmptyState
            icon="🚀"
            title="Pas encore d'activité"
            description="Active ton premier lien d'affiliation ou candidate à un deal pour commencer à gagner."
            cta={{ label: "Voir les opportunités", href: "/opportunities" }}
          />
        </div>
      )}

      {/* Liens d'affiliation actifs */}
      {linkRows.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-black text-ink">
              Mes liens d&apos;affiliation{" "}
              <span className="text-zinc-400">({linkRows.length})</span>
            </h2>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {linkRows.map((l) => {
              const c = campaignMap.get(l.campaign_id);
              const brand = c?.brand_id ? brandMap.get(c.brand_id) : null;
              const perf = perfByLink.get(l.id) ?? {
                clicks: 0,
                sales: 0,
                gains: 0,
              };
              const band =
                CAMPAIGN_TYPE_BAND[c?.type ?? "affiliation"] ??
                CAMPAIGN_TYPE_BAND.affiliation;
              return (
                <div
                  key={l.id}
                  className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`h-1 bg-gradient-to-r ${band}`} />
                  <div className="p-4">
                    <Link
                      href={`/opportunities/${l.campaign_id}`}
                      className="flex items-center gap-3"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 text-xs font-bold text-zinc-500 ring-1 ring-zinc-100">
                        {brand?.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={brand.logo_url}
                            alt={brand.name ?? ""}
                            className="h-full w-full object-contain p-1.5"
                          />
                        ) : (
                          (brand?.name ?? "?").slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          {brand?.name ?? "Marque"}
                        </p>
                        <p className="truncate text-sm font-bold text-ink">
                          {c?.name ?? "Campagne"}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                        🔗 Actif
                      </span>
                    </Link>

                    <a
                      href={`/r/${l.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block break-all rounded-md bg-zinc-50 px-2 py-1.5 font-mono text-[11px] text-zinc-700 transition hover:bg-zinc-100"
                    >
                      collabbs.com/r/{l.code}
                    </a>

                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center">
                      <div>
                        <p className="font-display text-base font-black text-ink">
                          {perf.clicks}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                          Clics
                        </p>
                      </div>
                      <div className="border-x border-zinc-100">
                        <p className="font-display text-base font-black text-ink">
                          {perf.sales}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                          Ventes
                        </p>
                      </div>
                      <div>
                        <p className="font-display text-base font-black text-emerald-700">
                          {eur(perf.gains)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                          Gagné
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Candidatures */}
      {appRows.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-black text-ink">
            Mes candidatures{" "}
            <span className="text-zinc-400">({appRows.length})</span>
          </h2>
          <div className="mt-4 space-y-2">
            {appRows.map((a) => {
              const c = campaignMap.get(a.campaign_id);
              const brand = c?.brand_id ? brandMap.get(c.brand_id) : null;
              const meta =
                APP_STATUS_META[a.status] ?? APP_STATUS_META.pending;
              return (
                <Link
                  key={a.id}
                  href={`/opportunities/${a.campaign_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-50 text-[10px] font-bold text-zinc-500 ring-1 ring-zinc-100">
                      {brand?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brand.logo_url}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        (brand?.name ?? "?").slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {c?.name ?? "Campagne"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {brand?.name ?? "Marque"} ·{" "}
                        {new Date(a.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Deals (lien rapide) */}
      {dealRows.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-black text-ink">
              Mes deals{" "}
              <span className="text-zinc-400">({dealRows.length})</span>
            </h2>
            <Link
              href="/deals"
              className="text-sm font-medium text-brand hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {dealRows.slice(0, 5).map((d) => {
              const brand = brandMap.get(d.brand_id);
              return (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-3 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-50 text-[10px] font-bold text-zinc-500 ring-1 ring-zinc-100">
                      {brand?.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brand.logo_url}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        (brand?.name ?? "?").slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">
                        {d.title ?? "Collaboration"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {brand?.name ?? "Marque"} · {eur(d.amount)}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-700">
                    {d.status}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function StatBlock({
  icon,
  value,
  label,
  hint,
  tone,
}: {
  icon: string;
  value: string;
  label: string;
  hint?: string;
  tone: "brand" | "emerald" | "amber";
}) {
  const tones = {
    brand: "from-purple-50 to-pink-50 text-purple-700",
    emerald: "from-emerald-50 to-teal-50 text-emerald-700",
    amber: "from-amber-50 to-orange-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]} text-lg`}
      >
        {icon}
      </span>
      <p className="mt-3 font-display text-2xl font-black tracking-tight text-ink">
        {value}
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
