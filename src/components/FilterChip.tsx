"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Chip de filtre avec feedback INSTANTANÉ.
 *
 * Problème résolu : avec un simple `<Link>`, le visuel "actif" n'apparaît
 * qu'après la navigation server-side (200-500 ms sur mobile). L'utilisateur
 * doute que son tap a marché.
 *
 * Ici :
 * - Au clic, l'état optimiste bascule TOUT DE SUITE (visuel optimiste).
 * - La nav est lancée en arrière-plan via `useTransition` (non-bloquante).
 * - Pendant la transition, `useOptimistic` montre la valeur basculée.
 * - Quand le nouveau RSC arrive et que la prop `active` change, React
 *   réinitialise automatiquement l'optimistic à la nouvelle vérité serveur.
 *
 * Le `<a href>` garde le clic-droit "Ouvrir dans un nouvel onglet".
 */
export default function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(active);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Modifier-click → laisse le navigateur ouvrir dans un nouvel onglet.
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    startTransition(() => {
      setShown(!active);
      router.push(href);
    });
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={`inline-flex select-none items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
        shown
          ? "bg-ink text-white shadow-sm"
          : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300"
      }`}
    >
      {label}
    </a>
  );
}
