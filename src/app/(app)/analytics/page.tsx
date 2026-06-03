import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parsePeriod, periodRange, bucketize, bucketSize, pctDelta } from "./period";
import PeriodPicker from "./PeriodPicker";
import {
  KpiTrend,
  RevenueChart,
  TopList,
  FunnelStages,
  DistributionBars,
} from "./charts";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";

export const metadata = {
  title: "Analytics — Collabbs",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
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
  if (!profile) redirect("/dashboard");

  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  // now passé explicitement (pas Date.now() global) pour respecter
  // les contraintes du sandbox workflows si on rejoue.
  const now = new Date();
  const { current, previous, days } = periodRange(period, now);
  const granularity = bucketSize(days);

  if (profile.role === "creator") {
    return <CreatorAnalytics userId={user.id} period={period} current={current} previous={previous} granularity={granularity} />;
  }
  if (profile.role === "brand") {
    return <BrandAnalytics userId={user.id} period={period} current={current} previous={previous} granularity={granularity} />;
  }
  redirect("/dashboard");
}

// ============ CRÉATEUR ============

async function CreatorAnalytics({
  userId,
  period,
  current,
  previous,
  granularity,
}: {
  userId: string;
  period: ReturnType<typeof parsePeriod>;
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
  granularity: "day" | "week";
}) {
  const supabase = await createClient();

  // 1. Transactions (deals) du créateur
  const { data: txAll } = await supabase
    .from("transactions")
    .select("created_at, net_amount, deal_id")
    .eq("creator_id", userId)
    .eq("type", "deal_payment")
    .gte("created_at", previous.start.toISOString())
    .lte("created_at", current.end.toISOString());

  // 2. Liens d'affiliation + events
  const { data: links } = await supabase
    .from("affiliate_links")
    .select("id, campaign_id")
    .eq("creator_id", userId);
  const linkIds = (links ?? []).map((l) => l.id);
  const { data: events } = linkIds.length
    ? await supabase
        .from("affiliate_events")
        .select("created_at, type, commission_amount, sale_amount, link_id")
        .in("link_id", linkIds)
        .gte("created_at", previous.start.toISOString())
        .lte("created_at", current.end.toISOString())
    : { data: [] };

  // 3. Marques (pour top)
  const dealIds = (txAll ?? []).map((t) => t.deal_id).filter((x): x is string => Boolean(x));
  const { data: deals } = dealIds.length
    ? await supabase.from("deals").select("id, brand_id").in("id", dealIds)
    : { data: [] };
  const dealToBrand = new Map((deals ?? []).map((d) => [d.id, d.brand_id]));
  const brandIds = Array.from(new Set((deals ?? []).map((d) => d.brand_id)));
  const { data: brands } = brandIds.length
    ? await supabase.from("brands").select("id, name").in("id", brandIds)
    : { data: [] };
  const brandName = new Map((brands ?? []).map((b) => [b.id, b.name]));

  // 4. Campagnes (pour top liens affiliation)
  const campaignIds = Array.from(new Set((links ?? []).map((l) => l.campaign_id)));
  const { data: campaigns } = campaignIds.length
    ? await supabase
        .from("campaigns")
        .select("id, name, brand_id")
        .in("id", campaignIds)
    : { data: [] };
  const campMap = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const linkToCampaign = new Map((links ?? []).map((l) => [l.id, l.campaign_id]));

  // ===== Split current vs previous =====
  const inRange = (d: Date, r: { start: Date; end: Date }) =>
    d >= r.start && d <= r.end;

  const txCurrent = (txAll ?? []).filter((t) =>
    inRange(new Date(t.created_at), current),
  );
  const txPrev = (txAll ?? []).filter((t) =>
    inRange(new Date(t.created_at), previous),
  );

  const evCurrent = (events ?? []).filter((e) =>
    inRange(new Date(e.created_at), current),
  );
  const evPrev = (events ?? []).filter((e) =>
    inRange(new Date(e.created_at), previous),
  );

  // ===== KPIs =====
  const dealGains = txCurrent.reduce((s, t) => s + Number(t.net_amount), 0);
  const dealGainsPrev = txPrev.reduce((s, t) => s + Number(t.net_amount), 0);
  const affilGains = evCurrent
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
  const affilGainsPrev = evPrev
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
  const totalCurrent = dealGains + affilGains;
  const totalPrev = dealGainsPrev + affilGainsPrev;

  const clicksCurrent = evCurrent.filter((e) => e.type === "click").length;
  const clicksPrev = evPrev.filter((e) => e.type === "click").length;
  const salesCurrent = evCurrent.filter((e) => e.type === "sale").length;
  const salesPrev = evPrev.filter((e) => e.type === "sale").length;

  // ===== Time series : revenu total par bucket =====
  const revEvents = [
    ...txCurrent.map((t) => ({ date: new Date(t.created_at), value: Number(t.net_amount) })),
    ...evCurrent
      .filter((e) => e.type === "sale")
      .map((e) => ({
        date: new Date(e.created_at),
        value: Number(e.commission_amount ?? 0),
      })),
  ];
  const revSeries = bucketize(revEvents, current.start, current.end, granularity);
  const clickSeries = bucketize(
    evCurrent
      .filter((e) => e.type === "click")
      .map((e) => ({ date: new Date(e.created_at), value: 1 })),
    current.start,
    current.end,
    granularity,
  );

  // ===== Top marques =====
  const byBrand = new Map<string, number>();
  for (const t of txCurrent) {
    if (!t.deal_id) continue;
    const bId = dealToBrand.get(t.deal_id);
    if (!bId) continue;
    byBrand.set(bId, (byBrand.get(bId) ?? 0) + Number(t.net_amount));
  }
  const topBrands = Array.from(byBrand.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, val]) => ({
      name: brandName.get(id) ?? "Marque",
      value: val,
    }));

  // ===== Top liens affiliation =====
  const byLink = new Map<string, { sales: number; gains: number; clicks: number }>();
  for (const e of evCurrent) {
    const cur = byLink.get(e.link_id) ?? { sales: 0, gains: 0, clicks: 0 };
    if (e.type === "click") cur.clicks++;
    else if (e.type === "sale") {
      cur.sales++;
      cur.gains += Number(e.commission_amount ?? 0);
    }
    byLink.set(e.link_id, cur);
  }
  const topLinks = Array.from(byLink.entries())
    .filter(([, v]) => v.gains > 0)
    .sort((a, b) => b[1].gains - a[1].gains)
    .slice(0, 5)
    .map(([id, v]) => {
      const campId = linkToCampaign.get(id);
      const c = campId ? campMap.get(campId) : undefined;
      const brandLabel = c?.brand_id ? brandName.get(c.brand_id) : null;
      return {
        name: c?.name ?? "Lien",
        subtitle: brandLabel ? `${brandLabel} · ${v.sales} vente${v.sales > 1 ? "s" : ""}` : `${v.sales} vente${v.sales > 1 ? "s" : ""}`,
        value: v.gains,
      };
    });

  // ===== Distribution par type =====
  const distribution = [
    { name: "Deals", value: dealGains, color: "#7c3aed" },
    { name: "Affiliation", value: affilGains, color: "#ec4899" },
  ];

  // ===== Funnel affiliation =====
  const totalSalesAmount = evCurrent
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.sale_amount ?? 0), 0);
  const funnel = [
    { label: "Clics", value: clicksCurrent, format: "int" as const },
    { label: "Ventes confirmées", value: salesCurrent, format: "int" as const },
    { label: "CA généré pour les marques", value: totalSalesAmount, format: "eur" as const },
    { label: "Commission perçue", value: affilGains, format: "eur" as const },
  ];

  return (
    <>
      <Header period={period} role="creator" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTrend
          label="Revenus totaux"
          value={totalCurrent}
          icon="💸"
          tone="emerald"
          delta={pctDelta(totalCurrent, totalPrev)}
          suffix="€"
          hint={`Période : ${labelForPeriod(period)}`}
        />
        <KpiTrend
          label="Gains affiliation"
          value={affilGains}
          icon="🔗"
          tone="brand"
          delta={pctDelta(affilGains, affilGainsPrev)}
          suffix="€"
        />
        <KpiTrend
          label="Clics générés"
          value={clicksCurrent}
          icon="👆"
          delta={pctDelta(clicksCurrent, clicksPrev)}
        />
        <KpiTrend
          label="Ventes confirmées"
          value={salesCurrent}
          icon="🛒"
          tone="amber"
          delta={pctDelta(salesCurrent, salesPrev)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-black text-ink">Évolution des revenus</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Affiliation + deals · {granularity === "day" ? "Par jour" : "Par semaine"}
          </p>
          <div className="mt-4">
            <RevenueChart data={revSeries} color="#7c3aed" format="eur" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Top marques</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Celles qui te rapportent le plus.
          </p>
          <div className="mt-4">
            <TopList items={topBrands} format="eur" />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Distribution</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Deals fixes vs affiliation sur la période.
          </p>
          <div className="mt-4">
            <DistributionBars data={distribution} format="eur" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">
            Top liens d&apos;affiliation
          </h2>
          <p className="mt-1 text-xs text-zinc-500">Les campagnes qui performent.</p>
          <div className="mt-4">
            <TopList items={topLinks} format="eur" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">
            Funnel affiliation
          </h2>
          <p className="mt-1 text-xs text-zinc-500">Du clic à la commission.</p>
          <div className="mt-4">
            <FunnelStages stages={funnel} />
          </div>
        </section>
      </div>

      <div className="mt-6">
        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Clics par jour</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Visualise les pics et creux de ton trafic affilié.
          </p>
          <div className="mt-4">
            <RevenueChart data={clickSeries} color="#ec4899" format="int" />
          </div>
        </section>
      </div>

      <ExportSection role="creator" period={period} />
    </>
  );
}

