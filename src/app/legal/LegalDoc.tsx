import Link from "next/link";
import { SITE, TODO } from "@/lib/legal-entity";

/**
 * Mise en page commune aux documents légaux.
 *
 * Un document juridique se lit et se cite : d'où les articles numérotés, les
 * ancres, et une largeur de ligne confortable. Les valeurs non renseignées
 * s'affichent en rouge plutôt que de disparaître — une mention légale fausse
 * est plus dangereuse qu'une mention visiblement manquante.
 */

export type LegalSection = {
  title: string;
  paragraphs: (string | { list: string[] })[];
};

/** Affiche une valeur, en signalant celles qui restent à compléter. */
export function Val({ children }: { children: string }) {
  if (children === TODO) {
    return (
      <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[0.85em] font-semibold text-red-700">
        À COMPLÉTER
      </span>
    );
  }
  return <>{children}</>;
}

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const DOCS = [
  { href: "/legal/mentions", label: "Mentions légales" },
  { href: "/legal/cgu", label: "Conditions d'utilisation" },
  { href: "/legal/cgv", label: "Conditions de vente" },
  { href: "/legal/confidentialite", label: "Confidentialité" },
];

export default function LegalDoc({
  title,
  intro,
  sections,
  current,
  children,
}: {
  title: string;
  intro?: string;
  sections?: LegalSection[];
  current: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        ← {SITE.name}
      </Link>

      <h1 className="mt-6 font-display text-4xl font-black tracking-tight text-ink">
        {title}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Dernière mise à jour : {SITE.updatedAt}
      </p>
      {intro && (
        <p className="mt-5 text-[17px] leading-relaxed text-zinc-600">{intro}</p>
      )}

      {children}

      {sections && (
        <div className="mt-10 flex flex-col gap-9">
          {sections.map((s, i) => (
            <section key={s.title} id={`article-${i + 1}`} className="scroll-mt-8">
              <h2 className="font-display text-xl font-bold text-ink">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 flex flex-col gap-3 text-[15px] leading-relaxed text-zinc-700">
                {s.paragraphs.map((p, j) =>
                  typeof p === "string" ? (
                    <p key={j}>
                      <Rich text={p} />
                    </p>
                  ) : (
                    <ul key={j} className="flex list-disc flex-col gap-1.5 pl-5">
                      {p.list.map((li, k) => (
                        <li key={k}>
                          <Rich text={li} />
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <nav className="mt-14 border-t border-zinc-200 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Autres documents
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {DOCS.filter((d) => d.href !== current).map((d) => (
            <li key={d.href}>
              <Link href={d.href} className="text-purple-700 underline underline-offset-2">
                {d.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
