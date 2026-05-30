import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import PlatformIcon from "@/components/PlatformIcon";
import {
  CAMPAIGN_TYPE_LABEL,
  TONE_LABEL,
  campaignReward,
  eur,
  type CampaignType,
} from "@/lib/campaign";
import { ApplicationDecision, StatusToggle } from "./ManageControls";
import { openConversation } from "../../messages/actions";
import { createDealFromApplication } from "../../deals/actions";
import TrackingStatusCard from "./TrackingStatusCard";
import ShareCampaignCard from "./ShareCampaignCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("campaigns").select("name").eq("id", id).single();
  return { title: data ? `${data.name} — Collabbs` : "Campagne — Collabbs" };
}

export default async function CampaignManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileRes.data?.role !== "brand") redirect("/dashboard");

  const { data: c } = await supabase
    .from("campaigns")
    .select(
      "id, brand_id, name, description, requirements, type, status, fixed_amount, commission_value, commission_unit, commission_nano, commission_micro, commission_mid, commission_macro, min_subscribers, spots, tone, avoid, ends_at, created_at, campaign_niches(niche_id), campaign_platforms(platform_id)",
    )
    .eq("id", id)
    .single();
  if (!c || c.brand_id !== user.id) notFound();

  const type = c.type as CampaignType;
  const isAffiliation = type === "affiliation" || type === "hybrid";

  const [nichesRes, platformsRes, appsRes, linksRes, dealsRes, brandRes] = await Promise.all([
    supabase.from("niches").select("id, label"),
    supabase.from("platforms").select("id, label, slug"),
    supabase
      .from("applications")
      .select("id, creator_id, status, message, created_at")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("affiliate_links")
      .select("id, creator_id, code, created_at")
      .eq("campaign_id", id),
    supabase.from("deals").select("id, creator_id").eq("campaign_id", id),
    supabase
      .from("brands")
      .select("postback_secret, website, tracking_verified_at")
      .eq("id", user.id)
      .single(),
  ]);

  // Origine pour construire l'URL d'endpoint montrée à la marque.
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;
  const dealByCreator = new Map((dealsRes.data ?? []).map((d) => [d.creator_id, d.id]));

  const nicheMap = new Map((nichesRes.data ?? []).map((n) => [n.id, n.label]));
  const platMap = new Map(
    (platformsRes.data ?? []).map((p) => [p.id, { label: p.label, slug: p.slug }]),
  );
  const niches = c.campaign_niches
    .map((x) => nicheMap.get(x.niche_id))
    .filter((v): v is string => Boolean(v));
  const platforms = c.campaign_platforms
    .map((x) => platMap.get(x.platform_id))
    .filter((v): v is { label: string; slug: string } => Boolean(v));

  const apps = appsRes.data ?? [];
  const links = linksRes.data ?? [];

  // Profils + audiences des créateurs concernés (candidats + affiliés).
  const creatorIds = [
    ...new Set([...apps.map((a) => a.creator_id), ...links.map((l) => l.creator_id)]),
  ];
  const [profRes, cpRes] = await Promise.all([
    creatorIds.length
      ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", creatorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] }),
    creatorIds.length
      ? supabase.from("creator_platforms").select("creator_id, subscribers").in("creator_id", creatorIds)
      : Promise.resolve({ data: [] as { creator_id: string; subscribers: number | null }[] }),
  ]);
  const profMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
  const subsMap = new Map<string, number>();
  for (const cp of cpRes.data ?? []) {
    const cur = subsMap.get(cp.creator_id) ?? 0;
    subsMap.set(cp.creator_id, Math.max(cur, cp.subscribers ?? 0));
  }

  // Performance des liens d'affiliation.
  const eventsRes = links.length
    ? await supabase
        .from("affiliate_events")
        .select("link_id, type, sale_amount, commission_amount")
        .in(
          "link_id",
          links.map((l) => l.id),
        )
    : { data: [] as { link_id: string; type: string; sale_amount: number | null; commission_amount: number | null }[] };

  const perLink = new Map<string, { clicks: number; sales: number; ca: number; commissions: number }>();
  for (const l of links) perLink.set(l.id, { clicks: 0, sales: 0, ca: 0, commissions: 0 });
  let totalClicks = 0;
  let totalSales = 0;
  let totalCA = 0;
  let totalCommissions = 0;
  for (const e of eventsRes.data ?? []) {
    const agg = perLink.get(e.link_id);
    if (!agg) continue;
    if (e.type === "click") {
      agg.clicks += 1;
      totalClicks += 1;
    } else if (e.type === "sale") {
      agg.sales += 1;
      agg.ca += e.sale_amount ?? 0;
      agg.commissions += e.commission_amount ?? 0;
      totalSales += 1;
      totalCA += e.sale_amount ?? 0;
      totalCommissions += e.commission_amount ?? 0;
    }
  }

  const pendingCount = apps.filter((a) => a.status === "pending").length;
  const acceptedCount = apps.filter((a) => a.status === "accepted").length;

  // Bandeau de stats selon le type de campagne.
  const stats: { label: string; value: string }[] = isAffiliation
    ? [
        { label: "Affiliés actifs", value: String(links.length) },
        { label: "Clics", value: String(totalClicks) },
        { label: "Ventes", value: String(totalSales) },
        { label: "CA généré", value: eur(totalCA) },
        { label: "Commissions", value: eur(totalCommissions) },
      ]
    : [
        { label: "Candidatures", value: String(apps.length) },
        { label: "En attente", value: String(pendingCount) },
        { label: "Acceptées", value: String(acceptedCount) },
        {
          label: type === "video" ? "Budget / créateur" : "Tarif",
          value:
            type === "video"
              ? eur(c.fixed_amount ?? 0)
              : `${c.commission_value ?? 0}€ / 1000 ${c.commission_unit ?? "vues"}`,
        },
      ];

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : null;

  const tierLabel = (subs: number) =>
    subs >= 200000 ? "Macro" : subs >= 50000 ? "Mid" : subs >= 10000 ? "Micro" : "Nano";

  function CreatorCell({ creatorId }: { creatorId: string }) {
    const p = profMap.get(creatorId);
    const subs = subsMap.get(creatorId) ?? 0;
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
          {p?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (p?.display_name ?? "?").slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {p?.display_name ?? "Créateur"}
          </p>
          <p className="text-xs text-zinc-400">
            {subs > 0 ? `${subs.toLocaleString("fr-FR")} abonnés · ${tierLabel(subs)}` : "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/campaigns"
        className="text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        ← Mes campagnes
      </Link>

      {/* En-tête */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-black tracking-tight text-ink">
              {c.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                c.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {c.status === "active" ? "Active" : c.status === "ended" ? "En pause" : "Brouillon"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep">
              {CAMPAIGN_TYPE_LABEL[type]}
            </span>
            <span className="font-semibold text-ink">{campaignReward(c)}</span>
            <span>· créée le {fmtDate(c.created_at)}</span>
          </div>
        </div>
        {c.status !== "draft" && (
          <StatusToggle campaignId={c.id} initialStatus={c.status as "active" | "ended"} />
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
          >
            <p className="font-display text-2xl font-black text-ink">{s.value}</p>
            <p className="text-xs text-zinc-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Détails campagne */}
      <section className="mt-8 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-black text-ink">Détails</h2>
        {c.description && (
          <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
            {c.description}
          </p>
        )}
        {c.requirements && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Attentes
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-600">{c.requirements}</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {platforms.map((p) => (
            <span
              key={p.slug}
              className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
            >
              <PlatformIcon slug={p.slug} className="h-3.5 w-3.5" />
              {p.label}
            </span>
          ))}
          {niches.map((n) => (
            <span key={n} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
              {n}
            </span>
          ))}
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-zinc-100 pt-4 text-sm">
          {c.min_subscribers != null && (
            <div>
              <dt className="text-xs text-zinc-500">Abonnés min.</dt>
              <dd className="font-bold text-ink">{c.min_subscribers.toLocaleString("fr-FR")}</dd>
            </div>
          )}
          {c.spots != null && (
            <div>
              <dt className="text-xs text-zinc-500">Places</dt>
              <dd className="font-bold text-ink">{c.spots}</dd>
            </div>
          )}
          {c.tone && (
            <div>
              <dt className="text-xs text-zinc-500">Ton</dt>
              <dd className="font-bold text-ink">{TONE_LABEL[c.tone] ?? c.tone}</dd>
            </div>
          )}
          {fmtDate(c.ends_at) && (
            <div>
              <dt className="text-xs text-zinc-500">Fin</dt>
              <dd className="font-bold text-ink">{fmtDate(c.ends_at)}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Candidatures (campagnes non-affiliation) */}
      {!isAffiliation && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-black text-ink">
            Candidatures {apps.length > 0 && <span className="text-zinc-400">({apps.length})</span>}
          </h2>
          {apps.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
              <p className="font-semibold text-ink">Aucune candidature pour l&apos;instant</p>
              <p className="mt-1 text-sm text-zinc-500">
                Les créateurs intéressés apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {apps.map((a) => (
                <div
                  key={a.id}
                  className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CreatorCell creatorId={a.creator_id} />
                    <div className="flex items-center gap-2">
                      <form action={openConversation.bind(null, a.creator_id)}>
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
                        >
                          💬 Contacter
                        </button>
                      </form>
                      {a.status === "accepted" &&
                        (dealByCreator.has(a.creator_id) ? (
                          <Link
                            href={`/deals/${dealByCreator.get(a.creator_id)}`}
                            className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                          >
                            🤝 Voir le deal
                          </Link>
                        ) : (
                          <form action={createDealFromApplication.bind(null, a.id)}>
                            <button
                              type="submit"
                              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                            >
                              🤝 Créer le deal
                            </button>
                          </form>
                        ))}
                      <ApplicationDecision applicationId={a.id} initialStatus={a.status} />
                    </div>
                  </div>
                  {a.message && (
                    <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
                      « {a.message} »
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tracking des ventes (campagnes affiliation / hybride) */}
      {isAffiliation && brandRes.data && (
        <TrackingStatusCard
          verified={Boolean(brandRes.data.tracking_verified_at)}
          hasWebsite={Boolean(brandRes.data.website)}
        />
      )}

      {isAffiliation && <ShareCampaignCard publicUrl={`${origin}/c/${c.id}`} />}

      {/* Affiliés (campagnes affiliation / hybride) */}
      {isAffiliation && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-black text-ink">
            Affiliés {links.length > 0 && <span className="text-zinc-400">({links.length})</span>}
          </h2>
          {links.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center">
              <p className="font-semibold text-ink">Aucun affilié actif</p>
              <p className="mt-1 text-sm text-zinc-500">
                Les créateurs qui activent leur lien apparaîtront ici avec leurs performances.
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                    <th className="px-4 py-3 font-medium">Créateur</th>
                    <th className="px-4 py-3 text-right font-medium">Clics</th>
                    <th className="px-4 py-3 text-right font-medium">Ventes</th>
                    <th className="px-4 py-3 text-right font-medium">CA</th>
                    <th className="px-4 py-3 text-right font-medium">Commissions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => {
                    const agg = perLink.get(l.id) ?? { clicks: 0, sales: 0, ca: 0, commissions: 0 };
                    return (
                      <tr key={l.id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-4 py-3">
                          <CreatorCell creatorId={l.creator_id} />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{agg.clicks}</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{agg.sales}</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{eur(agg.ca)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">
                          {eur(agg.commissions)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
