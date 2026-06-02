"use client";

/**
 * Error boundary global pour toutes les routes (App Router).
 * Capture les erreurs serveur ET client. Affiche un écran calme,
 * branding préservé, avec bouton "Réessayer" qui re-render la route.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log côté client — en prod ça remonte dans les outils dev.
    // Vercel logue automatiquement le digest server-side.
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("App error boundary caught:", error);
    }
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-pink-100 text-4xl">
          🛠
        </div>
        <h1 className="mt-6 font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
          Oups, quelque chose s&apos;est mal passé
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          On a logué l&apos;erreur de notre côté. Tu peux réessayer ou rentrer
          au tableau de bord — la plupart du temps un simple rafraîchissement
          suffit.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-xs text-zinc-400">
            Référence : <span className="select-all">{error.digest}</span>
          </p>
        )}

        <div className="mt-7 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="w-full rounded-full px-6 py-2.5 text-sm font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 sm:w-auto"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
