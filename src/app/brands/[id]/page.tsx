import { notFound } from "next/navigation";
import Link from "next/link";
import AppOrLandingShell from "@/components/app/AppOrLandingShell";
import PlatformIcon from "@/components/PlatformIcon";
import EmptyState from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { openConversation } from "@/app/(app)/messages/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("brands")
    .select("name, sector")
    .eq("id", id)
    .maybeSingle();
  return {
    title: b ? `${b.name} — Collabbs` : "Marque — Collabbs",
  };
}

/** "https://lumi.com" → "lumi.com" */
function prettyHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host.replace(
      /^www\./,
      "",
    );
  } catch {
    return url;
  }
}

const CAMPAIGN_TYPE_META: Record<
  string,
  { label: string; emoji: string; band: string }
> = {
  affiliation: {
    label: "Affiliation",
    emoji: "🔗",
    band: "from-emerald-400 to-teal-500",
  },
  video: { label: "Paiement fixe", emoji: "🎬", band: "from-purple-500 to-pink-500" },
  performance: {
    label: "Performance",
    emoji: "📊",
    band: "from-amber-400 to-orange-500",
  },
  hybrid: {
    label: "Hybride",
    emoji: "💎",
    band: "from-cyan-400 via-purple-500 to-pink-500",
  },
};

