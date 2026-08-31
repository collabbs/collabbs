import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eurExact } from "@/lib/deal";
import { LEGAL_THRESHOLD, thresholdFor } from "@/lib/legal-threshold";
import EmptyState from "@/components/EmptyState";
import { declareInKind, cancelInKind, disputeInKind } from "./actions";


export const metadata = { title: "Contrats — Collabbs" };

/**
 * Le coffre à contrats.
 *
 * Deux usages en un seul écran : retrouver un contrat signé (obligation de
 * conservation), et voir où l'on se situe face au seuil légal de 1 000 € HT
 * par partenaire et par année civile. Le seuil s'apprécie par couple et par
 * année — c'est précisément ce que personne ne suit à la main.
 */

const STATUS_META: Record<string, { label: string; tone: string }> = {
  signed: { label: "Signé", tone: "bg-emerald-50 text-emerald-700" },
  draft: { label: "En attente de signature", tone: "bg-amber-50 text-amber-700" },
  pending_signature: { label: "En attente de signature", tone: "bg-amber-50 text-amber-700" },
  terminated: { label: "Résilié", tone: "bg-zinc-100 text-zinc-500" },
};

function dateFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role: "brand" | "creator" = profile?.role === "brand" ? "brand" : "creator";

  // Tous les deals où je suis partie, avec leur contrat.
  const { data: deals } = await supabase
    .from("deals")
    .select(
      "id, brand_id, creator_id, title, amount, status, created_at, contracts(reference, status, brand_signed_at, creator_signed_at, terms_snapshot)",
    )
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const rows = (deals ?? []).filter((d) => d.contracts);

  // Les contrats-cadres d'affiliation n'ont pas de collaboration : ils se
  // chargent à part, sinon ils resteraient invisibles — et un contrat qu'on ne
  // trouve pas ne se signe jamais.
  const { data: cadres } = await supabase
    .from("contracts")
    .select(
      "id, reference, status, period_year, brand_id, creator_id, brand_signed_at, creator_signed_at, created_at",
    )
    .eq("kind", "affiliate")
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .order("period_year", { ascending: false });

  const cadreRows = cadres ?? [];

  // Contreparties liées uniquement par de l'affiliation : elles n'apparaissent
  // dans aucune collaboration, et c'est précisément le cas qu'on ratait.
  const affiliatePartnerIds: string[] = [];
  if (role === "creator") {
    const { data: mesLiens } = await supabase
      .from("affiliate_links")
      .select("campaigns(brand_id)")
      .eq("creator_id", user.id);
    for (const l of mesLiens ?? []) {
      if (l.campaigns?.brand_id) affiliatePartnerIds.push(l.campaigns.brand_id);
    }
  } else {
    const { data: mesCampagnes } = await supabase
      .from("campaigns")
      .select("affiliate_links(creator_id)")
      .eq("brand_id", user.id);
    for (const c of mesCampagnes ?? []) {
      for (const l of c.affiliate_links ?? []) {
        if (l.creator_id) affiliatePartnerIds.push(l.creator_id);
      }
    }
  }

  // Noms des contreparties.
  //
  // Le filtre sur les identifiants nuls n'est pas de la précaution : sur
  // `contracts`, `brand_id` et `creator_id` sont nullables au niveau des
  // colonnes, et seule une contrainte CHECK les impose pour les contrats-cadres
  // d'affiliation. Un `null` glissé dans un `.in("id", …)` ne lèverait aucune
  // erreur — il ferait silencieusement disparaître TOUS les noms de la page.
  const otherIds = [
    ...new Set(
      [
        ...rows.map((d) => (d.brand_id === user.id ? d.creator_id : d.brand_id)),
        ...cadreRows.map((c) => (c.brand_id === user.id ? c.creator_id : c.brand_id)),
        ...affiliatePartnerIds,
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const [brandsRes, creatorsRes] = await Promise.all([
    otherIds.length
      ? supabase.from("brands").select("id, name").in("id", otherIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    otherIds.length
      ? supabase.from("creators").select("id, handle").in("id", otherIds)
      : Promise.resolve({ data: [] as { id: string; handle: string | null }[] }),
  ]);
  const nameOf = new Map<string, string>();
  for (const b of brandsRes.data ?? []) if (b.name) nameOf.set(b.id, b.name);
  for (const c of creatorsRes.data ?? []) if (c.handle) nameOf.set(c.id, `@${c.handle}`);

  // Avantages en nature. Si la migration 0036 n'est pas encore appliquée, la
  // requête échoue proprement et la section reste masquée plutôt que de casser
  // toute la page.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: inKindRaw, error: inKindErr } = await supabase
    .from("in_kind_benefits")
    .select("id, brand_id, creator_id, label, value, sent_at, note, status, dispute_reason")
    .or(`brand_id.eq.${user.id},creator_id.eq.${user.id}`)
    .neq("status", "cancelled")
    .order("sent_at", { ascending: false })
    .limit(50);
  const inKindReady = !inKindErr;
  const inKind = inKindRaw ?? [];

  // Cumul par contrepartie sur l'année civile en cours — la maille du seuil légal.
  //
  // Ce cumul passe par `thresholdFor`, la MÊME fonction que celle qui décide
  // du régime d'un contrat et de l'établissement d'un contrat-cadre. Cette
  // page recalculait auparavant le seuil de son côté, à partir des seules
  // collaborations et des cadeaux : elle ignorait les commissions
  // d'affiliation et de CPA. Un créateur en affiliation pure y voyait 0 € et
  // se croyait loin du seuil alors qu'il l'avait franchi.
  const year = new Date().getFullYear();

  // Toutes les contreparties connues, quel que soit le canal — y compris
  // celles avec qui il n'y a QUE de l'affiliation.
  // Ici le filtre sur les nuls compte plus qu'ailleurs : cette liste alimente
  // `thresholdFor`, donc le suivi du seuil légal de 1 000 €. Un identifiant nul
  // produirait une ligne « partenaire inconnu » avec un cumul faux — sur
  // l'écran dont le seul rôle est de dire à qui un contrat écrit est dû.
  const partenaires = new Set<string>(
    [
      ...rows.map((d) => (d.brand_id === user.id ? d.creator_id : d.brand_id)),
      ...inKind.map((g) => (g.brand_id === user.id ? g.creator_id : g.brand_id)),
      ...cadreRows.map((c) => (c.brand_id === user.id ? c.creator_id : c.brand_id)),
      ...affiliatePartnerIds,
    ].filter((id): id is string => Boolean(id)),
  );

  const partners = (
    await Promise.all(
      [...partenaires].map(async (id) => {
        const etat = await thresholdFor(
          role === "brand" ? user.id : id,
          role === "brand" ? id : user.id,
          year,
        );
        return { id, total: etat.total, name: nameOf.get(id) ?? "Partenaire" };
      }),
    )
  )
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">Contrats</h1>
      <p className="mt-2 text-zinc-600">
        Tous tes contrats signés, conservés et consultables. Et le suivi du seuil légal
        de {eurExact(LEGAL_THRESHOLD)} par partenaire et par année civile.
      </p>

      {sp.saved && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {sp.saved}</p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>
      )}

      {/* Suivi du seuil */}
      {partners.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-ink">Cumul {year} par partenaire</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Depuis le 1<sup>er</sup> janvier 2026, un contrat écrit détaillé est
            obligatoire dès que la rémunération cumulée sur l&apos;année atteint{" "}
            {eurExact(LEGAL_THRESHOLD)} avec un même partenaire — cadeaux et dotations
            compris.
          </p>

          <ul className="mt-4 flex flex-col gap-3">
            {partners.map((p) => {
              const ratio = Math.min(1, p.total / LEGAL_THRESHOLD);
              const reached = p.total >= LEGAL_THRESHOLD;
              const close = !reached && ratio >= 0.7;
              return (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-ink">{p.name}</span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-600">
                      {eurExact(p.total)}
                      <span className="text-zinc-400"> / {eurExact(LEGAL_THRESHOLD)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full ${
                        reached ? "bg-red-500" : close ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.max(3, ratio * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {reached
                      ? "Seuil atteint — le contrat écrit détaillé est obligatoire."
                      : close
                        ? `Encore ${eurExact(LEGAL_THRESHOLD - p.total)} avant que le contrat détaillé devienne obligatoire.`
                        : `Il reste ${eurExact(LEGAL_THRESHOLD - p.total)} de marge cette année.`}
                  </p>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Ce cumul ne compte que ce qui passe par Collabbs. Les cadeaux et
            collaborations réglés en dehors entrent aussi dans le calcul légal.
          </p>
        </section>
      )}

      {/* Avantages en nature */}
      {inKindReady && (
        <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-ink">Cadeaux et dotations</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {role === "brand"
              ? "Un produit offert compte dans le seuil légal au même titre qu'un paiement. Déclare-le pour que le cumul soit juste."
              : "Ce que les marques déclarent t'avoir offert. La valeur entre dans ton cumul annuel — si c'est inexact, conteste."}
          </p>

          {role === "brand" && (
            <details className="mt-4 rounded-xl border border-zinc-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-ink">
                Déclarer un cadeau ou une dotation
              </summary>
              <form action={declareInKind} className="mt-4 flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-zinc-500">Créateur (@)</span>
                    <input
                      name="handle"
                      required
                      placeholder="ines.fit"
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-zinc-500">Date d&apos;envoi</span>
                    <input
                      type="date"
                      name="sentAt"
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">Ce qui a été offert</span>
                  <input
                    name="label"
                    required
                    placeholder="Paire de sneakers, modèle Runner X"
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">
                    Valeur commerciale (€)
                  </span>
                  <input
                    type="number"
                    name="value"
                    min={0}
                    step="0.01"
                    required
                    placeholder="129.90"
                    className="w-40 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">Note (facultatif)</span>
                  <input
                    name="note"
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                  />
                </label>
                <button
                  type="submit"
                  className="self-start rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Déclarer
                </button>
              </form>
            </details>
          )}

          {inKind.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Aucun avantage déclaré pour l&apos;instant.</p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-100">
              {inKind.map((g) => {
                const other = g.brand_id === user.id ? g.creator_id : g.brand_id;
                const disputed = g.status === "disputed";
                return (
                  <li key={g.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {g.label}
                          <span className="font-normal text-zinc-500">
                            {" "}
                            · {nameOf.get(other) ?? "Partenaire"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {eurExact(Number(g.value ?? 0))} · envoyé le {dateFr(g.sent_at)}
                          {g.note ? ` · ${g.note}` : ""}
                        </p>
                        {disputed && (
                          <p className="mt-1 text-xs text-amber-700">
                            Contesté : {g.dispute_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            disputed
                              ? "bg-amber-50 text-amber-700"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {disputed ? "Contesté — hors cumul" : "Compté dans le cumul"}
                        </span>
                        {role === "brand" && (
                          <form action={cancelInKind}>
                            <input type="hidden" name="id" value={g.id} />
                            <button
                              type="submit"
                              className="text-xs font-medium text-red-600 underline underline-offset-2"
                            >
                              Retirer
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    {role === "creator" && !disputed && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-zinc-500">
                          Ce n&apos;est pas exact ?
                        </summary>
                        <form action={disputeInKind} className="mt-2 flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={g.id} />
                          <input
                            name="reason"
                            required
                            minLength={5}
                            placeholder="Jamais reçu, ou valeur surévaluée…"
                            className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
                          >
                            Contester
                          </button>
                        </form>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Liste des contrats */}
      <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">
          {rows.length} contrat{rows.length > 1 ? "s" : ""}
        </h2>

        {rows.length === 0 && cadreRows.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              variant="card"
              icon="📄"
              title="Aucun contrat pour l'instant"
              description="Un contrat est établi automatiquement dès qu'une collaboration est acceptée."
              cta={{
                label: role === "brand" ? "Trouver des créateurs" : "Voir les opportunités",
                href: role === "brand" ? "/creators" : "/opportunities",
              }}
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {rows.map((d) => {
              const c = d.contracts!;
              const other = d.brand_id === user.id ? d.creator_id : d.brand_id;
              const meta = STATUS_META[c.status] ?? {
                label: c.status,
                tone: "bg-zinc-100 text-zinc-600",
              };
              const snap = c.terms_snapshot as { version?: number; regime?: string } | null;
              const legacy = snap !== null && snap.version !== 1;
              const signedAt = c.creator_signed_at ?? c.brand_signed_at;

              return (
                <li key={d.id} className="py-3">
                  <Link
                    href={`/contracts/${d.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-1 transition hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {d.title || "Collaboration"}
                        <span className="font-normal text-zinc-500">
                          {" "}
                          · {nameOf.get(other) ?? "Partenaire"}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-400">
                        {c.reference} · {eurExact(Number(d.amount ?? 0))} ·{" "}
                        {signedAt ? `signé le ${dateFr(signedAt)}` : dateFr(d.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {legacy && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          Ancien format
                        </span>
                      )}
                      {!legacy && snap?.regime === "simplified" && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                          Simplifié
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {cadreRows.length > 0 && (
          <>
            <h2 className="mt-8 font-display text-lg font-black text-ink">
              Contrats-cadres d&apos;affiliation
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Établis automatiquement dès que les rémunérations versées avec un
              partenaire dépassent 1 000 € sur l&apos;année : la loi impose alors un
              contrat écrit, même sans collaboration ponctuelle.
            </p>
            <ul className="mt-3 divide-y divide-zinc-100">
              {cadreRows.map((c) => {
                const other = c.brand_id === user.id ? c.creator_id : c.brand_id;
                const complet = Boolean(c.brand_signed_at && c.creator_signed_at);
                const maSignature =
                  c.brand_id === user.id ? c.brand_signed_at : c.creator_signed_at;
                return (
                  <li key={c.id} className="py-3">
                    <Link
                      href={`/contracts/affiliation/${c.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-2 py-1 transition hover:bg-zinc-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          Affiliation {c.period_year}
                          <span className="font-normal text-zinc-500">
                            {" "}
                            · {(other && nameOf.get(other)) || "Partenaire"}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-400">
                          {c.reference} ·{" "}
                          {complet
                            ? `signé le ${dateFr(c.creator_signed_at ?? c.brand_signed_at)}`
                            : `établi le ${dateFr(c.created_at)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {complet ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Signé
                          </span>
                        ) : maSignature ? (
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                            En attente de l&apos;autre partie
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                            À signer
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
