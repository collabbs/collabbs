import type { ReactNode } from "react";
import type { ContractDocument } from "@/lib/contract-template";

/**
 * Affichage d'un contrat, lisible et imprimable.
 *
 * Partagé par le contrat d'une collaboration et le contrat-cadre
 * d'affiliation. Deux rendus séparés finiraient par diverger — et un contrat
 * qui ne s'affiche pas de la même façon selon la page n'inspire rien de bon.
 *
 * Rendu à partir du `terms_snapshot` figé à la signature, jamais des données
 * actuelles : si une partie change d'adresse demain, le contrat signé garde
 * celle du jour de la signature.
 */

/** Rend le gras `**...**` des paragraphes du modèle. */
export function RichText({ text }: { text: string }) {
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

export function dateTimeFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ContractView({
  doc,
  eyebrow,
  notice,
  brandSignedAt,
  creatorSignedAt,
  unsignedLabel = "—",
}: {
  doc: ContractDocument;
  /** Ligne de surtitre : nature du contrat. */
  eyebrow: string;
  /** Encarts d'avertissement propres au contexte (forme simplifiée, résiliation…). */
  notice?: ReactNode;
  brandSignedAt: string | null;
  creatorSignedAt: string | null;
  /** Ce qu'on affiche tant qu'une partie n'a pas signé. */
  unsignedLabel?: string;
}) {
  return (
    <article className="mx-auto max-w-3xl bg-white px-6 py-10 text-[15px] leading-relaxed text-zinc-700 print:px-0 print:py-0 sm:px-10">
      <header className="border-b border-zinc-200 pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-400">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-ink">
          {doc.parties.brand.legal_name || doc.parties.brand.display_name}
          <span className="text-zinc-300"> × </span>
          {doc.parties.creator.legal_name || doc.parties.creator.display_name}
        </h1>
        <p className="mt-2 font-mono text-sm text-zinc-500">{doc.reference}</p>
        {notice}
      </header>

      <div className="mt-8 flex flex-col gap-7">
        {doc.clauses.map((c) => (
          <section key={c.number} className="break-inside-avoid">
            <h2 className="font-display text-lg font-bold text-ink">
              Article {c.number} — {c.title}
            </h2>
            <div className="mt-2 flex flex-col gap-2">
              {c.paragraphs.map((p, i) => (
                <p key={i}>
                  <RichText text={p} />
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 break-inside-avoid border-t border-zinc-200 pt-6">
        <h2 className="font-display text-lg font-bold text-ink">Signatures</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              Pour l&apos;annonceur
            </p>
            <p className="mt-1 font-semibold text-ink">
              {doc.parties.brand.rep_name ||
                doc.parties.brand.legal_name ||
                doc.parties.brand.display_name}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {brandSignedAt ? `Signé le ${dateTimeFr(brandSignedAt)}` : unsignedLabel}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">
              Pour le créateur
            </p>
            <p className="mt-1 font-semibold text-ink">
              {doc.parties.creator.rep_name ||
                doc.parties.creator.legal_name ||
                doc.parties.creator.display_name}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {creatorSignedAt
                ? `Signé le ${dateTimeFr(creatorSignedAt)}`
                : unsignedLabel}
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-8 flex flex-col gap-2 border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500">
        {doc.footer.map((f, i) => (
          <p key={i}>
            <RichText text={f} />
          </p>
        ))}
      </footer>
    </article>
  );
}
