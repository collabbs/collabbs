import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";

export const metadata = { title: "Mot de passe oublié — Collabbs" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Mot de passe oublié
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          On t&apos;envoie un lien par email pour le redéfinir.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">
              📩 Si un compte existe avec cet email, un lien vient d&apos;être envoyé.
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Vérifie ta boîte (et les spams). Le lien expire après 1 heure.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}
            <form action={requestPasswordReset} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
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
              <button
                type="submit"
                className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Recevoir le lien
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-purple-600 hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
