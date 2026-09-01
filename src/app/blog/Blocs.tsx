import Link from "next/link";
import type { Bloc } from "@/lib/blog";

/**
 * Le rendu d'un article.
 *
 * Volontairement pauvre en options : un article de blog n'a pas besoin de
 * quinze mises en forme, il a besoin d'être lisible. Chaque bloc supplémentaire
 * ici est un bloc que quelqu'un devra choisir en écrivant — et le choix ralentit
 * l'écriture bien plus qu'il n'améliore la page.
 */

/**
 * Rend le gras et les liens, rien d'autre.
 *
 * Deux notations seulement, et c'est délibéré : `**gras**` et `[texte](/chemin)`.
 * Un article a besoin d'insister et de renvoyer ailleurs ; tout le reste est de
 * la décoration qui ralentit l'écriture plus qu'elle n'améliore la page.
 *
 * Les liens internes passent par `Link` — un article qui renvoie vers un outil
 * du site ne doit pas recharger la page entière pour ça.
 */
function Riche({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {morceaux.map((m, i) => {
        if (m.startsWith("**") && m.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {m.slice(2, -2)}
            </strong>
          );
        }
        const lien = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m);
        if (lien) {
          const [, libelle, href] = lien;
          const classe =
            "font-medium text-brand underline underline-offset-2 hover:text-purple-800";
          return href.startsWith("/") ? (
            <Link key={i} href={href} className={classe}>
              {libelle}
            </Link>
          ) : (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={classe}>
              {libelle}
            </a>
          );
        }
        return <span key={i}>{m}</span>;
      })}
    </>
  );
}

export default function Blocs({ contenu }: { contenu: Bloc[] }) {
  return (
    <div className="space-y-5">
      {contenu.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2
                key={i}
                className="pt-6 font-display text-2xl font-black tracking-tight text-ink"
              >
                {b.texte}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-3 font-display text-lg font-bold text-ink">
                {b.texte}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-[17px] leading-relaxed text-zinc-600">
                <Riche texte={b.texte} />
              </p>
            );
          case "liste":
            return (
              <ul key={i} className="space-y-2 pl-1">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3 text-[17px] leading-relaxed text-zinc-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                    <span>
                      <Riche texte={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "encadre":
            return (
              <div
                key={i}
                className={`rounded-2xl border p-5 ${
                  b.ton === "alerte"
                    ? "border-amber-200 bg-amber-50"
                    : "border-zinc-200 bg-zinc-50"
                }`}
              >
                <p
                  className={`font-display font-bold ${
                    b.ton === "alerte" ? "text-amber-900" : "text-ink"
                  }`}
                >
                  {b.titre}
                </p>
                <p
                  className={`mt-1.5 text-[15px] leading-relaxed ${
                    b.ton === "alerte" ? "text-amber-800" : "text-zinc-600"
                  }`}
                >
                  <Riche texte={b.texte} />
                </p>
              </div>
            );
          case "tableau":
            // Le conteneur défile horizontalement : sur téléphone, un tableau
            // large ferait déborder toute la page sinon.
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      {b.entetes.map((e, j) => (
                        <th key={j} className="py-3 pr-4 font-semibold text-ink">
                          {e}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.lignes.map((l, j) => (
                      <tr key={j} className="border-b border-zinc-100">
                        {l.map((c, k) => (
                          <td key={k} className="py-3 pr-4 align-top text-zinc-600">
                            <Riche texte={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "cta":
            return (
              <div
                key={i}
                className="rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white sm:p-8"
              >
                <p className="font-display text-xl font-black">{b.titre}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-white/90">{b.texte}</p>
                <Link
                  href={b.href}
                  className="mt-5 inline-block rounded-full bg-white px-6 py-3 text-sm font-bold text-ink transition hover:opacity-90"
                >
                  {b.libelle}
                </Link>
              </div>
            );
        }
      })}
    </div>
  );
}
