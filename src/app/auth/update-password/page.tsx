import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/app/auth/actions";

export const metadata = { title: "Définir un nouveau mot de passe — Collabbs" };

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Le user doit être authentifié (via le lien de recovery → callback → session).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/reset?error=" + encodeURIComponent("Lien expiré. Redemande un email."));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          Nouveau mot de passe
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choisis un mot de passe d&apos;au moins 8 caractères.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <form action={updatePassword} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Nouveau mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label
              htmlFor="confirm"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Confirmer
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Mettre à jour
          </button>
        </form>
      </div>
    </main>
  );
}
