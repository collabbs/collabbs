import Link from "next/link";
import { login } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Connexion
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Content de te revoir 👋</p>

        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </p>
        )}

        <form action={login} className="mt-6 space-y-5">
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
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Mot de passe
              </label>
              <Link
                href="/reset"
                className="text-xs font-medium text-purple-600 hover:underline"
              >
                Oublié ?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Se connecter
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-purple-600 hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </main>
  );
}