export default async function BrandPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Données de la marque (publiques via RLS).
  const { data: brand } = await supabase
    .from("brands")
    .select(
      "id, name, sector, website, logo_url, description, tracking_verified_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!brand) notFound();

  // Visiteur connecté ?
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerRole: "creator" | "brand" | null = null;
  if (user) {
    const { data: vp } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    viewerRole = vp?.role ?? null;
  }
  const isCreatorViewer = viewerRole === "creator";
  const isOwnPage = user?.id === brand.id;

  // Niches, réseaux, campagnes actives, reviews, stats.
  const [
    bNichesRes,
    bPlatformsRes,
    activeCampaignsRes,
    allCampaignsRes,
    dealsRes,
    reviewsRes,
  ] = await Promise.all([
    supabase.from("brand_niches").select("niches(label)").eq("brand_id", brand.id),
    supabase
      .from("brand_platforms")
      .select("handle, url, platforms(label, slug)")
      .eq("brand_id", brand.id),
    supabase
      .from("campaigns")
      .select("id, name, description, type, fixed_amount, commission_value, spots")
      .eq("brand_id", brand.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id),
    supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brand.id)
      .in("status", ["active", "completed"]),
    supabase
      .from("reviews")
      .select("rating, comment, creators(handle)")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const niches = (bNichesRes.data ?? [])
    .map((r) => r.niches?.label)
    .filter((v): v is string => Boolean(v));
  const platforms = (bPlatformsRes.data ?? [])
    .map((r) => ({
      label: r.platforms?.label ?? null,
      slug: r.platforms?.slug ?? null,
      handle: r.handle,
      url: r.url,
    }))
    .filter((p) => p.label && p.slug);
  const campaigns = activeCampaignsRes.data ?? [];
  const totalCampaigns = allCampaignsRes.count ?? 0;
  const totalDeals = dealsRes.count ?? 0;
  const reviews = reviewsRes.data ?? [];
  const reviewAvg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;
  const isPremium = totalDeals >= 5 || totalCampaigns >= 3;

  const host = prettyHost(brand.website);
  const initials = brand.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Ancienneté (membre depuis)
  const memberSince = brand.created_at
    ? new Date(brand.created_at).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <AppOrLandingShell contentClassName="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/creators"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        <span>←</span> Explorer
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Colonne profil (sticky) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-lg">
            {/* Hero logo avec gradient subtil et badges */}
            <div className="relative flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-zinc-50 px-8 py-10">
              {/* Badges en haut-gauche */}
              <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                {isPremium && (
                  <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                    ★ Marque active
                  </span>
                )}
                {brand.tracking_verified_at && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                    ✓ Tracking
                  </span>
                )}
              </div>
              {/* Note en haut-droite */}
              {reviewAvg !== null && (
                <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink shadow-md ring-1 ring-zinc-100">
                  <span className="text-amber-400">★</span>
                  {reviewAvg.toFixed(1)}
                  <span className="text-zinc-400">· {reviews.length}</span>
                </span>
              )}

              <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-zinc-100">
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-3xl font-extrabold text-zinc-400">
                    {initials}
                  </span>
                )}
              </span>
            </div>

            <div className="p-5">
              <h1 className="font-display text-2xl font-black tracking-tight text-ink">
                {brand.name}
              </h1>
              {brand.sector && (
                <p className="mt-1 text-sm text-zinc-500">{brand.sector}</p>
              )}

              {host && (
                <a
                  href={brand.website ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-sm font-medium text-brand transition hover:bg-zinc-100"
                >
                  🌐 {host}
                </a>
              )}

              {/* CTA contextuel */}
              {isCreatorViewer && user && !isOwnPage ? (
                <form action={openConversation.bind(null, brand.id)} className="mt-5">
                  <button
                    type="submit"
                    className="block w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-bold text-white shadow-md transition hover:opacity-90"
                  >
                    💬 Contacter {brand.name}
                  </button>
                </form>
              ) : !user ? (
                <Link
                  href="/signup"
                  className="mt-5 block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-bold text-white shadow-md transition hover:opacity-90"
                >
                  Devenir créateur·rice
                </Link>
              ) : null}

              {isOwnPage && (
                <Link
                  href="/profile"
                  className="mt-5 block rounded-full px-5 py-3 text-center text-sm font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
                >
                  Éditer mon profil
                </Link>
              )}

              {/* Stats vitales */}
              <dl className="mt-5 grid grid-cols-3 gap-1 border-t border-zinc-100 pt-4 text-center">
                <div>
                  <dt className="font-display text-xl font-black text-ink">
                    {campaigns.length}
                  </dt>
                  <dd className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Campagnes
                  </dd>
                </div>
                <div className="border-x border-zinc-100">
                  <dt className="font-display text-xl font-black text-ink">
                    {totalDeals}
                  </dt>
                  <dd className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Collabs
                  </dd>
                </div>
                <div>
                  <dt className="font-display text-xl font-black text-ink">
                    {reviews.length}
                  </dt>
                  <dd className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Avis
                  </dd>
                </div>
              </dl>

              {/* Trust signals */}
              <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4">
                {memberSince && (
                  <p className="flex items-center gap-2 text-xs text-zinc-600">
                    <span>📅</span>
                    <span>
                      Sur Collabbs depuis <strong>{memberSince}</strong>
                    </span>
                  </p>
                )}
                <p className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="text-emerald-600">🔒</span>
                  <span>Paiement séquestré jusqu&apos;à validation</span>
                </p>
                <p className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="text-emerald-600">📄</span>
                  <span>Contrat auto-généré et signé en 1 clic</span>
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Contenu */}
        <div className="space-y-8">
          {/* À propos */}
          <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-lg font-black text-ink">À propos</h2>
            {brand.description ? (
              <p className="mt-3 whitespace-pre-line leading-relaxed text-zinc-600">
                {brand.description}
              </p>
            ) : (
              <p className="mt-3 text-sm italic text-zinc-400">
                {isOwnPage
                  ? "Ajoute une présentation depuis ton profil pour donner envie aux créateurs."
                  : "Cette marque n'a pas encore renseigné sa présentation."}
              </p>
            )}
          </section>

          {/* Niches ciblées */}
          {niches.length > 0 && (
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                Niches qui les intéressent
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Les types de contenu que cherche {brand.name}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {niches.map((n) => (
                  <span
                    key={n}
                    className="rounded-full bg-purple-50 px-3 py-1.5 text-sm font-semibold text-brand-deep ring-1 ring-inset ring-purple-100"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Leurs réseaux */}
          {platforms.length > 0 && (
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                Leurs réseaux <span className="text-zinc-400">({platforms.length})</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Vérifie leur présence avant d&apos;accepter une collab.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {platforms.map((p) => {
                  const inner = (
                    <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-gradient-to-br from-white to-zinc-50 p-3 transition hover:border-zinc-200 hover:shadow-sm">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
                        {p.slug && <PlatformIcon slug={p.slug} className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{p.label}</p>
                        {p.handle && (
                          <p className="truncate text-xs text-zinc-500">
                            @{p.handle.replace(/^@/, "")}
                          </p>
                        )}
                      </div>
                      {p.url && <span className="text-xs text-zinc-400">↗</span>}
                    </div>
                  );
                  return p.url ? (
                    <a
                      key={`${p.slug}-${p.handle}`}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={`${p.slug}-${p.handle}`}>{inner}</div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Campagnes actives */}
          {campaigns.length > 0 && (
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-lg font-black text-ink">
                  Campagnes actives{" "}
                  <span className="text-zinc-400">({campaigns.length})</span>
                </h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {campaigns.map((c) => {
                  const meta = CAMPAIGN_TYPE_META[c.type] ?? CAMPAIGN_TYPE_META.affiliation;
                  return (
                    <Link
                      key={c.id}
                      href={`/c/${c.id}`}
                      className="group overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className={`h-1 bg-gradient-to-r ${meta.band}`} />
                      <div className="p-4">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                          <span>{meta.emoji}</span>
                          {meta.label}
                        </p>
                        <p className="mt-1 font-display text-base font-black text-ink transition group-hover:text-brand">
                          {c.name}
                        </p>
                        {c.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                            {c.description}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs">
                          {c.fixed_amount ? (
                            <span className="font-bold text-ink">
                              {c.fixed_amount}€ fixe
                            </span>
                          ) : c.commission_value ? (
                            <span className="font-bold text-ink">
                              {c.commission_value}% commission
                            </span>
                          ) : null}
                          {c.spots && (
                            <span className="text-zinc-500">
                              · {c.spots} place{c.spots > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Avis créateurs */}
          <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-black text-ink">
                Avis des créateurs{" "}
                {reviews.length > 0 && (
                  <span className="text-zinc-400">({reviews.length})</span>
                )}
              </h2>
              {reviewAvg !== null && (
                <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                  ★ {reviewAvg.toFixed(1)}
                </span>
              )}
            </div>
            {reviews.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  variant="card"
                  icon="⭐"
                  title="Pas encore d'avis"
                  description="Les avis apparaîtront ici après les premières collaborations clôturées."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {reviews.map((r, i) => {
                  const handle = r.creators?.handle ?? null;
                  const initial = (handle ?? "C").slice(0, 1).toUpperCase();
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-zinc-100 bg-gradient-to-br from-white to-zinc-50/50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-sm font-bold text-purple-700">
                          {initial}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-ink">
                              {handle ? `@${handle}` : "Créateur·rice"}
                            </p>
                            <span className="shrink-0 text-amber-400">
                              {"★".repeat(r.rating)}
                              <span className="text-zinc-200">
                                {"★".repeat(5 - r.rating)}
                              </span>
                            </span>
                          </div>
                          {r.comment && (
                            <p className="mt-1.5 text-sm italic leading-relaxed text-zinc-600">
                              « {r.comment} »
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Comment ça marche — visiteur anon créateur */}
          {!user && (
            <section className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-pink-50/30 p-5 sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                Comment travailler avec {brand.name} ?
              </h2>
              <ol className="mt-4 space-y-3">
                {[
                  { n: 1, t: "Crée ton compte créateur", d: "Photo, niches, offres — 5 minutes." },
                  { n: 2, t: "Active leurs liens d'affiliation", d: "1 clic depuis les campagnes ouvertes." },
                  { n: 3, t: "Ou candidate à un deal fixe", d: "La marque répond, tu signes le contrat." },
                  { n: 4, t: "Tu livres, tu es payé", d: "Paiement automatique post-validation." },
                ].map((s) => (
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
              <Link
                href="/signup?role=creator"
                className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Devenir créateur·rice →
              </Link>
            </section>
          )}
        </div>
      </div>
    </AppOrLandingShell>
  );
}
