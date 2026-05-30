import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dealBreakdown } from "@/lib/deal";
import { notifyOnce } from "@/lib/notifications";

const eur = (n: number) => `${n.toLocaleString("fr-FR")}€`;

function StatCards({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
  );
}

function NavCard({
  href,
  title,
  desc,
  primary,
}: {
  href: string;
  title: string;
  desc: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
        primary
          ? "border-transparent bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-200"
          : "border-zinc-100 bg-white shadow-sm"
      }`}
    >
      <p className={`font-semibold ${primary ? "text-white" : "text-ink"}`}>{title}</p>
      <p className={`mt-1 text-sm ${primary ? "text-white/80" : "text-zinc-500"}`}>
        {desc}
      </p>
    </Link>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileRes = await supabase
    .from("profiles")
    .select("display_name, role, avatar_url")
    .eq("id", user.id)
    .single();
  const profile = profileRes.data;
  const isCreator = profile?.role === "creator";

  // Email de bienvenue à la première visite du dashboard.
  await notifyOnce({
    userId: user.id,
    type: "welcome",
    title: isCreator
      ? `Bienvenue sur Collabbs${profile?.display_name ? `, ${profile.display_name}` : ""} 👋`
      : `Bienvenue sur Collabbs${profile?.display_name ? `, ${profile.display_name}` : ""} 👋`,
    body: isCreator
      ? "Pour démarrer en 3 minutes : complète ton profil (photo, niches, réseaux), puis explore les opportunités d'affiliation. Tes premiers euros ne sont qu'à quelques clics."
      : "Pour démarrer en 3 minutes : complète ta marque (logo, secteur, site), puis lance ta première campagne. Tu pourras la partager avec des créateurs en 1 clic.",
    link: isCreator ? "/onboarding/creator" : "/onboarding/brand",
  });

  // ---------- Données CRÉATEUR ----------
  let creatorView: {
    completion: number;
    listable: boolean;
    stats: { label: string; value: string }[];
  } | null = null;

  if (isCreator) {
    const [creatorRes, nicheC, offerC, platC, linksRes, dealsRes] = await Promise.all([
      supabase.from("creators").select("handle, rating, reviews_count").eq("id", user.id).maybeSingle(),
      supabase.from("creator_niches").select("*", { count: "exact", head: true }).eq("creator_id", user.id),
      supabase.from("creator_offers").select("*", { count: "exact", head: true }).eq("creator_id", user.id),
      supabase.from("creator_platforms").select("*", { count: "exact", head: true }).eq("creator_id", user.id),
      supabase.from("affiliate_links").select("id").eq("creator_id", user.id),
      supabase.from("deals").select("status, amount").eq("creator_id", user.id),
    ]);
    const linkIds = (linksRes.data ?? []).map((l) => l.id);
    const eventsRes = await supabase
      .from("affiliate_events")
      .select("type, commission_amount")
      .in("link_id", linkIds);
    const ev = eventsRes.data ?? [];
    const clicks = ev.filter((e) => e.type === "click").length;
    const gains = ev
      .filter((e) => e.type === "sale")
      .reduce((s, e) => s + (e.commission_amount ?? 0), 0);

    const deals = dealsRes.data ?? [];
    const activeDeals = deals.filter((d) => d.status === "active").length;
    const dealNet = deals
      .filter((d) => d.status === "completed")
      .reduce((s, d) => s + dealBreakdown(d.amount).net, 0);
    const rating = creatorRes.data?.rating ?? null;
    const reviewsCount = creatorRes.data?.reviews_count ?? 0;

    const completion =
      (profile?.avatar_url ? 25 : 0) +
      (creatorRes.data?.handle ? 15 : 0) +
      ((nicheC.count ?? 0) > 0 ? 20 : 0) +
      ((platC.count ?? 0) > 0 ? 20 : 0) +
      ((offerC.count ?? 0) > 0 ? 20 : 0);
    const listable =
      Boolean(profile?.avatar_url) && (nicheC.count ?? 0) > 0 && (offerC.count ?? 0) > 0;

    creatorView = {
      completion,
      listable,
      stats: [
        { label: "Revenus", value: eur(gains + dealNet) },
        { label: "Deals actifs", value: String(activeDeals) },
        { label: "Gains affiliation", value: eur(gains) },
        { label: "Clics", value: String(clicks) },
        { label: "Note", value: rating ? `★ ${rating} (${reviewsCount})` : "—" },
        { label: "Profil", value: `${completion}%` },
      ],
    };
  }

  // ---------- Données MARQUE ----------
  let brandView: {
    ready: boolean;
    stats: { label: string; value: string }[];
    trackingNeeded?: boolean;
  } | null = null;

  if (!isCreator) {
    const [brandRes, campaignsRes, dealsRes] = await Promise.all([
      supabase
        .from("brands")
        .select("name, logo_url, tracking_verified_at")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("campaigns").select("id, status, type").eq("brand_id", user.id),
      supabase.from("deals").select("status, amount").eq("brand_id", user.id),
    ]);
    const campaigns = campaignsRes.data ?? [];
    const campaignIds = campaigns.map((c) => c.id);
    const linksRes = await supabase
      .from("affiliate_links")
      .select("id")
      .in("campaign_id", campaignIds);
    const linkIds = (linksRes.data ?? []).map((l) => l.id);
    const eventsRes = await supabase
      .from("affiliate_events")
      .select("type, sale_amount, commission_amount")
      .in("link_id", linkIds);
    const ev = eventsRes.data ?? [];
    const clicks = ev.filter((e) => e.type === "click").length;
    const ca = ev.filter((e) => e.type === "sale").reduce((s, e) => s + (e.sale_amount ?? 0), 0);
    const commissions = ev
      .filter((e) => e.type === "sale")
      .reduce((s, e) => s + (e.commission_amount ?? 0), 0);

    const deals = dealsRes.data ?? [];
    const activeDeals = deals.filter((d) => d.status === "active").length;
    const invested = deals
      .filter((d) => d.status === "completed")
      .reduce((s, d) => s + d.amount, 0);

    const hasAffiliation = campaigns.some(
      (c) => c.type === "affiliation" || c.type === "hybrid",
    );
    const trackingNeeded = hasAffiliation && !brandRes.data?.tracking_verified_at;

    brandView = {
      ready: Boolean(brandRes.data?.name) && Boolean(brandRes.data?.logo_url),
      trackingNeeded,
      stats: [
        { label: "CA généré", value: eur(ca) },
        { label: "Commissions", value: eur(commissions) },
        { label: "Clics", value: String(clicks) },
        { label: "Campagnes actives", value: String(campaigns.filter((c) => c.status === "active").length) },
        { label: "Deals actifs", value: String(activeDeals) },
        { label: "Investi (deals)", value: eur(invested) },
      ],
    };
  }

  return (
    <>
      <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
          {isCreator ? "Créateur 🎨" : "Marque 🏢"}
        </span>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-ink">
          Bienvenue{profile?.display_name ? `, ${profile.display_name}` : ""} 👋
        </h1>

        {/* Vue d'ensemble */}
        <div className="mt-8">
          <StatCards stats={(isCreator ? creatorView : brandView)?.stats ?? []} />
        </div>

        {/* Nudge profil si incomplet */}
        {isCreator && creatorView && !creatorView.listable && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              Ton profil est à {creatorView.completion}% — complète-le pour être visible
              par les marques.
            </p>
            <Link
              href="/onboarding/creator"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Compléter
            </Link>
          </div>
        )}
        {!isCreator && brandView && !brandView.ready && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              Complète ton profil marque (logo, secteur) pour inspirer confiance.
            </p>
            <Link
              href="/onboarding/brand"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Compléter
            </Link>
          </div>
        )}

        {!isCreator && brandView?.trackingNeeded && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              🟡 Tu as une campagne d&apos;affiliation active mais le tracking n&apos;est pas
              encore branché sur ton site — les ventes ne remonteront pas.
            </p>
            <Link
              href="/tracking"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Configurer
            </Link>
          </div>
        )}

        {/* Navigation */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Raccourcis
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isCreator ? (
            <>
              <NavCard
                href="/opportunities"
                title="Opportunités"
                desc="Trouve des campagnes et active tes liens."
                primary
              />
              <NavCard
                href="/deals"
                title="Collaborations"
                desc="Tes deals : livrables, clôture, paiements."
              />
              <NavCard
                href="/messages"
                title="Messages"
                desc="Échange avec les marques."
              />
              <NavCard
                href="/onboarding/creator"
                title="Mon profil"
                desc="Photo, niches, réseaux, offres."
              />
            </>
          ) : (
            <>
              <NavCard
                href="/campaigns/new"
                title="Créer une campagne"
                desc="Affiliation, vidéo, performance…"
                primary
              />
              <NavCard
                href="/campaigns"
                title="Mes campagnes"
                desc="Suivi des clics, ventes et commissions."
              />
              <NavCard
                href="/deals"
                title="Collaborations"
                desc="Deals en cours, livrables et avis."
              />
              <NavCard
                href="/creators"
                title="Trouver des créateurs"
                desc="Parcourir la marketplace."
              />
              <NavCard
                href="/messages"
                title="Messages"
                desc="Échange avec les créateurs."
              />
            </>
          )}
        </div>

        <p className="mt-10 text-sm text-zinc-400">
          Bientôt : paiements sécurisés (Stripe).
        </p>
    </>
  );
}
