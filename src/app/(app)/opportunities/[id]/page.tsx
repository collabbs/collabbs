import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlatformIcon from "@/components/PlatformIcon";
import {
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_TYPE_DESCRIPTION,
  TONE_LABEL,
  TIER_LABELS,
  campaignReward,
  type CampaignType,
} from "@/lib/campaign";
import ActionPanel from "./ActionPanel";
import { openConversation } from "../../messages/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("name, brands(name)")
    .eq("id", id)
    .single();
  return {
    title: data ? `${data.name} — ${data.brands?.name ?? "Collabbs"}` : "Campagne — Collabbs",
  };
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  // Une marque qui ouvre ce lien est renvoyée vers sa vue de gestion.
  if (profileRes.data?.role === "brand") redirect(`/campaigns/${id}`);

  const { data: c } = await supabase
    .from("campaigns")
    .select(
      "id, brand_id, name, description, requirements, type, status, fixed_amount, commission_value, commission_unit, commission_nano, commission_micro, commission_mid, commission_macro, min_subscribers, spots, tone, avoid, starts_at, ends_at, created_at, target_url, brands(name, logo_url, website, sector), campaign_niches(niche_id), campaign_platforms(platform_id)",
    )
    .eq("id", id)
    .single();
  if (!c) notFound();

  const [nichesRes, platformsRes] = await Promise.all([
    supabase.from("niches").select("id, label"),
    supabase.from("platforms").select("id, label, slug"),
  ]);
  const nicheMap = new Map((nichesRes.data ?? []).map((n) => [n.id, n.label]));
  const platMap = new Map(
    (platformsRes.data ?? []).map((p) => [p.id, { label: p.label, slug: p.slug }]),
  );
  const niches = c.campaign_niches
    .map((x) => nicheMap.get(x.niche_id))
    .filter((v): v is string => Boolean(v));
  const platforms = c.campaign_platforms
    .map((x) => platMap.get(x.platform_id))
    .filter((v): v is { label: string; slug: string } => Boolean(v));

  const type = c.type as CampaignType;
  const isAffiliation = type === "affiliation" || type === "hybrid";

  // Statut du créateur sur cette campagne.
  const [linkRes, appRes, examplesRes, brandStatsRes] = await Promise.all([
    supabase
      .from("affiliate_links")
      .select("id, code")
      .eq("creator_id", user.id)
      .eq("campaign_id", id)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id")
      .eq("creator_id", user.id)
      .eq("campaign_id", id)
      .maybeSingle(),
    supabase
      .from("campaign_examples")
      .select("id, url, caption, position")
      .eq("campaign_id", id)
      .order("position"),
    // Stats de la marque pour rassurer le créateur (combien de campagnes,
    // combien de deals signés, tracking actif).
    supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", c.brand_id),
  ]);
  const examples = examplesRes.data ?? [];
  const brandTotalCampaigns = brandStatsRes.count ?? 0;

  let clicks = 0;
  let gains = 0;
  if (linkRes.data) {
    const evRes = await supabase
      .from("affiliate_events")
      .select("type, commission_amount")
      .eq("link_id", linkRes.data.id);
    for (const e of evRes.data ?? []) {
      if (e.type === "click") clicks += 1;
      else if (e.type === "sale") gains += e.commission_amount ?? 0;
    }
  }

  const status: "none" | "linked" | "applied" = linkRes.data
    ? "linked"
    : appRes.data
      ? "applied"
      : "none";

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

  const tier = (val: number | null) => (val ?? "?") + "%";

  return (
    <>
      <Link
        href="/opportunities"
        className="text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        ← Toutes les opportunités
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Colonne principale */}
        <div>
          {/* En-tête marque + titre */}
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-sm font-bold text-zinc-500 ring-1 ring-zinc-100">
              {c.brands?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.brands.logo_url}
                  alt={c.brands.name}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                (c.brands?.name ?? "?").slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-500">{c.brands?.name ?? "Marque"}</p>
              <h1 className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">
                {c.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-brand-deep">
                  {CAMPAIGN_TYPE_LABEL[type]}
                </span>
                {c.status !== "active" && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-500">
                    Campagne terminée
                  </span>
                )}
                {c.brands?.sector && (
                  <span className="text-xs text-zinc-400">{c.brands.sector}</span>
                )}
              </div>
            </div>
          </div>

          {/* Rémunération */}
          <div className="mt-6 rounded-2xl border border-zinc-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-deep">
              Rémunération
            </p>
            <p className="mt-1 font-display text-2xl font-black text-ink">
              {campaignReward(c)}
            </p>
            <p className="mt-1 text-sm text-zinc-600">{CAMPAIGN_TYPE_DESCRIPTION[type]}</p>

            {isAffiliation && (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-purple-100 pt-4 sm:grid-cols-4">
                {TIER_LABELS.map((t) => (
                  <div key={t.key}>
                    <dt className="text-[11px] text-zinc-500">{t.label}</dt>
                    <dd className="text-lg font-extrabold text-ink">
                      {tier(c[`commission_${t.key}` as keyof typeof c] as number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Description */}
          {c.description && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">La campagne</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
                {c.description}
              </p>
            </section>
          )}

          {/* Exemples de contenu — la marque a uploadé des refs */}
          {examples.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">
                Exemples de ce qu&apos;ils attendent{" "}
                <span className="text-zinc-400">({examples.length})</span>
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Inspire-toi de ces références pour augmenter tes chances.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {examples.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {ex.url && (
                      <a
                        href={ex.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 truncate text-xs font-mono text-brand hover:underline"
                      >
                        🔗 {ex.url.replace(/^https?:\/\//, "")}
                        <span className="text-zinc-400">↗</span>
                      </a>
                    )}
                    {ex.caption && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
                        {ex.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Attentes */}
          {(c.requirements || c.tone || c.avoid) && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-black text-ink">
                Ce qu&apos;attend la marque
              </h2>
              {c.requirements && (
                <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">
                  {c.requirements}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                {c.tone && (
                  <p className="text-zinc-600">
                    <span className="font-semibold text-ink">Ton : </span>
                    {TONE_LABEL[c.tone] ?? c.tone}
                  </p>
                )}
                {c.avoid && (
                  <p className="text-zinc-600">
                    <span className="font-semibold text-ink">À éviter : </span>
                    {c.avoid}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Cibles */}
          <section className="mt-8">
            <h2 className="font-display text-lg font-black text-ink">Profil recherché</h2>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {platforms.map((p) => (
                <span
                  key={p.slug}
                  className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
                >
                  <PlatformIcon slug={p.slug} className="h-3.5 w-3.5" />
                  {p.label}
                </span>
              ))}
              {niches.map((n) => (
                <span
                  key={n}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600"
                >
                  {n}
                </span>
              ))}
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
              {c.min_subscribers != null && (
                <div>
                  <dt className="text-xs text-zinc-500">Abonnés minimum</dt>
                  <dd className="text-lg font-extrabold text-ink">
                    {c.min_subscribers.toLocaleString("fr-FR")}
                  </dd>
                </div>
              )}
              {c.spots != null && (
                <div>
                  <dt className="text-xs text-zinc-500">Places</dt>
                  <dd className="text-lg font-extrabold text-ink">{c.spots}</dd>
                </div>
              )}
              {fmtDate(c.ends_at) && (
                <div>
                  <dt className="text-xs text-zinc-500">Jusqu&apos;au</dt>
                  <dd className="text-lg font-extrabold text-ink">{fmtDate(c.ends_at)}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Colonne action (sticky) */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <p className="font-display text-lg font-black text-ink">
              {isAffiliation ? "Lance-toi" : "Intéressé·e ?"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {isAffiliation
                ? "Génère ton lien unique et commence à gagner."
                : "Envoie ta candidature à la marque."}
            </p>
            <div className="mt-4">
              {c.status === "active" ? (
                <ActionPanel
                  campaignId={c.id}
                  isAffiliation={isAffiliation}
                  initialStatus={status}
                  initialCode={linkRes.data?.code}
                  clicks={clicks}
                  gains={gains}
                />
              ) : (
                <p className="rounded-lg bg-zinc-50 p-3 text-center text-sm text-zinc-500">
                  Cette campagne n&apos;accepte plus de nouvelles participations.
                </p>
              )}
            </div>

            <form action={openConversation.bind(null, c.brand_id)} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
              >
                💬 Poser une question à la marque
              </button>
            </form>

            {c.brands?.website && (
              <a
                href={c.brands.website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block text-center text-xs font-medium text-zinc-500 transition hover:text-brand"
              >
                Voir le site de {c.brands.name} ↗
              </a>
            )}
          </div>

          {/* À propos de la marque — réassurance */}
          <Link
            href={`/brands/${c.brand_id}`}
            className="mt-4 block rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm transition hover:border-purple-200 hover:shadow-md"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              À propos de la marque
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-100">
                {c.brands?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.brands.logo_url}
                    alt={c.brands.name ?? ""}
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <span className="text-xs font-bold text-zinc-500">
                    {(c.brands?.name ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-black text-ink">
                  {c.brands?.name ?? "Marque"}
                </p>
                {c.brands?.sector && (
                  <p className="truncate text-xs text-zinc-500">{c.brands.sector}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600">
              <span>
                <strong className="text-ink">{brandTotalCampaigns}</strong>{" "}
                campagne{brandTotalCampaigns > 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-brand">
              Voir le profil complet →
            </p>
          </Link>
        </aside>
      </div>
    </>
  );
}
