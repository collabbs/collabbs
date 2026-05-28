import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Route protégée : pas de session → on renvoie vers la connexion
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  const roleLabel = profile?.role === "brand" ? "Marque 🏢" : "Créateur 🎨";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
          {roleLabel}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Bienvenue{profile?.display_name ? `, ${profile.display_name}` : ""} 👋
        </h1>
        <p className="mt-2 text-zinc-600">
          Tu es connecté à Collabbs. Ton espace personnalisé arrive bientôt — pour
          l&apos;instant, cette page prouve juste que l&apos;authentification
          fonctionne de bout en bout.
        </p>
        <dl className="mt-6 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-sm">
          <dt className="text-zinc-400">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-zinc-400">Rôle</dt>
          <dd>{profile?.role ?? "—"}</dd>
        </dl>

        <form action={logout} className="mt-8">
          <button
            type="submit"
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
