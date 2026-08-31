import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, articleParSlug, articlesTries } from "@/lib/blog";
import { SITE } from "@/lib/legal-entity";
import Blocs from "../Blocs";

/**
 * Un article.
 *
 * `generateStaticParams` fait pré-calculer chaque article au moment de la
 * construction : ce sont des pages qui ne changent jamais, il n'y a aucune
 * raison de les recalculer à chaque visite — et une page instantanée est aussi
 * une page que Google préfère.
 */
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleParSlug(slug);
  if (!a) return { title: "Article introuvable — Collabbs" };
  return {
    // Le titre d'onglet est aussi celui affiché par Google : il porte la
    // recherche visée, pas le nom du site en premier.
    title: `${a.titre} — Collabbs`,
    description: a.description,
    alternates: { canonical: `${SITE.url}/blog/${a.slug}` },
    openGraph: {
      title: a.titre,
      description: a.description,
      url: `${SITE.url}/blog/${a.slug}`,
      type: "article",
      publishedTime: a.publieLe,
    },
  };
}

const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articleParSlug(slug);
  if (!article) notFound();

  const autres = articlesTries().filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/blog" className="text-sm font-medium text-zinc-500 hover:text-ink">
        ← Toutes les ressources
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-full bg-purple-50 px-3 py-1 font-semibold text-purple-700">
          {article.categorie}
        </span>
        <span className="text-zinc-400">
          {dateFr(article.publieLe)} · {article.lecture} min de lecture
        </span>
      </div>

      <h1 className="mt-4 font-display text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
        {article.titre}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-500">{article.description}</p>

      <hr className="my-10 border-zinc-100" />

      <article>
        <Blocs contenu={article.contenu} />
      </article>

      {/* Les sources, en clair. Un article de droit sans sources vérifiables ne
          vaut rien — et c'est précisément la confiance qu'on vend. */}
      {article.sources.length > 0 && (
        <div className="mt-12 rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Sources</p>
          <ul className="mt-3 space-y-2">
            {article.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-600 underline underline-offset-2 hover:text-ink"
                >
                  {s.titre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {autres.length > 0 && (
        <div className="mt-12">
          <p className="font-display text-lg font-black text-ink">À lire aussi</p>
          <div className="mt-4 space-y-3">
            {autres.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="block rounded-2xl border border-zinc-100 bg-white p-4 transition hover:border-zinc-200 hover:shadow-sm"
              >
                <p className="font-semibold text-ink">{a.titre}</p>
                <p className="mt-1 text-sm text-zinc-500">{a.description.slice(0, 110)}…</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
