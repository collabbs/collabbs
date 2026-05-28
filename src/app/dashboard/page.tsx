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

  const profileRes = await supabase
    .from("profiles")
    .select("display_name, role, avatar_url")
    .eq("id", user.id)
    .single();

  const profile = profileRes.data;
  const isCreator = profile?.role === "creator";

  const [creatorRes, brandRes, nicheCountRes, offerCountRes, platformCountRes] =
    await Promise.all([
      isCreator
        ? supabase.from("creators").select("handle").eq("id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      !isCreator
        ? supabase
            .from("brands")
            .select("name, sector, website, logo_url")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      isCreator
        ? supabase
            .from("creator_niches")
            .select("*", { count: "exact", head: true })
            .eq("creator_id", user.id)
        : Promise.resolve({ count: 0 }),
      isCreator
        ? supabase
            .from("creator_offers")
            .select("*", { count: "exact", head: true })
            .eq("creator_id", user.id)
        : Promise.resolve({ count: 0 }),
      isCreator
        ? supabase
            .from("creator_platforms")
            .select("*", { count: "exact", head: true })
            .eq("creator_id", user.id)
        : Promise.resolve({ count: 0 }),
    ]);

  // Complétion créateur
  const creatorChecklist = [
    { label: "Photo de profil", done: Boolean(profile?.avatar_url), weight: 25 },
    { label: "Identifiant", done: Boolean(creatorRes.data?.handle), weight: 15 },
    { label: "Au moins une niche", done: (nicheCountRes.count ?? 0) > 0, weight: 20 },
    { label: "Au moins un réseau", done: (platformCountRes.count ?? 0) > 0, weight: 20 },
    { label: "Au moins une offre", done: (offerCountRes.count ?? 0) > 0, weight: 20 },
  ];
  const creatorCompletion = creatorChecklist.reduce(
    (sum, c) => sum + (c.done ? c.weight : 0),
    0,
  );
  const creatorListable =
    Boolean(profile?.avatar_url) &&
    (nicheCountRes.count ?? 0) > 0 &&
    (offerCountRes.count ?? 0) > 0;

  // Complétion marque
  const brand = brandRes.data;
  const brandChecklist = [
    { label: "Logo", done: Boolean(brand?.logo_url), weight: 30 },
    { label: "Nom de la marque", done: Boolean(brand?.name), weight: 30 },
    { label: "Secteur", done: Boolean(brand?.sector), weight: 20 },
    { label: "Site web", done: Boolean(brand?.website), weight: 20 },
  ];
  const brandCompletion = brandChecklist.reduce(
    (sum, c) => sum + (c.done ? c.weight : 0),
    0,
  );
  const brandReady = Boolean(brand?.name) && Boolean(brand?.logo_url);

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

        {/* Carte de complétion créateur */}
        {isCreator && (
          <section className="mt-8 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">
                {creatorListable ? "Ton profil est visible 🎉" : "Complète ton profil"}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  creatorListable
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {creatorListable ? "✓ Visible par les marques" : "Non visible"}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {creatorListable
                ? "Les marques peuvent te trouver dans la marketplace et te proposer des deals."
                : "Ajoute une photo, une niche et une offre pour apparaître dans la marketplace."}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
                  style={{ width: `${creatorCompletion}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-ink">{creatorCompletion}%</span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {creatorChecklist.map((c) => (
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
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/opportunities"
                className="inline-flex rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Voir les opportunités
              </Link>
              <Link
                href="/onboarding/creator"
                className="inline-flex rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-zinc-50"
              >
                {creatorCompletion === 0
                  ? "Créer mon profil"
                  : creatorListable
                    ? "Modifier mon profil"
                    : "Compléter mon profil"}
              </Link>
            </div>
          </section>
        )}

        {/* Carte de complétion marque */}
        {!isCreator && (
          <section className="mt-8 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">
                {brandReady ? "Ton espace marque est prêt 🚀" : "Complète ton profil marque"}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  brandReady
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {brandReady ? "✓ Prêt à collaborer" : "À compléter"}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              Un profil complet (logo, secteur) inspire confiance aux créateurs que tu
              contactes.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
                  style={{ width: `${brandCompletion}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-ink">{brandCompletion}%</span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {brandChecklist.map((c) => (
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
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/campaigns/new"
                className="inline-flex rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Créer une campagne
              </Link>
              <Link
                href="/creators"
                className="inline-flex rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-zinc-50"
              >
                Trouver des créateurs
              </Link>
              <Link
                href="/onboarding/brand"
                className="inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 transition hover:text-ink"
              >
                {brandReady ? "Modifier mon profil" : "Compléter ma marque"}
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
