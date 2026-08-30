import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { eurExact } from "@/lib/deal";
import {
  adminReleaseEscrow,
  adminRefundEscrow,
  adminResolveInKind,
  adminRejectSale,
} from "./actions";

export const metadata = { title: "Administration — Collabbs" };

/**
 * Poste de pilotage interne.
 *
 * Conçu autour d'une question : « qu'est-ce qui attend une décision humaine ? »
 * Pas un tableau de bord de vanité — les chiffres sont là pour situer, mais
 * l'écran est organisé par situations à traiter, parce que c'est l'absence
 * d'outil d'arbitrage qui bloquait, pas l'absence de statistiques.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

function dateFr(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function Stat({
  value,
  label,
  hint,
  tone = "default",
}: {
  value: string;
  label: string;
  hint?: string;
  tone?: "default" | "good" | "warn";
}) {
  const color =
    tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-ink";
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
      <p className={`font-display text-2xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="text-xs font-medium text-zinc-600">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();

  const [txRes, dealsRes, ledgerRes, inKindRes, salesRes, profilesRes] = await Promise.all([
    untyped(admin)
      .from("transactions")
      .select("id, type, deal_id, brand_id, creator_id, gross_amount, platform_fee, net_amount, status, created_at"),
    untyped(admin)
      .from("deals")
      .select("id, brand_id, creator_id, title, amount, status, created_at, accepted_at, brand_validated_at"),
    untyped(admin).from("brand_ledger").select("kind, amount"),
    untyped(admin)
      .from("in_kind_benefits")
      .select("id, brand_id, creator_id, label, value, status, dispute_reason, sent_at")
      .eq("status", "disputed"),
    untyped(admin)
      .from("affiliate_events")
      .select("id, sale_amount, commission_amount, platform_fee, status, occurred_at, external_ref")
      .in("type", ["sale", "action"])
      .in("status", ["unfunded", "pending"])
      .order("occurred_at", { ascending: false })
      .limit(20),
    untyped(admin).from("profiles").select("id, display_name, role"),
  ]);

  const txs = (txRes.data ?? []) as any[];
  const deals = (dealsRes.data ?? []) as any[];
  const ledger = (ledgerRes.data ?? []) as any[];
  const disputes = (inKindRes.data ?? []) as any[];
  const sales = (salesRes.data ?? []) as any[];
  const nameOf = new Map<string, string>(
    ((profilesRes.data ?? []) as any[]).map((p) => [p.id, p.display_name ?? "—"]),
  );

  // Chiffres d'ensemble.
  const dealTx = txs.filter((t) => t.type === "deal_payment");
  const gmv = dealTx
    .filter((t) => ["in_escrow", "released", "paid"].includes(t.status))
    .reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
  const commissions = dealTx
    .filter((t) => ["released", "paid"].includes(t.status))
    .reduce((s, t) => s + Number(t.platform_fee ?? 0), 0);
  const affiliateFees = txs
    .filter((t) => t.type === "affiliate_payout" && t.status === "paid")
    .reduce((s, t) => s + Number(t.platform_fee ?? 0), 0);
  const inEscrow = dealTx
    .filter((t) => t.status === "in_escrow")
    .reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
  const provisions = ledger.reduce((s, m) => s + Number(m.amount ?? 0), 0);

  // Situations qui attendent une décision.
  const stuckEscrow = dealTx
    .filter((t) => t.status === "in_escrow")
    .map((t) => ({ tx: t, deal: deals.find((d) => d.id === t.deal_id) }))
    .filter((x) => x.deal)
    .map((x) => ({ ...x, days: daysSince(x.tx.created_at) ?? 0 }))
    .sort((a, b) => b.days - a.days);

  const unfunded = sales.filter((s) => s.status === "unfunded");
  const attention = stuckEscrow.filter((x) => x.days >= 14).length + disputes.length + unfunded.length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-black tracking-tight text-ink">
          Administration
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            attention > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {attention > 0
            ? `${attention} situation${attention > 1 ? "s" : ""} à traiter`
            : "Rien à arbitrer"}
        </span>
      </div>
      <p className="mt-2 text-zinc-600">
        Ce qui attend une décision humaine, et les gestes que personne d&apos;autre ne
        peut faire.
      </p>

      {sp.done && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {sp.done}</p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>
      )}

      {/* Chiffres */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat value={eurExact(gmv)} label="Volume traité" hint="Deals payés" />
        <Stat
          value={eurExact(commissions + affiliateFees)}
          label="Commissions perçues"
          hint="Deals + affiliation"
          tone="good"
        />
        <Stat
          value={eurExact(inEscrow)}
          label="En séquestre"
          hint="Argent détenu"
          tone={inEscrow > 0 ? "warn" : "default"}
        />
        <Stat value={eurExact(provisions)} label="Provisions marques" hint="Solde total" />
        <Stat value={String(deals.length)} label="Collaborations" hint="Toutes périodes" />
      </div>

      {/* Séquestres en attente */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">Séquestres en cours</h2>
        <p className="mt-1 text-sm text-zinc-500">
          De l&apos;argent que Collabbs détient. Au-delà de deux semaines, il y a
          probablement un blocage : la marque ne valide pas, ou le créateur ne livre
          pas.
        </p>

        {stuckEscrow.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Aucun séquestre en cours.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {stuckEscrow.map(({ tx, deal, days }) => (
              <li key={tx.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">
                    {deal.title || "Collaboration"}{" "}
                    <span className="font-normal text-zinc-500">
                      · {nameOf.get(deal.brand_id)} → {nameOf.get(deal.creator_id)}
                    </span>
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      days >= 14 ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {days} jour{days > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {eurExact(Number(tx.gross_amount))} encaissés ·{" "}
                  {eurExact(Number(tx.net_amount))} reviendraient au créateur · payé le{" "}
                  {dateFr(tx.created_at)} ·{" "}
                  <Link href={`/deals/${deal.id}`} className="underline">
                    voir la collaboration
                  </Link>
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <form action={adminReleaseEscrow} className="flex gap-2">
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input
                      name="reason"
                      required
                      minLength={5}
                      placeholder="Motif de la libération…"
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-purple-400"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Verser au créateur
                    </button>
                  </form>
                  <form action={adminRefundEscrow} className="flex gap-2">
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input
                      name="reason"
                      required
                      minLength={5}
                      placeholder="Motif du remboursement…"
                      className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs outline-none focus:border-purple-400"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white"
                    >
                      Rendre à la marque
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Avantages contestés */}
      {disputes.length > 0 && (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
          <h2 className="font-semibold text-ink">Avantages en nature contestés</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Un créateur conteste ce qu&apos;une marque déclare lui avoir offert. Tant
            que ce n&apos;est pas tranché, la valeur est hors du cumul légal.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {disputes.map((g) => (
              <li key={g.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <p className="text-sm font-medium text-ink">
                  {g.label} · {eurExact(Number(g.value))}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {nameOf.get(g.brand_id)} → {nameOf.get(g.creator_id)} · envoyé le{" "}
                  {dateFr(g.sent_at)}
                </p>
                <p className="mt-1 text-xs text-amber-800">Motif : {g.dispute_reason}</p>
                <div className="mt-3 flex gap-2">
                  <form action={adminResolveInKind}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="decision" value="keep" />
                    <button
                      type="submit"
                      className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Maintenir
                    </button>
                  </form>
                  <form action={adminResolveInKind}>
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="decision" value="drop" />
                    <button
                      type="submit"
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                    >
                      Retirer
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ventes d'affiliation */}
      <section className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">Ventes d&apos;affiliation récentes</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Les ventes non financées signalent une marque à provision vide. Écarter une
          vente rend la réservation à la marque — à réserver aux cas de fraude avérée.
        </p>

        {sales.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">Aucune vente en attente.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {sales.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {eurExact(Number(s.sale_amount ?? 0))}
                    <span className="font-normal text-zinc-500">
                      {" "}
                      · commission {eurExact(Number(s.commission_amount ?? 0))}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-400">
                    {s.external_ref ?? "—"} · {dateFr(s.occurred_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.status === "unfunded"
                        ? "bg-red-50 text-red-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {s.status === "unfunded" ? "Non financée" : "Mise de côté"}
                  </span>
                  <form action={adminRejectSale} className="flex gap-1">
                    <input type="hidden" name="eventId" value={s.id} />
                    <input
                      name="reason"
                      placeholder="Motif…"
                      className="w-28 rounded-xl border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-purple-400"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
                    >
                      Écarter
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
