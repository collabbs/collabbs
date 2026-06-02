import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dealBreakdown } from "@/lib/deal";
import { notifyOnce } from "@/lib/notifications";
import { isLegalInfoComplete } from "@/app/(app)/profile/legal-utils";

const eur = (n: number) => `${n.toLocaleString("fr-FR")}€`;

type Kpi = {
  label: string;
  value: string;
  icon: string;
  hint?: string;
  tone?: "default" | "brand" | "emerald" | "amber";
};

function KpiCard({ k }: { k: Kpi }) {
  const tones: Record<NonNullable<Kpi["tone"]>, string> = {
    default: "from-zinc-50 to-zinc-100 text-zinc-600",
    brand: "from-purple-50 to-pink-50 text-purple-700",
    emerald: "from-emerald-50 to-teal-50 text-emerald-700",
    amber: "from-amber-50 to-orange-50 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tones[k.tone ?? "default"]} text-lg`}
        >
          {k.icon}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-black tracking-tight text-ink">
        {k.value}
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {k.label}
      </p>
      {k.hint && <p className="mt-1 text-xs text-zinc-400">{k.hint}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-3 shadow-sm">
      <p className="text-sm font-bold text-ink">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function ShortcutCard({
  href,
  title,
  desc,
  icon,
  primary,
}: {
  href: string;
  title: string;
  desc: string;
  icon: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${
        primary
          ? "border-transparent bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-md shadow-purple-200"
          : "border-zinc-100 bg-white shadow-sm hover:border-zinc-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
            primary ? "bg-white/15 text-white" : "bg-gradient-to-br from-purple-100 to-pink-100"
          }`}
        >
          {icon}
        </span>
        <span
          className={`text-lg transition-transform group-hover:translate-x-1 ${
            primary ? "text-white/80" : "text-zinc-400"
          }`}
        >
          →
        </span>
      </div>
      <p className={`mt-4 font-display text-lg font-black ${primary ? "text-white" : "text-ink"}`}>
        {title}
      </p>
      <p className={`mt-1 text-sm ${primary ? "text-white/85" : "text-zinc-500"}`}>{desc}</p>
    </Link>
  );
}

function Nudge({
  emoji,
  message,
  ctaLabel,
  ctaHref,
}: {
  emoji: string;
  message: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-sm font-medium text-amber-900">
        <span className="text-lg">{emoji}</span>
        <span className="flex-1">{message}</span>
      </p>
      <Link
        href={ctaHref}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        {ctaLabel}
      </Link>
    </div>
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

  // Infos légales (transversales — pour les contrats).
  const { data: legal } = await supabase
    .from("legal_info")
    .select("status, legal_name, address, city, zip")
    .eq("user_id", user.id)
    .maybeSingle();
  const legalReady = isLegalInfoComplete(legal);

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

  type View = {
    primaryKpis: Kpi[];
    secondaryStats: { label: string; value: string }[];
    completion?: number;
    listable?: boolean;
    trackingNeeded?: boolean;
    ready?: boolean;
  };

  let view: View | null = null;

  // ---------- Données CRÉATEUR ----------
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

    view = {
      completion,
      listable,
      primaryKpis: [
        {
          label: "Revenus totaux",
          value: eur(gains + dealNet),
          icon: "💸",
          tone: "emerald",
          hint: gains + dealNet > 0 ? "Cumul affiliation + deals" : "Encore aucun gain",
        },
        {
          label: "Deals actifs",
          value: String(activeDeals),
          icon: "🤝",
          tone: "brand",
          hint: activeDeals > 0 ? "En cours de livraison" : "Aucun deal en cours",
        },
        {
          label: "Gains affiliation",
          value: eur(gains),
          icon: "🔗",
          tone: "default",
          hint: `${clicks} clic${clicks > 1 ? "s" : ""} générés`,
        },
        {
          label: "Réputation",
          value: rating ? `★ ${rating.toFixed(1)}` : "—",
          icon: "⭐",
          tone: "amber",
          hint: rating ? `${reviewsCount} avis reçu${reviewsCount > 1 ? "s" : ""}` : "Pas encore d'avis",
        },
      ],
      secondaryStats: [
        { label: "Clics affiliés", value: String(clicks) },
        { label: "Liens actifs", value: String(linkIds.length) },
        { label: "Profil complet", value: `${completion}%` },
        { label: "Avis reçus", value: String(reviewsCount) },
      ],
    };
  }

  // ---------- Données MARQUE ----------
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
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
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
    const sales = ev.filter((e) => e.type === "sale").length;
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

    view = {
      ready: Boolean(brandRes.data?.name) && Boolean(brandRes.data?.logo_url),
      trackingNeeded,
      primaryKpis: [
        {
          label: "CA généré",
          value: eur(ca),
          icon: "💰",
          tone: "emerald",
          hint: sales > 0 ? `${sales} vente${sales > 1 ? "s" : ""} confirmée${sales > 1 ? "s" : ""}` : "Aucune vente",
        },
        {
          label: "Campagnes actives",
          value: String(activeCampaigns),
          icon: "🎯",
          tone: "brand",
          hint: `sur ${campaigns.length} total${campaigns.length > 1 ? "es" : ""}`,
        },
        {
          label: "Deals actifs",
          value: String(activeDeals),
          icon: "🤝",
          tone: "default",
          hint: invested > 0 ? `${eur(invested)} déjà versés` : "Aucun deal en cours",
        },
        {
          label: "Clics affiliation",
          value: String(clicks),
          icon: "🔗",
          tone: "amber",
          hint: `${eur(commissions)} de commissions`,
        },
      ],
      secondaryStats: [
        { label: "Investi en deals", value: eur(invested) },
        { label: "Commissions versées", value: eur(commissions) },
        { label: "Ventes confirmées", value: String(sales) },
        { label: "Campagnes totales", value: String(campaigns.length) },
      ],
    };
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            {isCreator ? "Créateur 🎨" : "Marque 🏢"}
          </span>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Vue d&apos;ensemble
            {profile?.display_name ? (
              <span className="font-medium text-zinc-400"> · {profile.display_name}</span>
            ) : null}
          </h1>
        </div>
        <Link
          href={isCreator ? "/opportunities" : "/creators"}
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          {isCreator ? "Voir les opportunités →" : "Trouver des créateurs →"}
        </Link>
      </div>

      {/* Nudges urgents */}
      <div className="mt-6 space-y-3">
        {isCreator && view && !view.listable && (
          <Nudge
            emoji="✨"
            message={
              <>
                Ton profil est à <strong>{view.completion}%</strong> — finalise-le pour devenir visible par les marques.
              </>
            }
            ctaLabel="Compléter"
            ctaHref="/profile"
          />
        )}
        {!isCreator && view && !view.ready && (
          <Nudge
            emoji="🏢"
            message="Complète ton profil marque (logo, secteur, présentation) pour inspirer confiance aux créateurs."
            ctaLabel="Compléter"
            ctaHref="/profile"
          />
        )}
        {!legalReady && (
          <Nudge
            emoji="📝"
            message={
              <>
                Ajoute tes <strong>infos légales</strong> (1 seule fois) → tous tes contrats futurs seront pré-remplis automatiquement.
              </>
            }
            ctaLabel="Renseigner"
            ctaHref="/profile"
          />
        )}
        {!isCreator && view?.trackingNeeded && (
          <Nudge
            emoji="🟡"
            message="Tu as une campagne d'affiliation active mais le tracking n'est pas encore branché sur ton site — les ventes ne remonteront pas."
            ctaLabel="Configurer"
            ctaHref="/tracking"
          />
        )}
      </div>

      {/* KPI principaux */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {(view?.primaryKpis ?? []).map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </div>

      {/* Raccourcis rapides */}
      <h2 className="mt-10 text-xs font-bold uppercase tracking-wider text-zinc-500">
        Raccourcis
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isCreator ? (
          <>
            <ShortcutCard
              href="/opportunities"
              title="Opportunités"
              desc="Trouve des campagnes et active tes liens."
              icon="🎯"
              primary
            />
            <ShortcutCard
              href="/deals"
              title="Mes collaborations"
              desc="Livrables, validation, paiements."
              icon="🤝"
            />
            <ShortcutCard
              href="/messages"
              title="Messagerie"
              desc="Échange avec les marques."
              icon="💬"
            />
            <ShortcutCard
              href="/payouts"
              title="Mes paiements"
              desc="Suivi des virements et de l'escrow."
              icon="💶"
            />
            <ShortcutCard
              href="/profile"
              title="Mon profil"
              desc="Photo, niches, réseaux, offres."
              icon="👤"
            />
            <ShortcutCard
              href="/notifications"
              title="Notifications"
              desc="Tous les évènements de ton compte."
              icon="🔔"
            />
          </>
        ) : (
          <>
            <ShortcutCard
              href="/campaigns/new"
              title="Créer une campagne"
              desc="Affiliation, vidéo, performance ou hybride."
              icon="🚀"
              primary
            />
            <ShortcutCard
              href="/creators"
              title="Trouver des créateurs"
              desc="Marketplace · filtres · contact direct."
              icon="🔍"
            />
            <ShortcutCard
              href="/campaigns"
              title="Mes campagnes"
              desc="Clics, ventes, commissions versées."
              icon="📊"
            />
            <ShortcutCard
              href="/deals"
              title="Collaborations"
              desc="Deals en cours, livrables, avis."
              icon="🤝"
            />
            <ShortcutCard
              href="/shortlist"
              title="Ma shortlist"
              desc="Les créateurs que tu as sauvés."
              icon="⭐"
            />
            <ShortcutCard
              href="/tracking"
              title="Tracking affiliation"
              desc="Branche les ventes sur ton site."
              icon="🔗"
            />
          </>
        )}
      </div>

      {/* Stats détaillées */}
      {view && view.secondaryStats.length > 0 && (
        <>
          <h2 className="mt-10 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Détail
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
            {view.secondaryStats.map((s) => (
              <MiniStat key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
