import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mes campagnes — Collabbs" };

const TYPE_LABEL: Record<string, string> = {
  affiliation: "Affiliation",
  video: "Paiement fixe",
  performance: "Performance",
  hybrid: "Hybride",
};

const eur = (n: number) => `${n.toLocaleString("fr-FR")}€`;

export default async function MyCampaignsPage() {
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

  const campaignsRes = await supabase
    .from("campaigns")
    .select(
      "id, name, type, status, fixed_amount, commission_value, created_at",
    )
    .eq("brand_id", user.id)
    .order("created_at", { ascending: false });
  const campaigns = campaignsRes.data ?? [];
  const campaignIds = campaigns.map((c) => c.id);

  const [linksRes, appsRes] = await Promise.all([
    supabase.from("affiliate_links").select("id, campaign_id").in("campaign_id", campaignIds),
    supabase.from("applications").select("campaign_id").in("campaign_id", campaignIds),
  ]);
  const links = linksRes.data ?? [];

  const eventsRes = await supabase
    .from("affiliate_events")
    .select("link_id, type, sale_amount, commission_amount")
    .in(
      "link_id",
      links.map((l) => l.id),
    );
  const events = eventsRes.data ?? [];

  // Agrégations par campagne
  const linkToCampaign = new Map(links.map((l) => [l.id, l.campaign_id]));
  const add = (m: Map<string, number>, k: string, v: number) =>
    m.set(k, (m.get(k) ?? 0) + v);

  const clicks = new Map<string, number>();
  const sales = new Map<string, number>();
  const ca = new Map<string, number>();
  const commissions = new Map<string, number>();
  const activations = new Map<string, number>();
  const applications = new Map<string, number>();

  for (const l of links) add(activations, l.campaign_id, 1);
  for (const a of appsRes.data ?? []) add(applications, a.campaign_id, 1);
  for (const e of events) {
    const cid = linkToCampaign.get(e.link_id);
    if (!cid) continue;
    if (e.type === "click") add(clicks, cid, 1);
    else if (e.type === "sale") {
      add(sales, cid, 1);
      add(ca, cid, e.sale_amount ?? 0);
      add(commissions, cid, e.commission_amount ?? 0);
    }
  }

  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const totals = [
    { label: "CA généré", value: eur(sum(ca)) },
    { label: "Commissions", value: eur(sum(commissions)) },
    { label: "Ventes", value: String(sum(sales)) },
    { label: "Clics", value: String(sum(clicks)) },
  ];

  function statsFor(c: (typeof campaigns)[number]) {
    if (c.type === "affiliation" || c.type === "hybrid") {
      return [
        { label: "Clics", value: String(clicks.get(c.id) ?? 0) },
        { label: "Ventes", value: String(sales.get(c.id) ?? 0) },
        { label: "CA généré", value: eur(ca.get(c.id) ?? 0) },
        { label: "Commissions", value: eur(commissions.get(c.id) ?? 0) },
      ];
    }
    if (c.type === "video") {
      return [
        { label: "Candidatures", value: String(applications.get(c.id) ?? 0) },
        { label: "Budget / créateur", value: eur(c.fixed_amount ?? 0) },
      ];
    }
    // performance
    return [
      { label: "Candidatures", value: String(applications.get(c.id) ?? 0) },
      { label: "Tarif", value: `${c.commission_value ?? 0}€ / 1000 vues` },
    ];
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-black tracking-tight text-ink">
            Mes campagnes
          </h1>
          <Link
            href="/campaigns/new"
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Créer une campagne
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
            <p className="font-semibold text-ink">Aucune campagne</p>
            <p className="mt-1 text-sm text-zinc-500">
              Crée ta première campagne pour trouver des créateurs.
            </p>
          </div>
        ) : (
          <>
            {/* Totaux */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {totals.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                >
                  <p className="font-display text-2xl font-black text-ink">{s.value}</p>
                  <p className="text-xs text-zinc-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Campagnes */}
            <div className="mt-6 space-y-4">
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="block rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition hover:border-purple-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-ink">{c.name}</h2>
                      <span className="mt-1 inline-block rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-brand-deep">
                        {TYPE_LABEL[c.type] ?? c.type}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {c.status === "active" ? "Active" : c.status}
                    </span>
                  </div>
                  <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-zinc-100 pt-4">
                    {statsFor(c).map((s) => (
                      <div key={s.label}>
                        <dt className="text-xl font-extrabold text-ink">{s.value}</dt>
                        <dd className="text-xs text-zinc-500">{s.label}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              ))}
            </div>
          </>
        )}
    </>
  );
}
