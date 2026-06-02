import { notFound } from "next/navigation";
import Link from "next/link";
import AppOrLandingShell from "@/components/app/AppOrLandingShell";
import PlatformIcon from "@/components/PlatformIcon";
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
    .select("id, name, sector, website, logo_url, description, tracking_verified_at")
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

  // Niches, réseaux propres, campagnes actives, reviews.
  const [bNichesRes, bPlatformsRes, campaignsRes, reviewsRes] = await Promise.all([
    supabase
      .from("brand_niches")
      .select("niches(label)")
      .eq("brand_id", brand.id),
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
  const campaigns = campaignsRes.data ?? [];
  const reviews = reviewsRes.data ?? [];
  const reviewAvg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  const host = prettyHost(brand.website);
  const initials = brand.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppOrLandingShell contentClassName="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/creators"
        className="text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        ← Explorer
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* Colonne profil (sticky) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
            <div className="flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-8">
              <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-zinc-200">
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
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                >
                  🌐 {host}
                </a>
              )}

              {reviewAvg !== null && (
                <p className="mt-3 text-sm text-zinc-600">
                  <span className="font-semibold text-amber-500">
                    ★ {reviewAvg.toFixed(1)}
                  </span>{" "}
                  <span className="text-zinc-400">
                    ({reviews.length} avis créateur·rice)
                  </span>
                </p>
              )}

              {brand.tracking_verified_at && (
                <p className="mt-2 text-xs font-medium text-emerald-600">
                  ✓ Tracking affiliation vérifié
                </p>
              )}

              {isCreatorViewer && user && !isOwnPage ? (
                <form action={openConversation.bind(null, brand.id)} className="mt-5">
                  <button
                    type="submit"
                    className="block w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    💬 Contacter {brand.name}
                  </button>
                </form>
              ) : !user ? (
                <Link
                  href="/signup"
                  className="mt-5 block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Créer un compte créateur
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
            </div>
          </div>
        </aside>

        {/* Contenu */}
        <div className="space-y-8">
          {brand.description ? (
            <section>
              <h2 className="font-display text-xl font-black text-ink">À propos</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
                {brand.description}
              </p>
            </section>
          ) : (
            <section>
              <h2 className="font-display text-xl font-black text-ink">À propos</h2>
              <p className="mt-2 text-sm italic text-zinc-400">
                {isOwnPage
                  ? "Ajoute une présentation depuis ton profil pour donner envie aux créateurs."
                  : "Cette marque n'a pas encore renseigné sa présentation."}
              </p>
            </section>
          )}

          {niches.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-black text-ink">
                Niches qui les intéressent
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {niches.map((n) => (
                  <span
                    key={n}
                    className="rounded-full bg-purple-50 px-3 py-1.5 text-sm font-medium text-brand-deep"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          {platforms.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-black text-ink">Leurs réseaux</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {platforms.map((p) => {
                  const inner = (
                    <span className="flex items-center gap-2 rounded-full border border-zinc-100 bg-white px-3 py-1.5 text-sm shadow-sm transition hover:bg-zinc-50">
                      {p.slug && <PlatformIcon slug={p.slug} className="h-4 w-4" />}
                      <span className="font-medium text-ink">{p.label}</span>
                      {p.handle && (
                        <span className="text-zinc-500">@{p.handle.replace(/^@/, "")}</span>
                      )}
                    </span>
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

          {campaigns.length > 0 && (
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-black text-ink">
                  Campagnes actives{" "}
                  <span className="text-zinc-400">({campaigns.length})</span>
                </h2>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/c/${c.id}`}
                    className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                      {c.type}
                    </p>
                    <p className="mt-1 font-semibold text-ink">{c.name}</p>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {c.description}
                      </p>
                    )}
                    {(c.fixed_amount || c.commission_value) && (
                      <p className="mt-2 text-xs font-medium text-zinc-600">
                        {c.fixed_amount
                          ? `${c.fixed_amount}€ fixe`
                          : `${c.commission_value}% commission`}
                        {c.spots ? ` · ${c.spots} place${c.spots > 1 ? "s" : ""}` : ""}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-xl font-black text-ink">
              Avis des créateurs{" "}
              {reviews.length > 0 && (
                <span className="text-zinc-400">({reviews.length})</span>
              )}
            </h2>
            {reviews.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                <p className="text-sm font-medium text-ink">Pas encore d&apos;avis</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Les avis apparaîtront ici après les premières collaborations clôturées.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {reviews.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">
                        {r.creators?.handle ? `@${r.creators.handle}` : "Créateur·rice"}
                      </p>
                      <span className="text-amber-400">
                        {"★".repeat(r.rating)}
                        <span className="text-zinc-200">
                          {"★".repeat(5 - r.rating)}
                        </span>
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-sm text-zinc-600">« {r.comment} »</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppOrLandingShell>
  );
}
