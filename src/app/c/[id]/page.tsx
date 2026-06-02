import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import PlatformIcon from "@/components/PlatformIcon";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TIER_LABELS } from "@/lib/campaign";
import { joinAffiliationFromPublic } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaigns")
    .select("name, description, brands(name)")
    .eq("id", id)
    .single();
  const title = data
    ? `${data.brands?.name ?? "Marque"} — programme d'affiliation`
    : "Programme d'affiliation — Collabbs";
  return {
    title,
    description:
      data?.description?.slice(0, 160) ??
      "Active ton lien en 1 clic et gagne une commission sur chaque vente.",
    openGraph: { title, description: data?.description?.slice(0, 160) ?? undefined },
  };
}

export default async function PublicCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    wrong_role?: string;
    bad_campaign?: string;
    inactive?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();

  // Fetch campagne + brand sans authentification (page publique).
  const { data: c } = await admin
    .from("campaigns")
    .select(
      "id, name, description, requirements, type, status, commission_nano, commission_micro, commission_mid, commission_macro, min_subscribers, tone, brand_id, brands(name, logo_url, sector, website), campaign_niches(niche_id), campaign_platforms(platform_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  if (c.type !== "affiliation" && c.type !== "hybrid") notFound();

  const [{ data: niches }, { data: platforms }] = await Promise.all([
    admin.from("niches").select("id, label"),
    admin.from("platforms").select("id, label, slug"),
  ]);
  const nicheLabels = c.campaign_niches
    .map((x) => niches?.find((n) => n.id === x.niche_id)?.label)
    .filter((v): v is string => Boolean(v));
  const platformObjs = c.campaign_platforms
    .map((x) => platforms?.find((p) => p.id === x.platform_id))
    .filter((v): v is { id: number; label: string; slug: string } => Boolean(v));

  // État de l'utilisateur courant (anon / creator / brand) pour adapter le CTA.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerRole: "creator" | "brand" | null = null;
  let alreadyActivated = false;
  if (user) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    viewerRole = viewer?.role ?? null;
    if (viewerRole === "creator") {
      const { data: link } = await supabase
        .from("affiliate_links")
        .select("id")
        .eq("creator_id", user.id)
        .eq("campaign_id", id)
        .maybeSingle();
      alreadyActivated = Boolean(link);
    }
  }

  const isActive = c.status === "active";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Header marque */}
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-sm font-bold text-zinc-500 ring-1 ring-zinc-100">
            {c.brands?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.brands.logo_url} alt={c.brands.name} className="h-full w-full object-contain p-2" />
            ) : (
              (c.brands?.name ?? "?").slice(0, 2).toUpperCase()
            )}
          </span>
          <div>
            <Link
              href={`/brands/${c.brand_id}`}
              className="text-sm font-medium text-zinc-500 transition hover:text-ink hover:underline"
            >
              {c.brands?.name}
            </Link>
            <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {c.name}
            </h1>
            <p className="mt-1 inline-block rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep">
              Programme d&apos;affiliation
            </p>
          </div>
        </div>

        {/* Messages d'erreur retours */}
        {sp.wrong_role && (
          <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Cette page est destinée aux créateurs. Si tu es une marque, tu peux créer la tienne sur Collabbs.
          </div>
        )}
        {(sp.bad_campaign || sp.inactive) && (
          <div className="mt-6 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
            Ce programme n&apos;est plus actif. Reviens plus tard ou regarde d&apos;autres opportunités.
          </div>
        )}
        {sp.error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            Une erreur est survenue. Réessaie dans un instant.
          </div>
        )}

        {/* Commission tiers */}
        <section className="mt-8 rounded-3xl bg-gradient-to-br from-purple-50 to-pink-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">
            Tu touches une commission sur chaque vente générée par ton lien
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {TIER_LABELS.map((t) => {
              const v = c[`commission_${t.key}` as keyof typeof c] as number | null;
              return (
                <div key={t.key}>
                  <dt className="text-[11px] text-zinc-500">{t.label}</dt>
                  <dd className="font-display text-2xl font-black text-ink">
                    {v ?? "?"}%
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        {/* Brief */}
        {c.description && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-black text-ink">La campagne</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
              {c.description}
            </p>
          </section>
        )}

        {/* Profil recherché */}
        {(nicheLabels.length > 0 || platformObjs.length > 0 || c.min_subscribers) && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-black text-ink">Profil recherché</h2>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {platformObjs.map((p) => (
                <span
                  key={p.slug}
                  className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
                >
                  <PlatformIcon slug={p.slug} className="h-3.5 w-3.5" />
                  {p.label}
                </span>
              ))}
              {nicheLabels.map((n) => (
                <span key={n} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                  {n}
                </span>
              ))}
            </div>
            {c.min_subscribers != null && (
              <p className="mt-3 text-sm text-zinc-500">
                <strong className="text-ink">{c.min_subscribers.toLocaleString("fr-FR")}</strong>{" "}
                abonnés minimum sur ton plus grand réseau.
              </p>
            )}
          </section>
        )}

        {/* CTA */}
        <section className="mt-10 rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
          {!isActive ? (
            <p className="text-center text-sm text-zinc-500">
              Ce programme n&apos;est pas actif pour le moment.
            </p>
          ) : alreadyActivated ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-emerald-700">
                ✅ Tu as déjà activé ton lien sur ce programme.
              </p>
              <Link
                href="/opportunities"
                className="mt-3 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
              >
                Voir mes liens d&apos;affiliation
              </Link>
            </div>
          ) : viewerRole === "brand" ? (
            <p className="text-center text-sm text-zinc-500">
              Cette page est destinée aux créateurs.
            </p>
          ) : (
            <form action={joinAffiliationFromPublic.bind(null, c.id)} className="text-center">
              <p className="text-sm text-zinc-600">
                Active ton lien unique en <strong>1 clic</strong> — gratuit, aucune validation requise.
              </p>
              <button
                type="submit"
                className="mt-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {viewerRole === "creator"
                  ? "🔗 Activer mon lien maintenant"
                  : "🔗 Devenir affilié (inscription gratuite)"}
              </button>
              <p className="mt-2 text-[11px] text-zinc-400">
                Tracking par cookie 30 jours · paiement sécurisé Stripe
              </p>
            </form>
          )}
        </section>

        {/* Mention de bas */}
        <p className="mt-10 text-center text-xs text-zinc-400">
          Programme propulsé par{" "}
          <Link href="/" className="font-semibold text-brand hover:underline">
            Collabbs
          </Link>{" "}
          · la marketplace des créateurs × marques.
        </p>
      </main>
      <Footer />
    </>
  );
}
