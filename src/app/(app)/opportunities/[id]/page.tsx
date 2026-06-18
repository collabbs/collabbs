import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlatformIcon from "@/components/PlatformIcon";
import {
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_TYPE_DESCRIPTION,
  TONE_LABEL,
  TIER_LABELS,
  campaignReward,
  type CampaignType,
} from "@/lib/campaign";
import ActionPanel from "./ActionPanel";
import { openConversation } from "../../messages/actions";
import EarningsCalculator from "./EarningsCalculator";
import FaqAccordion from "./FaqAccordion";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("name, brands(name)")
    .eq("id", id)
    .single();
  return {
    title: data ? `${data.name} — ${data.brands?.name ?? "Collabbs"}` : "Campagne — Collabbs",
  };
}

export default async function OpportunityDetailPage({
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
  // Une marque qui ouvre ce lien est renvoyée vers sa vue de gestion.
  if (profileRes.data?.role === "brand") redirect(`/campaigns/${id}`);

  const { data: c } = await supabase
    .from("campaigns")
    .select(
      "id, brand_id, name, description, requirements, type, status, fixed_amount, commission_value, commission_unit, commission_nano, commission_micro, commission_mid, commission_macro, min_subscribers, spots, tone, avoid, starts_at, ends_at, created_at, target_url, product_name, product_url, product_image_url, product_kind, with_promo_code, promo_code, promo_auto_generate, promo_discount_pct, promo_min_purchase, promo_expires_at, promo_commission_pct, with_giveaway, giveaway_prize_label, giveaway_prize_value, giveaway_winners_count, giveaway_rules_url, cpa_action_label, cpa_value_per_action, brands(name, logo_url, website, sector), campaign_niches(niche_id), campaign_platforms(platform_id), campaign_cpa_tiers(min_actions, payout, label)",
    )
    .eq("id", id)
    .single();
  if (!c) notFound();

  const [nichesRes, platformsRes] = await Promise.all([
    supabase.from("niches").select("id, label"),
    supabase.from("platforms").select("id, label, slug"),
  ]);
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

  const type = c.type as CampaignType;
  const isAffiliation = type === "affiliation" || type === "hybrid";

  // Statut du créateur sur cette campagne.
  const [linkRes, appRes, examplesRes, brandStatsRes] = await Promise.all([
    supabase
      .from("affiliate_links")
      .select("id, code, promo_code")
      .eq("creator_id", user.id)
      .eq("campaign_id", id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id")
      .eq("creator_id", user.id)
      .eq("campaign_id", id)
      .maybeSingle(),
    supabase
      .from("campaign_examples")
      .select("id, url, caption, position")
      .eq("campaign_id", id)
      .order("position"),
    // Stats de la marque pour rassurer le créateur (combien de campagnes,
    // combien de deals signés, tracking actif).
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", c.brand_id),
  ]);
  const examples = examplesRes.data ?? [];
  const brandTotalCampaigns = brandStatsRes.count ?? 0;

  // Stats temps réel de la campagne (anonymes, pour réassurer le créateur)
  const [campaignLinksRes, campaignDealsRes] = await Promise.all([
    supabase
      .from("affiliate_links")
      .select("id")
      .eq("campaign_id", id),
    supabase
      .from("deals")
      .select("id, status")
      .eq("campaign_id", id),
  ]);
  const campaignLinkIds = (campaignLinksRes.data ?? []).map((l) => l.id);
  const { data: campaignEvents } = campaignLinkIds.length
    ? await supabase
        .from("affiliate_events")
        .select("type, sale_amount, commission_amount")
        .in("link_id", campaignLinkIds)
    : { data: [] };
  const campaignEv = campaignEvents ?? [];
  const totalClicks = campaignEv.filter((e) => e.type === "click").length;
  const totalSales = campaignEv.filter((e) => e.type === "sale").length;
  const totalCommissionsPaid = campaignEv
    .filter((e) => e.type === "sale")
    .reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
  const activeCreators = campaignLinkIds.length;
  const completedDeals = (campaignDealsRes.data ?? []).filter(
    (d) => d.status === "completed" || d.status === "active",
  ).length;

  let clicks = 0;
  let gains = 0;
  // Stats spécifiques au CODE PROMO du créateur sur cette campagne :
  // séparées des stats lien d'affi pour pouvoir afficher "ton code a fait
  // X ventes / Y€" dans la card promo.
  let promoSalesCount = 0;
  let promoCommissionTotal = 0;
  if (linkRes.data) {
    const evRes = await supabase
      .from("affiliate_events")
      .select("type, source, sale_amount, commission_amount")
      .eq("link_id", linkRes.data.id);
    for (const e of evRes.data ?? []) {
      if (e.type === "click") clicks += 1;
      else if (e.type === "sale") {
        gains += e.commission_amount ?? 0;
        if (e.source === "promo_code") {
          promoSalesCount += 1;
          promoCommissionTotal += e.commission_amount ?? 0;
        }
      }
    }
  }

  const status: "none" | "linked" | "applied" = linkRes.data
    ? "linked"
    : appRes.data
      ? "applied"
      : "none";

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  const tier = (val: number | null) => (val ?? "?") + "%";

  return (
    <>
      <Link
        href="/opportunities"
        className="text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        ← Toutes les opportunités
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Colonne principale */}
        <div>
          {/* En-tête marque + titre */}
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-sm font-bold text-zinc-500 ring-1 ring-zinc-100">
              {c.brands?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.brands.logo_url}
                  alt={c.brands.name}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                (c.brands?.name ?? "?").slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-500">{c.brands?.name ?? "Marque"}</p>
              <h1 className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
                {c.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep">
                  {CAMPAIGN_TYPE_LABEL[type]}
                </span>
                {c.status !== "active" && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                    Campagne terminée
                  </span>
                )}
                {c.brands?.sector && (
                  <span className="text-xs text-zinc-400">{c.brands.sector}</span>
                )}
              </div>
            </div>
          </div>

          {/* Rémunération */}
          <div className="mt-6 rounded-2xl border border-zinc-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">
              Rémunération
            </p>
            <p className="mt-1 font-display text-2xl font-black text-ink">
              {campaignReward(c)}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{CAMPAIGN_TYPE_DESCRIPTION[type]}</p>

            {isAffiliation && (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-purple-100 pt-4 sm:grid-cols-4">
                {TIER_LABELS.map((t) => (
                  <div key={t.key}>
                    <dt className="text-[11px] text-zinc-500">{t.label}</dt>
                    <dd className="text-lg font-extrabold text-ink">
                      {tier(c[`commission_${t.key}` as keyof typeof c] as number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Produit ciblé — affiché avant la description pour donner
              tout de suite le sujet concret. Card horizontale avec image,
              nom, type (physique/digital/service) et lien produit. */}
          {(c.product_name || c.product_url || c.product_image_url) && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">
                Le produit à promouvoir
              </h2>
              <div className="mt-3 flex gap-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                {c.product_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.product_image_url}
                    alt={c.product_name ?? "Produit"}
                    className="h-24 w-24 shrink-0 rounded-xl border border-zinc-100 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 text-3xl">
                    {c.product_kind === "physical"
                      ? "📦"
                      : c.product_kind === "digital"
                        ? "💻"
                        : c.product_kind === "service"
                          ? "🛠️"
                          : "🎁"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {c.product_kind && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-brand-deep">
                      {c.product_kind === "physical"
                        ? "📦 Produit physique"
                        : c.product_kind === "digital"
                          ? "💻 Produit digital"
                          : "🛠️ Service"}
                    </span>
                  )}
                  {c.product_name && (
                    <p className="mt-1.5 text-base font-bold text-ink">
                      {c.product_name}
                    </p>
                  )}
                  {c.product_url && (
                    <a
                      href={c.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      Voir la page produit ↗
                    </a>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Paliers CPA — affichés en hero quand type=cpa_tiers (gros enjeu
              de motivation : le créateur voit qu'il peut viser plus haut). */}
          {c.type === "cpa_tiers" && c.campaign_cpa_tiers && c.campaign_cpa_tiers.length > 0 && (
            <section className="mt-8 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-5 sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                📈 Paliers de rémunération
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                Tu touches le palier le plus haut atteint sur la campagne. Vise
                plus haut, gagne plus.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {c.campaign_cpa_tiers
                  .slice()
                  .sort((a, b) => a.min_actions - b.min_actions)
                  .map((t, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white p-3 ring-1 ring-emerald-100"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        {t.label || `Palier ${i + 1}`}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        À partir de <strong className="text-ink">{t.min_actions.toLocaleString("fr-FR")}</strong>{" "}
                        {c.cpa_action_label || "actions"}
                      </p>
                      <p className="mt-1.5 font-display text-2xl font-black text-emerald-700">
                        {t.payout.toLocaleString("fr-FR")}€
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* CPA flat — X€ par action déclarée. */}
          {c.type === "cpa_flat" && c.cpa_value_per_action != null && (
            <section className="mt-8 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-5 sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                🎯 Paiement par action
              </h2>
              <p className="mt-3 text-sm text-zinc-700">
                Tu touches{" "}
                <span className="font-display text-2xl font-black text-emerald-700">
                  {c.cpa_value_per_action}€
                </span>{" "}
                pour chaque{" "}
                <strong className="text-ink">{c.cpa_action_label || "action"}</strong>{" "}
                déclarée via ton lien.
              </p>
            </section>
          )}

          {/* Code promo — affiché AVANT la description si l'asset est activé. */}
          {c.with_promo_code && (
            <section className="mt-8 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-pink-50/40 p-5 sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                🎟️ Ton code promo à diffuser
              </h2>
              <div className="mt-4 flex flex-wrap items-end gap-4">
                {c.promo_auto_generate ? (
                  <div className="rounded-xl border-2 border-dashed border-purple-300 bg-white px-5 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-purple-500">
                      Code unique
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-black tracking-wider text-ink">
                      TON@HANDLE-XX
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Généré quand la marque accepte ta candidature.
                    </p>
                  </div>
                ) : linkRes.data?.promo_code ? (
                  // Si le créateur a déjà activé sa participation, on lui
                  // montre SON code unique (priorité sur le code partagé).
                  <div className="rounded-xl border-2 border-purple-400 bg-white px-5 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-purple-500">
                      Ton code
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black tracking-wider text-ink">
                      {linkRes.data.promo_code}
                    </p>
                  </div>
                ) : c.promo_code ? (
                  <div className="rounded-xl border-2 border-purple-300 bg-white px-5 py-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-purple-500">
                      Code à utiliser
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black tracking-wider text-ink">
                      {c.promo_code}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-1.5 text-sm">
                  {c.promo_discount_pct != null && (
                    <p>
                      <span className="font-bold text-emerald-700">
                        -{c.promo_discount_pct}%
                      </span>{" "}
                      <span className="text-zinc-600">de réduction</span>
                    </p>
                  )}
                  {c.promo_min_purchase != null && c.promo_min_purchase > 0 && (
                    <p className="text-xs text-zinc-500">
                      Dès {c.promo_min_purchase}€ d&apos;achat
                    </p>
                  )}
                  {c.promo_expires_at && (
                    <p className="text-xs text-zinc-500">
                      Valable jusqu&apos;au{" "}
                      {new Date(c.promo_expires_at).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  {c.promo_commission_pct != null && c.promo_commission_pct > 0 && (
                    <p className="mt-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      💰 Tu touches {c.promo_commission_pct}% sur les ventes via ton code
                    </p>
                  )}
                </div>
              </div>

              {/* Stats du créateur sur SON code promo : visible uniquement
                  s'il a déjà commencé à générer des ventes. */}
              {promoSalesCount > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3 text-center ring-1 ring-purple-100">
                    <p className="font-display text-xl font-black text-ink">
                      {promoSalesCount}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                      Ventes via ton code
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center ring-1 ring-emerald-100 sm:col-span-2">
                    <p className="font-display text-xl font-black text-emerald-700">
                      {promoCommissionTotal.toLocaleString("fr-FR")}€
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-emerald-700">
                      Commission cumulée
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Concours — argument marketing fourni par la marque, à relayer. */}
          {c.with_giveaway && (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                🎁 Concours à faire gagner
              </h2>
              <p className="mt-1 text-xs text-zinc-600">
                La marque gère le tirage et l&apos;envoi du lot. Toi tu en parles
                à ta communauté.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {c.giveaway_prize_label && (
                  <div className="sm:col-span-2 rounded-xl bg-white p-3 ring-1 ring-amber-100">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      Lot
                    </p>
                    <p className="mt-1 text-sm font-bold text-ink">
                      {c.giveaway_prize_label}
                    </p>
                  </div>
                )}
                {c.giveaway_prize_value != null && (
                  <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      Valeur
                    </p>
                    <p className="mt-1 font-display text-xl font-black text-ink">
                      {c.giveaway_prize_value}€
                    </p>
                  </div>
                )}
                {c.giveaway_winners_count != null && c.giveaway_winners_count > 0 && (
                  <div className="rounded-xl bg-white p-3 ring-1 ring-amber-100">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      Gagnants
                    </p>
                    <p className="mt-1 font-display text-xl font-black text-ink">
                      {c.giveaway_winners_count}
                    </p>
                  </div>
                )}
              </div>
              {c.giveaway_rules_url && (
                <a
                  href={c.giveaway_rules_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
                >
                  Voir le règlement officiel ↗
                </a>
              )}
            </section>
          )}

          {/* Description */}
          {c.description && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">La campagne</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
                {c.description}
              </p>
            </section>
          )}

          {/* Stats temps réel de la campagne — réassurance "ça marche déjà" */}
          {(activeCreators > 0 || totalClicks > 0 || completedDeals > 0) && (
            <section className="mt-6">
              <h2 className="font-display text-lg font-black text-ink">
                Cette campagne en chiffres
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Mis à jour en temps réel.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Créateurs engagés
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-ink">
                    {activeCreators}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Clics générés
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-ink">
                    {totalClicks.toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    Ventes confirmées
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-ink">
                    {totalSales}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Versé aux créateurs
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-emerald-700">
                    {Math.round(totalCommissionsPaid).toLocaleString("fr-FR")}€
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Simulateur de gains — affichage adapté selon le type */}
          <div className="mt-8">
            <EarningsCalculator
              type={type}
              fixedAmount={c.fixed_amount}
              commissionValue={c.commission_value}
              tierPcts={{
                nano: c.commission_nano,
                micro: c.commission_micro,
                mid: c.commission_mid,
                macro: c.commission_macro,
              }}
            />
          </div>

          {/* Exemples de contenu — la marque a uploadé des refs */}
          {examples.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">
                Exemples de ce qu&apos;ils attendent{" "}
                <span className="text-zinc-400">({examples.length})</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Inspire-toi de ces références pour augmenter tes chances.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {examples.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {ex.url && (
                      <a
                        href={ex.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 truncate text-xs font-mono text-brand hover:underline"
                      >
                        🔗 {ex.url.replace(/^https?:\/\//, "")}
                        <span className="text-zinc-400">↗</span>
                      </a>
                    )}
                    {ex.caption && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                        {ex.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Attentes */}
          {(c.requirements || c.tone || c.avoid) && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">
                Ce qu&apos;attend la marque
              </h2>
              {c.requirements && (
                <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
                  {c.requirements}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {c.tone && (
                  <p className="text-zinc-600">
                    <span className="font-semibold text-ink">Ton : </span>
                    {TONE_LABEL[c.tone] ?? c.tone}
                  </p>
                )}
                {c.avoid && (
                  <p className="text-zinc-600">
                    <span className="font-semibold text-ink">À éviter : </span>
                    {c.avoid}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Cibles */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-black text-ink">Profil recherché</h2>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
                <span
                  key={n}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
                >
                  {n}
                </span>
              ))}
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
              {c.min_subscribers != null && (
                <div>
                  <dt className="text-xs text-zinc-500">Abonnés minimum</dt>
                  <dd className="text-lg font-extrabold text-ink">
                    {c.min_subscribers.toLocaleString("fr-FR")}
                  </dd>
                </div>
              )}
              {c.spots != null && (
                <div>
                  <dt className="text-xs text-zinc-500">Places</dt>
                  <dd className="text-lg font-extrabold text-ink">{c.spots}</dd>
                </div>
              )}
              {fmtDate(c.ends_at) && (
                <div>
                  <dt className="text-xs text-zinc-500">Jusqu&apos;au</dt>
                  <dd className="text-lg font-extrabold text-ink">{fmtDate(c.ends_at)}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Comment ça marche */}
          <section className="mt-8 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/40 to-pink-50/30 p-5 sm:p-6">
            <h2 className="font-display text-lg font-black text-ink">
              Comment ça marche pour toi
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {isAffiliation
                ? "De l'activation au paiement, tu gardes le contrôle."
                : "De la candidature au paiement, on s'occupe du reste."}
            </p>
            <ol className="mt-4 space-y-3">
              {(isAffiliation
                ? [
                    {
                      n: 1,
                      t: "Active ton lien en 1 clic",
                      d: "Tu reçois ton lien collabbs.com/r/{code} unique en quelques secondes.",
                    },
                    {
                      n: 2,
                      t: "Publie où tu veux",
                      d: "Insta, TikTok, YouTube, ta bio, ta story… aucune contrainte de plateforme.",
                    },
                    {
                      n: 3,
                      t: "On track les ventes pour toi",
                      d: "Notre script suit chaque clic et chaque vente automatiquement. Tu vois tout dans /activity.",
                    },
                    {
                      n: 4,
                      t: "Tu es payé·e chaque mois",
                      d: "Versement automatique des commissions sur ton compte (Stripe Connect, ~2 jours ouvrés).",
                    },
                  ]
                : [
                    {
                      n: 1,
                      t: "Envoie ta candidature",
                      d: "Un message court + tes réseaux. La marque répond sous quelques jours.",
                    },
                    {
                      n: 2,
                      t: "La marque te valide",
                      d: "Si tu corresponds, on génère le contrat avec les coordonnées légales déjà remplies.",
                    },
                    {
                      n: 3,
                      t: "Tu livres le contenu",
                      d: "Tu déposes le ou les contenus dans le deal. La marque valide (avec retouches incluses si besoin).",
                    },
                    {
                      n: 4,
                      t: "Paiement sécurisé",
                      d: "Les fonds sont déjà en séquestre. Dès validation, tu reçois ta part nette automatiquement.",
                    },
                  ]
              ).map((s) => (
                <li key={s.n} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-xs font-bold text-white shadow-sm">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{s.t}</p>
                    <p className="text-xs text-zinc-600">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* FAQ */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-black text-ink">
              Questions fréquentes
            </h2>
            <FaqAccordion
              items={
                isAffiliation
                  ? [
                      {
                        q: "Quand est-ce que je suis payé·e ?",
                        a: "Les commissions sont calculées en temps réel et versées le 1er de chaque mois pour le mois précédent, automatiquement sur ton compte connecté (Stripe Connect, 2-3 jours ouvrés).",
                      },
                      {
                        q: "Combien est-ce que je peux gagner ?",
                        a: "Ça dépend de ton audience et de ton taux de conversion. Tu peux jouer avec la calculatrice ci-dessus pour estimer. Les meilleurs créateurs sur ce type de campagne gagnent typiquement entre 200€ et 2 000€ par mois.",
                      },
                      {
                        q: "Est-ce que je peux quitter la campagne ?",
                        a: "Oui, tu peux désactiver ton lien à tout moment depuis /activity. Tes ventes déjà confirmées te restent dues.",
                      },
                      {
                        q: "Y a-t-il une exclusivité ?",
                        a: c.avoid
                          ? `Vérifie la section "Ce qu'attend la marque" ci-dessus. Restrictions précisées : ${c.avoid}.`
                          : "Non, aucune exclusivité par défaut. Tu peux promouvoir d'autres marques en parallèle.",
                      },
                      {
                        q: "Comment savoir si une vente est validée ?",
                        a: "On track via un script chez la marque qui nous remonte chaque conversion confirmée (paiement effectif). Tu vois le compteur en temps réel sur /activity et dans tes analytics.",
                      },
                    ]
                  : [
                      {
                        q: "Quand est-ce que je suis payé·e ?",
                        a: "Dès que tu acceptes le deal, la marque dépose les fonds en séquestre. Quand tu livres et qu'elle valide, le paiement net t'est versé automatiquement (Stripe Connect, 2-3 jours ouvrés).",
                      },
                      {
                        q: "Et si je dois refaire le contenu ?",
                        a: `${c.fixed_amount ?? "Le forfait"} inclut 2 rounds de retouches. Si la marque demande plus, elle doit te le payer en plus (à négocier en messagerie).`,
                      },
                      {
                        q: "Et si la marque ne valide pas mon contenu ?",
                        a: "Elle a 5 jours pour valider après ta livraison. Passé ce délai, le paiement t'est versé automatiquement.",
                      },
                      {
                        q: "Est-ce que je peux candidater à plusieurs deals ?",
                        a: "Oui, sauf mention d'exclusivité. Vérifie la section 'Ce qu'attend la marque' pour les restrictions.",
                      },
                      {
                        q: "Comment se passe le contrat ?",
                        a: "Le contrat est généré automatiquement avec tes coordonnées légales et celles de la marque. Tu valides en 1 clic à l'acceptation du deal. Aucun fichier à signer.",
                      },
                    ]
              }
            />
          </section>
        </div>

        {/* Colonne action (sticky) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="font-display text-lg font-black text-ink">
              {isAffiliation ? "Lance-toi" : "Intéressé·e ?"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {isAffiliation
                ? "Génère ton lien unique et commence à gagner."
                : "Envoie ta candidature à la marque."}
            </p>
            <div className="mt-4">
              {c.status === "active" ? (
                <ActionPanel
                  campaignId={c.id}
                  isAffiliation={isAffiliation}
                  initialStatus={status}
                  initialCode={linkRes.data?.code}
                  clicks={clicks}
                  gains={gains}
                />
              ) : (
                <p className="rounded-lg bg-zinc-50 p-3 text-center text-sm text-zinc-500">
                  Cette campagne n&apos;accepte plus de nouvelles participations.
                </p>
              )}
            </div>

            <form action={openConversation.bind(null, c.brand_id)} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
              >
                💬 Poser une question à la marque
              </button>
            </form>

            {c.brands?.website && (
              <a
                href={c.brands.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-xs font-medium text-zinc-500 transition hover:text-brand"
              >
                Voir le site de {c.brands.name} ↗
              </a>
            )}
          </div>

          {/* À propos de la marque — réassurance */}
          <Link
            href={`/brands/${c.brand_id}`}
            className="mt-4 block rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm transition hover:border-purple-200 hover:shadow-md"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              À propos de la marque
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-100">
                {c.brands?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.brands.logo_url}
                    alt={c.brands.name ?? ""}
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <span className="text-xs font-bold text-zinc-500">
                    {(c.brands?.name ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-black text-ink">
                  {c.brands?.name ?? "Marque"}
                </p>
                {c.brands?.sector && (
                  <p className="truncate text-xs text-zinc-500">{c.brands.sector}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600">
              <span>
                <strong className="text-ink">{brandTotalCampaigns}</strong>{" "}
                campagne{brandTotalCampaigns > 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-brand">
              Voir le profil complet →
            </p>
          </Link>
        </aside>
      </div>
    </>
  );
}
