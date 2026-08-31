import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OpportunityCard, { type Opportunity } from "./OpportunityCard";
import FilterChip from "@/components/FilterChip";
import FiltersDrawer from "@/components/landing/FiltersDrawer";
import FilterPopover from "@/components/FilterPopover";
import PlatformIcon from "@/components/PlatformIcon";
import EmptyState from "@/components/EmptyState";
import { countsAsEarning, sumEarnings } from "@/lib/affiliate-earnings";
import { demoVisible } from "@/lib/demo-data";

export const metadata = { title: "Opportunités — Collabbs" };

type Params = { q?: string; type?: string; niche?: string; platform?: string };

const TYPE_FILTERS: { id: string; label: string }[] = [
  { id: "affiliation", label: "Affiliation" },
  { id: "video", label: "Paiement fixe" },
  { id: "performance", label: "Performance" },
  { id: "hybrid", label: "Hybride" },
];

function buildHref(params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/opportunities?${s}` : "/opportunities";
}

// Chip = FilterChip (optimistic feedback).
function Chip(props: { label: React.ReactNode; href: string; active: boolean }) {
  return <FilterChip {...props} />;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { q, type, niche, platform } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, campaignsRes, nichesRes, platformsRes, linksRes, appsRes] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      // `brands!inner(...)` : la jointure devient filtrante, ce qui permet
      // d'écarter les campagnes des marques de démonstration en production.
      // Sans ça, un vrai créateur pouvait candidater à « Sephora » et attendre
      // une réponse qui ne viendrait jamais.
      (() => {
        const requete = supabase
          .from("campaigns")
          .select(
            "id, name, description, type, fixed_amount, commission_value, commission_nano, commission_macro, min_subscribers, spots, created_at, cpa_action_label, cpa_value_per_action, with_promo_code, promo_discount_pct, with_giveaway, giveaway_prize_label, giveaway_prize_value, brands!inner(name, logo_url), campaign_niches(niche_id), campaign_platforms(platform_id), campaign_cpa_tiers(payout)",
          )
          .eq("status", "active")
          .order("created_at", { ascending: false });
        return demoVisible() ? requete : requete.neq("brands.is_demo", true);
      })(),
      supabase.from("niches").select("id, label").order("label"),
      supabase.from("platforms").select("id, label, slug").order("id"),
      supabase.from("affiliate_links").select("id, campaign_id, code").eq("creator_id", user.id),
      supabase
        .from("applications")
        .select("campaign_id, initiated_by, status")
        .eq("creator_id", user.id),
    ]);

  if (profileRes.data?.role !== "creator") redirect("/dashboard");

  const niches = nichesRes.data ?? [];
  const platforms = platformsRes.data ?? [];
  const nicheMap = new Map(niches.map((n) => [n.id, n.label]));
  const platMap = new Map(platforms.map((p) => [p.id, { label: p.label, slug: p.slug }]));
  const linkRows = linksRes.data ?? [];
  const linkMap = new Map(linkRows.map((l) => [l.campaign_id, l.code]));
  // Deux ensembles, et surtout pas un seul.
  //
  // Une invitation et une candidature sont toutes deux des lignes
  // d'`applications`, mais elles ne disent pas la même chose au créateur :
  // « tu as postulé, attends » d'un côté, « une marque te veut, réponds » de
  // l'autre. Les confondre ferait passer une invitation en attente pour une
  // candidature envoyée — la campagne se grisait, et l'invitation devenait
  // invisible pour son destinataire.
  const rowsApps = appsRes.data ?? [];
  const appliedSet = new Set(
    rowsApps.filter((a) => a.initiated_by === "creator").map((a) => a.campaign_id),
  );
  const invitedSet = new Set(
    rowsApps
      .filter((a) => a.initiated_by === "brand" && a.status === "pending")
      .map((a) => a.campaign_id),
  );

  // Clics par campagne (le créateur peut lire les events de ses propres liens)
  const myEventsRes = await supabase
    .from("affiliate_events")
    .select("link_id, type, status, commission_amount")
    .in(
      "link_id",
      linkRows.map((l) => l.id),
    );
  const linkToCampaign = new Map(linkRows.map((l) => [l.id, l.campaign_id]));
  const clicksByCampaign = new Map<string, number>();
  const gainsByCampaign = new Map<string, number>();
  for (const e of myEventsRes.data ?? []) {
    const cid = linkToCampaign.get(e.link_id);
    if (!cid) continue;
    if (e.type === "click")
      clicksByCampaign.set(cid, (clicksByCampaign.get(cid) ?? 0) + 1);
    else if (countsAsEarning(e))
      gainsByCampaign.set(cid, (gainsByCampaign.get(cid) ?? 0) + (e.commission_amount ?? 0));
  }

  const query = (q ?? "").trim().toLowerCase();
  // Types valides côté V2 = modèles de paiement créateur. promo_code et
  // giveaway sont des enum values legacy du V1 (assets aujourd'hui),
  // on les filtre — aucune campagne ne devrait y être mais belt+braces.
  const VALID_TYPES = new Set([
    "affiliation",
    "video",
    "hybrid",
    "performance",
    "cpa_flat",
    "cpa_tiers",
  ] as const);
  type ValidType = typeof VALID_TYPES extends Set<infer T> ? T : never;
  const isValidType = (t: string): t is ValidType => VALID_TYPES.has(t as ValidType);

  const results = (campaignsRes.data ?? []).filter((c) => {
    if (!isValidType(c.type)) return false;
    if (type && c.type !== type) return false;
    if (niche && !c.campaign_niches.some((x) => x.niche_id === Number(niche))) return false;
    if (platform && !c.campaign_platforms.some((x) => x.platform_id === Number(platform)))
      return false;
    if (query) {
      const hay = `${c.name} ${c.description ?? ""} ${c.brands?.name ?? ""}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }) as (typeof campaignsRes.data extends (infer R)[] | null
    ? R & { type: ValidType }
    : never)[];

  const activeFilterCount =
    (type ? 1 : 0) + (niche ? 1 : 0) + (platform ? 1 : 0);
  const anyFilter = Boolean(q) || activeFilterCount > 0;

  // Chips réutilisées dans drawer mobile ET popovers desktop.
  const typeChips = (
    <div className="flex flex-wrap gap-2">
      {TYPE_FILTERS.map((t) => (
        <Chip
          key={t.id}
          label={t.label}
          active={type === t.id}
          href={buildHref({ q, niche, platform, type: type === t.id ? undefined : t.id })}
        />
      ))}
    </div>
  );
  const platformChips = (
    <div className="flex flex-wrap gap-2">
      {platforms.map((p) => (
        <Chip
          key={p.id}
          label={
            <span className="inline-flex items-center gap-1.5">
              <PlatformIcon slug={p.slug} className="h-3.5 w-3.5 shrink-0" />
              <span>{p.label}</span>
            </span>
          }
          active={platform === String(p.id)}
          href={buildHref({
            q,
            type,
            niche,
            platform: platform === String(p.id) ? undefined : String(p.id),
          })}
        />
      ))}
    </div>
  );
  const nicheChips = (
    <div className="flex flex-wrap gap-2">
      {niches.map((n) => (
        <Chip
          key={n.id}
          label={n.label}
          active={niche === String(n.id)}
          href={buildHref({
            q,
            type,
            platform,
            niche: niche === String(n.id) ? undefined : String(n.id),
          })}
        />
      ))}
    </div>
  );

  const activeTypeLabel =
    type ? TYPE_FILTERS.find((t) => t.id === type)?.label ?? null : null;
  const activePlatformLabel = platform
    ? platforms.find((p) => String(p.id) === platform)?.label ?? null
    : null;
  const activeNicheLabel = niche
    ? niches.find((n) => String(n.id) === niche)?.label ?? null
    : null;

  // Drawer mobile : 3 groupes empilés.
  const filterGroups = (
    <div className="space-y-5">
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Type
        </p>
        {typeChips}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Réseau
        </p>
        {platformChips}
      </div>

      <div className="border-t border-zinc-100 pt-5">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Niche
        </p>
        {nicheChips}
      </div>

      {activeFilterCount > 0 && (
        <div className="border-t border-zinc-100 pt-4">
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <span>↻</span>
            <span>Réinitialiser les filtres</span>
          </Link>
        </div>
      )}
    </div>
  );

  // Stats du créateur connecté : nb d'opportunités, gains affil cumulés.
  const allEvents = myEventsRes.data ?? [];
  const totalClicks = allEvents.filter((e) => e.type === "click").length;
  // Encore une définition divergente des gains : celle-ci ne comptait que les
  // ventes — donc pas les actions au CPA — et ignorait le statut, donc
  // additionnait les commissions écartées. `sumEarnings` est la règle unique.
  const totalGains = sumEarnings(allEvents);
  const activeLinks = linkRows.length;
  const pendingApps = (appsRes.data ?? []).length;

  // Les campagnes où une marque attend une réponse de CE créateur.
  //
  // Construites depuis la liste NON filtrée, et affichées hors de la grille :
  // une invitation s'adresse à quelqu'un, elle ne peut pas disparaître parce
  // qu'une puce de niche est restée cochée. C'était le défaut le plus probable
  // du dispositif — l'invitation partait, la notification arrivait, et l'écran
  // vers lequel elle renvoie ne montrait rien.
  const invitations = (campaignsRes.data ?? []).filter((c) => invitedSet.has(c.id));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl">
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Opportunités
            </span>{" "}
            qui t&apos;attendent
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600">
            {results.length > 0 ? (
              <>
                <span className="font-semibold text-ink">{results.length} campagne{results.length > 1 ? "s" : ""}</span>{" "}
                ouvertes en ce moment. Active ton lien en 1 clic ou candidate sur les
                deals fixes.
              </>
            ) : (
              <>
                Trouve les campagnes faites pour toi. Active ton lien d&apos;affiliation
                en 1 clic ou candidate.
              </>
            )}
          </p>
        </div>
        {(activeLinks > 0 || totalClicks > 0 || totalGains > 0) && (
          <div className="hidden items-center gap-2 lg:flex">
            <div className="rounded-2xl border border-zinc-100 bg-white px-4 py-2.5 text-center shadow-sm">
              <p className="font-display text-xl font-black text-ink">
                {activeLinks}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Liens actifs
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-white px-4 py-2.5 text-center shadow-sm">
              <p className="font-display text-xl font-black text-ink">
                {totalClicks}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Clics générés
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-2.5 text-center shadow-sm">
              <p className="font-display text-xl font-black text-emerald-700">
                {totalGains.toLocaleString("fr-FR")}€
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                Gagnés
              </p>
            </div>
          </div>
        )}
      </div>

        {invitations.length > 0 && (
          <section className="mt-6 rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5 sm:p-6">
            <p className="font-display text-lg font-black text-ink">
              ✨ {invitations.length === 1
                ? "Une marque t'invite"
                : `${invitations.length} marques t'invitent`}
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Elles ont repéré ton profil et te proposent leur campagne. À toi de
              répondre — accepter ne t&apos;engage à rien de plus qu&apos;à recevoir
              une proposition chiffrée.
            </p>
            <ul className="mt-4 space-y-2">
              {invitations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/opportunities/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{c.name}</p>
                      <p className="truncate text-sm text-zinc-500">
                        {c.brands?.name ?? "Une marque"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white">
                      Voir et répondre →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Teaser cliquable vers la page dédiée /activity */}
        {(activeLinks > 0 || pendingApps > 0) && (
          <Link
            href="/activity"
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-pink-50/30 p-4 transition hover:border-purple-200 hover:shadow-md sm:p-5"
          >
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-lg text-white shadow-sm">
                ⚡
              </span>
              <div>
                <p className="font-display text-base font-black text-ink">
                  Mon activité
                </p>
                <p className="text-xs text-zinc-500">
                  {activeLinks > 0 && (
                    <span className="font-semibold text-emerald-700">
                      🔗 {activeLinks} lien{activeLinks > 1 ? "s" : ""} actif{activeLinks > 1 ? "s" : ""}
                    </span>
                  )}
                  {activeLinks > 0 && pendingApps > 0 && " · "}
                  {pendingApps > 0 && (
                    <span className="font-semibold text-purple-700">
                      ⏳ {pendingApps} candidature{pendingApps > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-brand">Voir détails →</span>
          </Link>
        )}

        {/* Recherche */}
        <form action="/opportunities" className="mt-6 flex max-w-xl items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Rechercher une marque, un produit…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 sm:px-5"
          >
            <span className="hidden sm:inline">Rechercher</span>
            <span className="sm:hidden">🔍</span>
          </button>
        </form>

        {/* Filtres : drawer sur mobile, barre de popovers compacts sur desktop */}
        <div className="mt-4">
          <FiltersDrawer activeCount={activeFilterCount}>{filterGroups}</FiltersDrawer>
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            <FilterPopover label="Type" activeLabel={activeTypeLabel}>
              {typeChips}
            </FilterPopover>
            <FilterPopover label="Réseau" activeLabel={activePlatformLabel}>
              {platformChips}
            </FilterPopover>
            <FilterPopover label="Niche" activeLabel={activeNicheLabel}>
              {nicheChips}
            </FilterPopover>
            {activeFilterCount > 0 && (
              <Link
                href="/opportunities"
                className="ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-ink"
              >
                <span>↻</span>
                <span>Réinitialiser</span>
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {results.length} campagne{results.length > 1 ? "s" : ""}
          </p>
          {anyFilter && !activeFilterCount && (
            <Link href="/opportunities" className="text-sm font-medium text-brand hover:underline">
              Effacer la recherche
            </Link>
          )}
        </div>

        {results.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon="🎯"
              title={anyFilter ? "Aucune campagne ne correspond" : "Aucune campagne active"}
              description={
                anyFilter
                  ? "Essaie d'élargir tes filtres ou réinitialise la recherche pour voir toutes les opportunités."
                  : "Pas d'opportunités ouvertes pour le moment. Reviens vite — des marques publient régulièrement."
              }
              cta={anyFilter ? { label: "Réinitialiser la recherche", href: "/opportunities" } : undefined}
            />
          </div>
        ) : (
          <div className="cards-stagger mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((c) => {
              const opportunity: Opportunity = {
                id: c.id,
                name: c.name,
                description: c.description,
                type: c.type,
                fixedAmount: c.fixed_amount,
                commissionValue: c.commission_value,
                tiers: { nano: c.commission_nano, macro: c.commission_macro },
                minSubscribers: c.min_subscribers,
                spots: c.spots,
                brandName: c.brands?.name ?? "Marque",
                brandLogo: c.brands?.logo_url ?? null,
                niches: c.campaign_niches
                  .map((x) => nicheMap.get(x.niche_id))
                  .filter((v): v is string => Boolean(v)),
                platforms: c.campaign_platforms
                  .map((x) => platMap.get(x.platform_id))
                  .filter((v): v is { label: string; slug: string } => Boolean(v)),
                cpaActionLabel: c.cpa_action_label,
                cpaValuePerAction: c.cpa_value_per_action,
                cpaTopTierPayout:
                  (c.campaign_cpa_tiers ?? [])
                    .map((t) => t.payout)
                    .sort((a, b) => b - a)[0] ?? null,
                withPromoCode: c.with_promo_code ?? false,
                promoDiscountPct: c.promo_discount_pct,
                withGiveaway: c.with_giveaway ?? false,
                giveawayPrizeLabel: c.giveaway_prize_label,
                giveawayPrizeValue: c.giveaway_prize_value,
              };
              const code = linkMap.get(c.id);
              // L'invitation passe AVANT le lien : un créateur déjà affilié
              // qu'une marque invite sur un forfait doit voir l'invitation,
              // pas ses statistiques de clics.
              const status: "none" | "linked" | "applied" | "invited" = invitedSet.has(c.id)
                ? "invited"
                : code
                  ? "linked"
                  : appliedSet.has(c.id)
                    ? "applied"
                    : "none";
              return (
                <OpportunityCard
                  key={c.id}
                  opportunity={opportunity}
                  initialStatus={status}
                  initialCode={code}
                  clicks={clicksByCampaign.get(c.id) ?? 0}
                  gains={gainsByCampaign.get(c.id) ?? 0}
                />
              );
            })}
          </div>
        )}
    </>
  );
}
