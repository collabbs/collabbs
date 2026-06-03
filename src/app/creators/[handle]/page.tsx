import { notFound } from "next/navigation";
import Link from "next/link";
import AppOrLandingShell from "@/components/app/AppOrLandingShell";
import PlatformIcon from "@/components/PlatformIcon";
import EmptyState from "@/components/EmptyState";
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
    <AppOrLandingShell contentClassName="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/creators"
        className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        <span>←</span> Tous les créateurs
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Colonne profil (sticky) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-lg">
            <div
              className="relative aspect-[4/5] bg-cover bg-center"
              style={{
                backgroundImage: c.photo ? `url("${c.photo}"), ${c.tint}` : c.tint,
              }}
            >
              {/* Gradient sombre en bas pour les infos overlay */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              {/* Badges contextuels en haut à gauche */}
              <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
                {c.isTop && (
                  <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                    ★ Top créateur
                  </span>
                )}
                {c.isVerified && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                      <path d="M12 2 9.6 4.3 6.5 4l-.6 3-2.7 1.7L4.7 12l-1.5 3 2.7 1.7.6 3 3.1-.3L12 22l2.4-2.6 3.1.3.6-3 2.7-1.7-1.5-3 1.5-3-2.7-1.7-.6-3-3.1.3L12 2Zm-1 13.5-3.5-3.5 1.4-1.4 2.1 2.1L15.7 8l1.4 1.4-6.1 6.1Z" />
                    </svg>
                    Vérifié
                  </span>
                )}
                {c.isNew && !c.isTop && (
                  <span className="rounded-full bg-purple-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-md">
                    ✨ Nouveau
                  </span>
                )}
              </div>

              {/* Note en haut à droite */}
              <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                <span className="text-amber-300">★</span>
                {c.rating.toFixed(1)}
                {c.reviewsCount > 0 && (
                  <span className="text-white/75">· {c.reviewsCount}</span>
                )}
              </span>

              {/* Nom + handle overlay sur la photo */}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h1 className="font-display text-3xl font-black tracking-tight text-white drop-shadow-md">
                  {c.name}
                </h1>
                <p className="text-sm font-medium text-white/85 drop-shadow">@{c.handle}</p>
              </div>
            </div>

            <div className="p-5">
              {/* Niches + plateforme principale */}
              <div className="flex flex-wrap items-center gap-2">
                {c.niches.slice(0, 3).map((n) => (
                  <span
                    key={n}
                    className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep"
                  >
                    {n}
                  </span>
                ))}
                {c.mainPlatform && (
                  <span className="flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                    <PlatformIcon slug={c.mainPlatform.slug} className="h-3.5 w-3.5" />
                    {c.totalFollowers}
                  </span>
                )}
              </div>

              {/* CTA */}
              {isBrandViewer ? (
                <div className="mt-5 space-y-2">
                  <form action={createDirectDeal.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="block w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-bold text-white shadow-md transition hover:opacity-90"
                    >
                      🤝 Proposer une collaboration
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
                  className="mt-5 block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-center text-sm font-bold text-white shadow-md transition hover:opacity-90"
                >
                  Collaborer avec {first}
                </Link>
              )}

              {/* Stats vitaux */}
              <dl className="mt-5 grid grid-cols-3 gap-1 border-t border-zinc-100 pt-4 text-center">
                <div>
                  <dt className="font-display text-xl font-black text-ink">
                    {c.totalFollowers}
                  </dt>
                  <dd className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Abonnés
                  </dd>
                </div>
                <div className="border-x border-zinc-100">
                  <dt className="font-display text-xl font-black text-ink">
                    {c.engagement}
                  </dt>
                  <dd className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Engagement
                  </dd>
                </div>
                <div>
                  <dt className="font-display text-xl font-black text-ink">
                    {c.dealsCount}
                  </dt>
                  <dd className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    Collabs
                  </dd>
                </div>
              </dl>

              {/* Trust signals */}
              <div className="mt-4 space-y-1.5 border-t border-zinc-100 pt-4">
                <p className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="text-emerald-600">⚡</span>
                  <span>Répond généralement en moins de 24h</span>
                </p>
                <p className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="text-emerald-600">🔒</span>
                  <span>Paiement séquestré jusqu&apos;à livraison</span>
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
            <p className="mt-3 whitespace-pre-line leading-relaxed text-zinc-600">{bio}</p>
          </section>

          {/* Portfolio — vidéos / contenus phares du créateur */}
          {c.portfolio.length > 0 && (
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                Portfolio{" "}
                <span className="text-zinc-400">({c.portfolio.length})</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Quelques exemples de ce que {first} sait faire.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {c.portfolio.map((it) => (
                  <a
                    key={it.id}
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg"
                  >
                    <div className="relative aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200">
                      {it.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.thumbnailUrl}
                          alt={it.title ?? ""}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {it.platformSlug ? (
                            <PlatformIcon
                              slug={it.platformSlug}
                              className="h-12 w-12 opacity-60"
                            />
                          ) : (
                            <span className="text-4xl opacity-60">🎬</span>
                          )}
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                        <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-ink opacity-0 shadow-md transition group-hover:opacity-100">
                          ▶ Voir
                        </span>
                      </div>
                    </div>
                    {it.title && (
                      <div className="p-3">
                        <p className="line-clamp-2 text-sm font-bold text-ink">
                          {it.title}
                        </p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Réseaux — chaque card est cliquable vers le compte externe si URL fournie */}
          {c.platforms.length > 0 && (
            <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                Voir ses contenus{" "}
                <span className="text-zinc-400">({c.platforms.length})</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Clique sur un réseau pour voir ses publications.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {c.platforms.map((p) => {
                  const inner = (
                    <div
                      className={`flex items-center gap-3 rounded-xl border border-zinc-100 p-3 transition ${
                        p.url
                          ? "bg-gradient-to-br from-white to-zinc-50 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
                          : "bg-white"
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
                        <PlatformIcon slug={p.slug} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink">{p.label}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {p.handle ? `@${p.handle.replace(/^@/, "")} · ` : ""}
                          {p.followers} abonnés
                        </p>
                      </div>
                      {p.url && (
                        <span
                          aria-hidden="true"
                          className="text-zinc-300 transition group-hover:text-brand"
                        >
                          ↗
                        </span>
                      )}
                    </div>
                  );
                  return p.url ? (
                    <a
                      key={p.slug}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={p.slug}>{inner}</div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Offres */}
          <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-lg font-black text-ink">
              Ce que propose {first}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {c.offers.length} format{c.offers.length > 1 ? "s" : ""} de collaboration
              disponible{c.offers.length > 1 ? "s" : ""}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {c.offers.map((id) => {
                const o = OFFER_BY_ID[id];
                const paid = id === "ugc" || id === "post" || id === "story";
                return (
                  <div
                    key={id}
                    className="rounded-2xl border border-zinc-100 bg-gradient-to-br from-white to-zinc-50/50 p-4 transition hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-xl">
                        {o.emoji}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-ink">{o.label}</p>
                        <p className="text-xs text-zinc-500">{o.tag}</p>
                      </div>
                    </div>
                    {paid && c.priceFrom !== null && (
                      <p className="mt-3 border-t border-zinc-100 pt-3 text-sm">
                        <span className="text-zinc-500">À partir de </span>
                        <span className="font-display text-lg font-black text-ink">
                          {c.priceFrom}€
                        </span>
                      </p>
                    )}
                    {!paid && (
                      <p className="mt-3 border-t border-zinc-100 pt-3 text-xs font-semibold text-brand-deep">
                        💎 À la performance · défini par campagne
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Avis */}
          <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-black text-ink">
                Avis des marques{" "}
                {reviews.length > 0 && (
                  <span className="text-zinc-400">({reviews.length})</span>
                )}
              </h2>
              {reviews.length > 0 && (
                <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                  ★ {c.rating.toFixed(1)}
                </span>
              )}
            </div>
            {reviews.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  variant="card"
                  icon="⭐"
                  title="Pas encore d'avis"
                  description={`Les avis des marques apparaîtront ici après une première collaboration avec ${first}.`}
                />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {reviews.map((r, i) => {
                  const initial = (r.brandName ?? "M").slice(0, 1).toUpperCase();
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
                            <p className="text-sm font-bold text-ink">{r.brandName}</p>
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

          {/* Comment ça marche — réduit la friction visiteur */}
          {!isBrandViewer && (
            <section className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-pink-50/30 p-5 sm:p-6">
              <h2 className="font-display text-lg font-black text-ink">
                Comment collaborer avec {first} ?
              </h2>
              <ol className="mt-4 space-y-3">
                {[
                  { n: 1, t: "Crée ton compte marque", d: "30 secondes, sans engagement." },
                  { n: 2, t: "Propose la collab", d: `Choisis un format, indique tes objectifs.` },
                  { n: 3, t: "Paiement séquestré", d: "Tu paies, on bloque les fonds jusqu'à livraison validée." },
                  { n: 4, t: "Livraison + paiement", d: `${first} livre, tu valides, on verse.` },
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
                href="/signup?role=brand"
                className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Créer mon compte marque →
              </Link>
            </section>
          )}
        </div>
      </div>
    </AppOrLandingShell>
  );
}
