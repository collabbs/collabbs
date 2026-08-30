import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/landing/Logo";
import { confirmerRole } from "./actions";

export const metadata = { title: "Créateur ou marque ? — Collabbs" };

/**
 * Écran de choix du rôle.
 *
 * Il n'existe que pour les comptes arrivés SANS rôle : la connexion Google ne
 * transmet aucune métadonnée, et la base retombe alors sur « créateur ». Sans
 * cet écran, une marque qui s'inscrit avec Google devient créatrice en
 * silence, avec une ligne `creators` à son nom et aucun moyen de revenir.
 *
 * On ne le montre à personne d'autre : un compte dont le rôle est confirmé
 * repart aussitôt vers sa marketplace.
 */
export default async function ChoixRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // `role_confirmed` arrive avec la migration 0052 ; les types engendrés
  // depuis la base ne la connaissent pas encore.
  const { data: profil } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => {
          maybeSingle: () => Promise<{
            data: { role_confirmed?: boolean; display_name?: string | null } | null;
          }>;
        };
      };
    };
  })
    .from("profiles")
    .select("role_confirmed, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profil?.role_confirmed) redirect("/start");

  const prenom = (profil?.display_name ?? "").split(" ")[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-12">
      <Logo size={36} />

      <h1 className="mt-10 font-display text-3xl font-black tracking-tight text-ink">
        {prenom ? `Bienvenue ${prenom} —` : "Bienvenue —"} tu viens ici en tant que&nbsp;?
      </h1>
      <p className="mt-3 text-sm text-zinc-500">
        C&apos;est la seule chose qu&apos;on ne peut pas deviner. Elle décide de
        tout le reste : ce que tu vois, ce qu&apos;on te propose, et qui paie
        qui.
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Le choix n&apos;a pas pu être enregistré. Réessaie dans un instant.
        </p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <form action={confirmerRole.bind(null, "creator")}>
          <button
            type="submit"
            className="h-full w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-purple-300 hover:shadow-md"
          >
            <span className="text-3xl">🎬</span>
            <span className="mt-3 block font-display text-lg font-black text-ink">
              Je suis créateur
            </span>
            <span className="mt-1 block text-sm text-zinc-500">
              Je publie du contenu et je veux collaborer avec des marques.
              Collabbs ne me prélève rien.
            </span>
          </button>
        </form>

        <form action={confirmerRole.bind(null, "brand")}>
          <button
            type="submit"
            className="h-full w-full rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-purple-300 hover:shadow-md"
          >
            <span className="text-3xl">🏢</span>
            <span className="mt-3 block font-display text-lg font-black text-ink">
              Je représente une marque
            </span>
            <span className="mt-1 block text-sm text-zinc-500">
              Je cherche des créateurs, je lance des campagnes et je paie les
              collaborations.
            </span>
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-zinc-400">
        Ce choix structure ton compte : écris-nous si tu t&apos;es trompé, on le
        corrige à la main.
      </p>
    </main>
  );
}
