import Link from "next/link";
import { articlesTries } from "@/lib/blog";

export const metadata = {
  title: "Ressources — Collabbs",
  description:
    "Comprendre la réglementation de l'influence commerciale et choisir comment collaborer avec des créateurs. Articles pratiques pour les marques et les créateurs.",
};

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Le sommaire du blog.
 *
 * La plupart des lecteurs n'arriveront JAMAIS ici : ils atterriront
 * directement sur un article depuis une recherche. Cette page sert donc
 * d'abord à ce que les articles soient trouvés — par Google, et par quelqu'un
 * qui vient d'en lire un et en veut un autre.
 */
export default function BlogPage() {
  const articles = articlesTries();

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">Ressources</p>
      <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
        Comprendre avant de collaborer
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
        La réglementation, les formats de collaboration, les tarifs du marché. Écrit pour les
        marques et les créateurs qui veulent savoir où ils mettent les pieds.
      </p>

      <div className="mt-12 space-y-4">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="group block rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-lg"
          >
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-700">
                {a.categorie}
              </span>
              <span className="text-zinc-400">
                {dateFr(a.publieLe)} · {a.lecture} min de lecture
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl font-black text-ink group-hover:text-purple-700">
              {a.titre}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{a.description}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-purple-700">
              Lire l&apos;article →
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-14 rounded-3xl border border-zinc-100 bg-zinc-50 p-6 text-center">
        <p className="font-display text-lg font-black text-ink">
          Collabbs sécurise vos collaborations
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          Contrat écrit conforme, paiement séquestré jusqu&apos;à la livraison, suivi automatique du
          seuil légal. Gratuit pour les créateurs.
        </p>
        <Link
          href="/signup"
          className="mt-5 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
        >
          Créer un compte
        </Link>
      </div>
    </main>
  );
}
