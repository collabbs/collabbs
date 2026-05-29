import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_BY_ID } from "@/components/landing/creators";
import { getCreatorByHandle, getCreatorReviews } from "@/lib/creators-data";
import { createClient } from "@/lib/supabase/server";
import { createDirectDeal } from "@/app/(app)/deals/actions";
import { openConversation } from "@/app/(app)/messages/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const c = await getCreatorByHandle(handle);
  return { title: c ? `${c.name} (@${c.handle}) — Collabbs` : "Créateur — Collabbs" };
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const c = await getCreatorByHandle(handle);
  if (!c) notFound();

  const reviews = await getCreatorReviews(c.id);
  const first = c.name.split(" ")[0];

  // Viewer : une marque connectée peut booker / contacter directement.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isBrandViewer = false;
  if (user && user.id !== c.id) {
    const { data: vp } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isBrandViewer = vp?.role === "brand";
  }
  const niche = c.niches[0] ?? "lifestyle";
  const bio =
    c.bio ??
    `${first} crée du contenu ${niche.toLowerCase()} authentique et partage ses coups de cœur avec une communauté de ${c.totalFollowers} abonnés très engagée (${c.engagement} d'engagement moyen). Ouvert·e aux collaborations qui font sens avec sa ligne éditoriale.`;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/creators"
          className="text-sm font-medium text-zinc-500 transition hover:text-ink"
        >
          ← Tous les créateurs
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
          {/* Colonne profil (sticky) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
              <div
                className="relative aspect-[4/5] bg-cover bg-center"
                style={{
                  backgroundImage: c.photo
                    ? `url("${c.photo}"), ${c.tint}`
                    : c.tint,
                }}
              >
                <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                  ★ {c.rating.toFixed(1)}
                </span>
              </div>
              <div className="p-5">
                <h1 className="font-display text-2xl font-black tracking-tight text-ink">
                  {c.name}
                </h1>
                <p className="text-sm text-zinc-500">@{c.handle}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep">
                    {niche}
                  </span>
                  {c.mainPlatform && (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <PlatformIcon slug={c.mainPlatform.slug} className="h-4 w-4" />
                      {c.mainPlatform.label} · {c.totalFollowers}
                    </span>
                  )}
                </div>

                {isBrandViewer ? (
                  <div className="mt-5 space-y-2">
                    <form action={createDirectDeal.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="block w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        Proposer une collaboration
                      </button>
                    </form>
                    <form action={openConversation.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="block w-full rounded-full px-5 py-2.5 text-center text-sm font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
                      >
                        💬 Contacter {first}
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/signup"
                    className="mt-5 block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Collaborer avec {first}
                  </Link>
                )}

                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4 text-center">
                  <div>
                    <dt className="text-lg font-extrabold text-ink">{c.totalFollowers}</dt>
                    <dd className="text-[11px] text-zinc-500">Abonnés</dd>
                  </div>
                  <div>
                    <dt className="text-lg font-extrabold text-ink">{c.engagement}</dt>
                    <dd className="text-[11px] text-zinc-500">Engagement</dd>
                  </div>
                  <div>
                    <dt className="text-lg font-extrabold text-ink">{c.rating.toFixed(1)}</dt>
                    <dd className="text-[11px] text-zinc-500">Note</dd>
                  </div>
                </dl>
                <p className="mt-3 text-center text-xs text-emerald-600">
                  ⚡ Répond en moins de 24h
                </p>
              </div>
            </div>
          </aside>

          {/* Contenu */}
          <div>
            <section>
              <h2 className="font-display text-xl font-black text-ink">À propos</h2>
              <p className="mt-2 leading-relaxed text-zinc-600">{bio}</p>
            </section>

            {/* Réseaux */}
            {c.platforms.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-xl font-black text-ink">Réseaux</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.platforms.map((p) => (
                    <span
                      key={p.slug}
                      className="flex items-center gap-2 rounded-full border border-zinc-100 bg-white px-3 py-1.5 text-sm shadow-sm"
                    >
                      <PlatformIcon slug={p.slug} className="h-4 w-4" />
                      <span className="font-medium text-ink">{p.label}</span>
                      <span className="text-zinc-400">{p.followers}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="font-display text-xl font-black text-ink">
                Ce que propose {first}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {c.offers.map((id) => {
                  const o = OFFER_BY_ID[id];
                  const paid = id === "ugc" || id === "post" || id === "story";
                  return (
                    <div
                      key={id}
                      className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                    >
                      <span className="text-xl">{o.emoji}</span>
                      <div>
                        <p className="font-semibold text-ink">{o.label}</p>
                        <p className="text-xs text-zinc-500">{o.tag}</p>
                        {paid && c.priceFrom !== null && (
                          <p className="mt-1 text-sm font-bold text-ink">
                            à partir de {c.priceFrom}€
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-xl font-black text-ink">
                Avis des marques{" "}
                {reviews.length > 0 && (
                  <span className="text-zinc-400">({reviews.length})</span>
                )}
              </h2>
              {reviews.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                  <p className="text-sm font-medium text-ink">Pas encore d&apos;avis</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Les avis des marques apparaîtront ici après une première collaboration.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {reviews.map((r, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-ink">{r.brandName}</p>
                        <span className="text-amber-400">
                          {"★".repeat(r.rating)}
                          <span className="text-zinc-200">{"★".repeat(5 - r.rating)}</span>
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
      </main>
      <Footer />
    </>
  );
}
