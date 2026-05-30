import Link from "next/link";
import { signup } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; role?: string; next?: string }>;
}) {
  const params = await searchParams;
  const lockedRole = params.role === "creator" || params.role === "brand" ? params.role : null;
  const nextPath = params.next ?? "";

  // Écran "vérifie tes emails" après inscription réussie
  if (params.success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-2xl">
            📧
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Vérifie tes emails</h1>
          <p className="mt-3 text-zinc-600">
            On t&apos;a envoyé un lien de confirmation. Clique dessus pour activer
            ton compte Collabbs, puis connecte-toi.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Aller à la connexion
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Rejoindre Collabbs
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Crée ton compte en 30 secondes.</p>

        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </p>
        )}

        <form action={signup} className="mt-6 space-y-5">
          {/* Champ caché pour revenir où l'utilisateur a démarré (ex. /c/[id]) */}
          {nextPath && <input type="hidden" name="next" value={nextPath} />}

          {/* Choix du rôle (verrouillé si imposé via ?role=) */}
          {lockedRole ? (
            <>
              <input type="hidden" name="role" value={lockedRole} />
              <div className="rounded-xl border border-purple-300 bg-purple-50 p-3 text-center text-sm font-medium text-purple-700">
                {lockedRole === "creator" ? "🎨 Inscription en tant que créateur" : "🏢 Inscription en tant que marque"}
              </div>
            </>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-zinc-700">
                Je suis…
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="creator"
                    defaultChecked
                    className="peer sr-only"
                  />
                  <div className="rounded-xl border border-zinc-200 p-4 text-center text-sm font-medium transition peer-checked:border-purple-500 peer-checked:bg-purple-50 peer-checked:text-purple-700">
                    🎨 Créateur
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="brand"
                    className="peer sr-only"
                  />
                  <div className="rounded-xl border border-zinc-200 p-4 text-center text-sm font-medium transition peer-checked:border-pink-500 peer-checked:bg-pink-50 peer-checked:text-pink-700">
                    🏢 Marque
                  </div>
                </label>
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="display_name" className="mb-1 block text-sm font-medium text-zinc-700">
              Nom
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              placeholder="Ton nom ou celui de ta marque"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
            <p className="mt-1 text-xs text-zinc-400">6 caractères minimum.</p>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Créer mon compte
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-purple-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
