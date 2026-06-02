import Link from "next/link";

/**
 * État vide réutilisable. Pattern : grosse icône emoji circulaire +
 * titre serré + 1-2 lignes de copy + CTA optionnel.
 *
 * Évite les "Aucun X" en gris-cassant — donne de l'âme à chaque trou.
 */
export default function EmptyState({
  icon = "📭",
  title,
  description,
  cta,
  variant = "default",
}: {
  icon?: string;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  /** "default" = carte sur fond zinc ; "card" = pour mettre dans une carte parente. */
  variant?: "default" | "card";
}) {
  const wrap =
    variant === "default"
      ? "rounded-3xl border border-dashed border-zinc-200 bg-white/50 px-6 py-12 text-center"
      : "px-2 py-8 text-center";

  return (
    <div className={wrap}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-3xl">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-black text-ink">{title}</h3>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-500">
          {description}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-5 inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
