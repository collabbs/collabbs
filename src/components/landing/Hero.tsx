import Link from "next/link";
import { FEATURED_CREATORS } from "./creators";
import CreatorCard from "./CreatorCard";
import NetworkLinks from "./NetworkLinks";

const STATS = [
  { value: "1 200+", label: "Créateurs actifs" },
  { value: "340+", label: "Marques" },
  { value: "0%", label: "Commission créateurs" },
  { value: "48h", label: "Délai moyen de match" },
];

export default function Hero() {
  const colA = FEATURED_CREATORS.filter((_, i) => i % 2 === 0);
  const colB = FEATURED_CREATORS.filter((_, i) => i % 2 === 1);

  return (
    <section className="relative overflow-hidden">
      {/* halos décoratifs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-32 h-[560px] w-[560px] rounded-full bg-gradient-to-br from-purple-300/40 to-pink-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-40 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-cyan-200/30 to-purple-200/20 blur-3xl"
      />

      <div className="relative mx-auto grid grid-cols-1 max-w-[1600px] gap-10 px-6 py-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-12 lg:py-0">
        {/* Colonne texte */}
        <div className="flex min-w-0 flex-col justify-center lg:h-[calc(100svh-4rem)]">
          <span className="animate-fade-up inline-flex w-fit items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-brand-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            2 480 deals signés · 0 impayé
          </span>

          <h1
            className="animate-fade-up mt-4 font-display text-5xl font-black leading-[1.02] tracking-tight text-ink sm:text-6xl"
            style={{ animationDelay: "0.05s" }}
          >
            La plateforme qui connecte
            <br />
            <span className="bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_50%,#06b6d4_100%)] bg-clip-text text-transparent">
              créateurs &amp; marques
            </span>
          </h1>

          <p
            className="animate-fade-up mt-4 max-w-xl text-lg leading-relaxed text-zinc-600"
            style={{ animationDelay: "0.1s" }}
          >
            Trouvez le créateur idéal et collaborez comme vous voulez — UGC,
            vidéo, story, paiement à la performance ou affiliation en 1 clic.
            Contrats automatiques, paiement sécurisé.
          </p>

          {/* Barre de recherche → /creators */}
          <form
            action="/creators"
            className="animate-fade-up mt-6 max-w-xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-zinc-400">
                Par réseau
              </span>
              <NetworkLinks />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                name="q"
                placeholder="Rechercher une niche, un créateur…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Rechercher
              </button>
            </div>
          </form>

          <p
            className="animate-fade-up mt-4 text-sm text-zinc-500"
            style={{ animationDelay: "0.2s" }}
          >
            Vous êtes créateur ?{" "}
            <Link href="/signup" className="font-semibold text-brand hover:underline">
              Rejoignez 1 200+ créateurs — c&apos;est gratuit →
            </Link>
          </p>

          {/* Stats */}
          <dl
            className="animate-fade-up mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-zinc-100 pt-6"
            style={{ animationDelay: "0.25s" }}
          >
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-extrabold tracking-tight text-ink">
                  {stat.value}
                </dt>
                <dd className="text-xs text-zinc-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Colonne droite — défilement vertical infini (desktop uniquement) */}
        <div className="marquee-pause hidden h-[calc(100svh-4rem)] grid-cols-2 gap-5 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_8%,#000_92%,transparent)] lg:grid">
          <div className="marquee-up flex flex-col gap-5">
            {[...colA, ...colA].map((c, i) => (
              <CreatorCard key={`a-${i}`} creator={c} />
            ))}
          </div>
          <div className="marquee-down flex flex-col gap-5">
            {[...colB, ...colB].map((c, i) => (
              <CreatorCard key={`b-${i}`} creator={c} />
            ))}
          </div>
        </div>

        {/* Défilement horizontal automatique (mobile uniquement) — contenu borné, aucun débordement */}
        <div className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)] lg:hidden">
          <div className="marquee-left flex w-max gap-4">
            {[...FEATURED_CREATORS, ...FEATURED_CREATORS].map((c, i) => (
              <div key={`m-${i}`} className="w-40 shrink-0">
                <CreatorCard creator={c} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
