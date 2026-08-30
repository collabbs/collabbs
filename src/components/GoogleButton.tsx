"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Connexion Google.
 *
 * Le bouton ne demande PAS de rôle : la connexion Google ne transmet aucune
 * métadonnée à la base. Le rôle est demandé après coup, sur `/onboarding/role`,
 * où l'aiguillage de `/start` envoie tout compte dont le rôle n'a pas été
 * confirmé. C'est un écran de plus, et c'est le seul moyen de ne pas décider à
 * la place des gens.
 *
 * ⚠️ Ce bouton n'est rendu que si `googleActif()` (voir `lib/google-auth`) :
 * sans fournisseur configuré, l'appel n'échoue pas, il emmène l'utilisateur
 * sur une page d'erreur JSON de Supabase.
 */

export default function GoogleButton({
  label = "Continuer avec Google",
  next,
}: {
  label?: string;
  next?: string;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function connecter() {
    setErreur(null);
    setEnCours(true);
    const supabase = createClient();
    const suite = next ? `?next=${encodeURIComponent(next)}` : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${suite}` },
    });
    if (error) {
      setErreur("La connexion Google est indisponible. Utilise ton email pour l'instant.");
      setEnCours(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={connecter}
        disabled={enCours}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-zinc-50 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4h6.6c-.1 1.1-.9 2.8-2.5 3.9l-.1.2 3.6 2.8.3.1c2.3-2.1 3.6-5.2 3.6-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5l-.2.1-3.7 2.9-.1.2C3.3 21.3 7.3 24 12 24Z" />
          <path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.3-2.4V9.5L1.5 6.6l-.1.1A12 12 0 0 0 0 12c0 1.9.5 3.8 1.4 5.4l3.9-3Z" />
          <path fill="#EB4335" d="M12 4.7c2.2 0 3.7.9 4.6 1.7l3.3-3.2C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.4 6.6l3.9 3c.9-2.9 3.6-4.9 6.7-4.9Z" />
        </svg>
        {enCours ? "Ouverture de Google…" : label}
      </button>
      {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
