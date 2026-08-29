import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eurExact } from "@/lib/deal";
import { LEGAL_THRESHOLD } from "@/lib/legal-threshold";
import EmptyState from "@/components/EmptyState";

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

export default async function ContractsPage() {
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

  // Noms des contreparties.
  const otherIds = [
    ...new Set(rows.map((d) => (d.brand_id === user.id ? d.creator_id : d.brand_id))),
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

  // Cumul par contrepartie sur l'année civile en cours — la maille du seuil légal.
  const year = new Date().getFullYear();
  const cumul = new Map<string, number>();
  for (const d of rows) {
    if (new Date(d.created_at).getFullYear() !== year) continue;
    if (d.status !== "active" && d.status !== "completed") continue;
    const other = d.brand_id === user.id ? d.creator_id : d.brand_id;
    cumul.set(other, (cumul.get(other) ?? 0) + Number(d.amount ?? 0));
  }
  const partners = [...cumul.entries()]
    .map(([id, total]) => ({ id, total, name: nameOf.get(id) ?? "Partenaire" }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">Contrats</h1>
      <p className="mt-2 text-zinc-600">
        Tous tes contrats signés, conservés et consultables. Et le suivi du seuil légal
        de {eurExact(LEGAL_THRESHOLD)} par partenaire et par année civile.
      </p>

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

      {/* Liste des contrats */}
      <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">
          {rows.length} contrat{rows.length > 1 ? "s" : ""}
        </h2>

        {rows.length === 0 ? (
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
      </section>
    </>
  );
}
