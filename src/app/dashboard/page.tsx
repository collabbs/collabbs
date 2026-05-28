import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import Logo from "@/components/landing/Logo";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, creatorRes, nicheCountRes, offerCountRes, platformCountRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, role, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase.from("creators").select("handle, bio").eq("id", user.id).maybeSingle(),
      supabase
        .from("creator_niches")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", user.id),
      supabase
        .from("creator_offers")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", user.id),
      supabase
        .from("creator_platforms")
        .select("*", { count: "exact", head: true })
        .eq("creator_id", user.id),
    ]);

  const profile = profileRes.data;
  const isCreator = profile?.role === "creator";

  const checklist = [
    { label: "Photo de profil", done: Boolean(profile?.avatar_url), weight: 25 },
    { label: "Identifiant", done: Boolean(creatorRes.data?.handle), weight: 15 },
    { label: "Au moins une niche", done: (nicheCountRes.count ?? 0) > 0, weight: 20 },
    { label: "Au moins un réseau", done: (platformCountRes.count ?? 0) > 0, weight: 20 },
    { label: "Au moins une offre", done: (offerCountRes.count ?? 0) > 0, weight: 20 },
  ];
  const completion = checklist.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  const listable =
    Boolean(profile?.avatar_url) &&
    (nicheCountRes.count ?? 0) > 0 &&
    (offerCountRes.count ?? 0) > 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Logo />
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-500 transition hover:text-ink"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <span className="inline-block rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
          {isCreator ? "Créateur 🎨" : "Marque 🏢"}
        </span>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-ink">
          Bienvenue{profile?.display_name ? `, ${profile.display_name}` : ""} 👋
        </h1>

        {isCreator && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-ink">
                  {listable ? "Ton profil est visible 🎉" : "Complète ton profil"}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    listable
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {listable ? "✓ Visible par les marques" : "Non visible"}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                {listable
                  ? "Les marques peuvent te trouver dans la marketplace et te proposer des deals."
                  : "Ajoute une photo, une niche et une offre pour apparaître dans la marketplace."}
              </p>

              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-ink">{completion}%</span>
              </div>

              <ul className="mt-4 flex flex-wrap gap-2">
                {checklist.map((c) => (
                  <li
                    key={c.label}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      c.done
                        ? "bg-zinc-100 text-zinc-400 line-through"
                        : "bg-purple-50 text-brand-deep"
                    }`}
                  >
                    {c.done ? "✓ " : "+ "}
                    {c.label}
                  </li>
                ))}
              </ul>

              <Link
                href="/onboarding/creator"
                className="mt-6 inline-flex rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {completion === 0
                  ? "Créer mon profil"
                  : listable
                    ? "Modifier mon profil"
                    : "Compléter mon profil"}
              </Link>
            </div>
          </section>
        )}

        <p className="mt-8 text-sm text-zinc-400">
          Ton espace complet (deals, messages, paiements) arrive bientôt.
        </p>
      </main>
    </div>
  );
}