// ============ MARQUE ============

async function BrandAnalytics({
  userId,
  period,
  current,
  previous,
  granularity,
}: {
  userId: string;
  period: ReturnType<typeof parsePeriod>;
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
  granularity: "day" | "week";
}) {
  const supabase = await createClient();

  // Campagnes de la marque
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("brand_id", userId);
  const campIds = (campaigns ?? []).map((c) => c.id);

  // Liens d'affiliation rattachés
  const { data: links } = campIds.length
    ? await supabase
        .from("affiliate_links")
        .select("id, campaign_id, creator_id")
        .in("campaign_id", campIds)
    : { data: [] };
  const linkIds = (links ?? []).map((l) => l.id);
  const linkToCampaign = new Map((links ?? []).map((l) => [l.id, l.campaign_id]));
  const linkToCreator = new Map((links ?? []).map((l) => [l.id, l.creator_id]));

  // Events affiliation (clics + ventes)
  const { data: events } = linkIds.length
    ? await supabase
        .from("affiliate_events")
        .select("created_at, type, sale_amount, commission_amount, link_id")
        .in("link_id", linkIds)
        .gte("created_at", previous.start.toISOString())
        .lte("created_at", current.end.toISOString())
    : { data: [] };

  // Transactions deals payées par la marque (escrow + release)
  const { data: txAll } = await supabase
    .from("transactions")
    .select("created_at, gross_amount, platform_fee, deal_id, creator_id")
    .eq("brand_id", userId)
    .eq("type", "deal_payment")
    .gte("created_at", previous.start.toISOString())
    .lte("created_at", current.end.toISOString());

  // Créateurs pour le top
  const creatorIds = Array.from(new Set((txAll ?? []).map((t) => t.creator_id)));
  const { data: creators } = creatorIds.length
    ? await supabase
        .from("creators")
        .select("id, handle, profiles(display_name)")
        .in("id", creatorIds)
    : { data: [] };
  const creatorLabel = new Map(
    (creators ?? []).map((c) => [c.id, c.profiles?.display_name ?? `@${c.handle ?? "?"}`]),
  );
  const campMap = new Map((campaigns ?? []).map((c) => [c.id, c]));

  const inRange = (d: Date, r: { start: Date; end: Date }) =>
    d >= r.start && d <= r.end;

  const txCurrent = (txAll ?? []).filter((t) =>
    inRange(new Date(t.created_at), current),
  );
  const txPrev = (txAll ?? []).filter((t) =>
    inRange(new Date(t.created_at), previous),
  );
  const evCurrent = (events ?? []).filter((e) =>
    inRange(new Date(e.created_at), current),
  );
  const evPrev = (events ?? []).filter((e) =>
    inRange(new Date(e.created_at), previous),
  );

  // ===== KPIs =====
  const investedCurrent = txCurrent.reduce((s, t) => s + Number(t.gross_amount), 0);
  const investedPrev = txPrev.reduce((s, t) => s + Number(t.gross_amount), 0);
  const caCurrent = evCurrent
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.sale_amount ?? 0), 0);
  const caPrev = evPrev
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.sale_amount ?? 0), 0);
  const commissionsCurrent = evCurrent
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
  const commissionsPrev = evPrev
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
  const clicksCurrent = evCurrent.filter((e) => e.type === "click").length;
  const clicksPrev = evPrev.filter((e) => e.type === "click").length;
  const salesCurrent = evCurrent.filter((e) => e.type === "sale").length;
  const salesPrev = evPrev.filter((e) => e.type === "sale").length;

  // ===== Time series CA affiliation =====
  const caSeries = bucketize(
    evCurrent
      .filter((e) => e.type === "sale")
      .map((e) => ({ date: new Date(e.created_at), value: Number(e.sale_amount ?? 0) })),
    current.start,
    current.end,
    granularity,
  );
  const investedSeries = bucketize(
    txCurrent.map((t) => ({
      date: new Date(t.created_at),
      value: Number(t.gross_amount),
    })),
    current.start,
    current.end,
    granularity,
  );

  // ===== Top créateurs (par revenu généré pour la marque, via deals payés) =====
  const byCreatorDeal = new Map<string, number>();
  for (const t of txCurrent) {
    byCreatorDeal.set(
      t.creator_id,
      (byCreatorDeal.get(t.creator_id) ?? 0) + Number(t.gross_amount),
    );
  }
  // Ajout des commissions affiliation par créateur
  const byCreatorAffil = new Map<string, number>();
  for (const e of evCurrent.filter((e) => e.type === "sale")) {
    const creatorId = linkToCreator.get(e.link_id);
    if (!creatorId) continue;
    byCreatorAffil.set(
      creatorId,
      (byCreatorAffil.get(creatorId) ?? 0) + Number(e.sale_amount ?? 0),
    );
  }
  const allCreators = new Set([
    ...Array.from(byCreatorDeal.keys()),
    ...Array.from(byCreatorAffil.keys()),
  ]);
  const topCreators = Array.from(allCreators)
    .map((id) => {
      const total =
        (byCreatorDeal.get(id) ?? 0) + (byCreatorAffil.get(id) ?? 0);
      const dealsP = byCreatorDeal.get(id) ?? 0;
      const affilP = byCreatorAffil.get(id) ?? 0;
      return {
        name: creatorLabel.get(id) ?? "Créateur",
        subtitle:
          dealsP && affilP
            ? `Deals + affiliation`
            : dealsP
              ? "Deals fixes"
              : "Affiliation",
        value: total,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // ===== Top campagnes (par CA généré) =====
  const byCampaign = new Map<string, number>();
  for (const e of evCurrent.filter((e) => e.type === "sale")) {
    const campId = linkToCampaign.get(e.link_id);
    if (!campId) continue;
    byCampaign.set(
      campId,
      (byCampaign.get(campId) ?? 0) + Number(e.sale_amount ?? 0),
    );
  }
  const topCampaigns = Array.from(byCampaign.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, val]) => {
      const c = campMap.get(id);
      return {
        name: c?.name ?? "Campagne",
        value: val,
      };
    });

  // ===== Funnel affiliation =====
  const funnel = [
    { label: "Clics", value: clicksCurrent, format: "int" as const },
    { label: "Ventes", value: salesCurrent, format: "int" as const },
    { label: "CA généré", value: caCurrent, format: "eur" as const },
    { label: "Commissions versées", value: commissionsCurrent, format: "eur" as const },
  ];

  const hasData =
    investedCurrent > 0 || caCurrent > 0 || clicksCurrent > 0 || salesCurrent > 0;

  return (
    <>
      <Header period={period} role="brand" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTrend
          label="CA généré"
          value={caCurrent}
          icon="💰"
          tone="emerald"
          delta={pctDelta(caCurrent, caPrev)}
          suffix="€"
          hint={`Période : ${labelForPeriod(period)}`}
        />
        <KpiTrend
          label="Investi en deals"
          value={investedCurrent}
          icon="🤝"
          tone="brand"
          delta={pctDelta(investedCurrent, investedPrev)}
          suffix="€"
        />
        <KpiTrend
          label="Commissions versées"
          value={commissionsCurrent}
          icon="🔗"
          tone="amber"
          delta={pctDelta(commissionsCurrent, commissionsPrev)}
          suffix="€"
        />
        <KpiTrend
          label="Clics affiliation"
          value={clicksCurrent}
          icon="👆"
          delta={pctDelta(clicksCurrent, clicksPrev)}
        />
      </div>

      {!hasData && (
        <div className="mt-6">
          <EmptyState
            icon="📊"
            title="Pas encore d'activité sur cette période"
            description="Lance ou re-active une campagne, et reviens ici quand les clics et les ventes commencent à tomber."
            cta={{ label: "Créer une campagne", href: "/campaigns/new" }}
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-black text-ink">CA généré par affiliation</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {granularity === "day" ? "Par jour" : "Par semaine"} · Sale amount confirmés
          </p>
          <div className="mt-4">
            <RevenueChart data={caSeries} color="#10b981" format="eur" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Top créateurs</h2>
          <p className="mt-1 text-xs text-zinc-500">Deals + affiliation cumulés.</p>
          <div className="mt-4">
            <TopList items={topCreators} format="eur" />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Investissement deals</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Total escrow payé par période.
          </p>
          <div className="mt-4">
            <RevenueChart data={investedSeries} color="#7c3aed" format="eur" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Top campagnes</h2>
          <p className="mt-1 text-xs text-zinc-500">Par CA généré.</p>
          <div className="mt-4">
            <TopList items={topCampaigns} format="eur" />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-black text-ink">Funnel</h2>
          <p className="mt-1 text-xs text-zinc-500">Clics → CA.</p>
          <div className="mt-4">
            <FunnelStages stages={funnel} />
          </div>
        </section>
      </div>

      <ExportSection role="brand" period={period} />
    </>
  );
}

// ============ Header + Footer ============

function Header({ period, role }: { period: string; role: "creator" | "brand" }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
          {role === "creator" ? "Créateur 🎨" : "Marque 🏢"}
        </span>
        <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Analytics{" "}
          <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            ·
          </span>{" "}
          <span className="font-medium text-zinc-400">{labelForPeriod(period)}</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Suis tes performances en détail — comparaison vs période précédente.
        </p>
      </div>
      <PeriodPicker active={period as never} />
    </div>
  );
}

function ExportSection({ role, period }: { role: "creator" | "brand"; period: string }) {
  return (
    <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-black text-ink">Exporter les données</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Télécharge un CSV pour ta compta ou tes propres analyses.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/analytics/export?role=${role}&period=${period}&kind=transactions`}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            📥 Transactions CSV
          </Link>
          <Link
            href={`/api/analytics/export?role=${role}&period=${period}&kind=affiliate_events`}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
          >
            📥 Affiliation CSV
          </Link>
        </div>
      </div>
    </section>
  );
}

function labelForPeriod(p: string): string {
  switch (p) {
    case "7d":
      return "7 derniers jours";
    case "30d":
      return "30 derniers jours";
    case "90d":
      return "90 derniers jours";
    case "ytd":
      return "Depuis le 1er janvier";
    default:
      return p;
  }
}
