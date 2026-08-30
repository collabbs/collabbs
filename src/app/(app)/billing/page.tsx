import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eurExact as eur } from "@/lib/deal";
import { stripeConfigured } from "@/lib/stripe";
import { AFFILIATE_FEE_RATE, VALIDATION_DAYS, MIN_PAYOUT } from "@/lib/affiliate-billing";
import {
  startTopup,
  saveAutoTopup,
  retryTopup,
  forgetCard,
  refundSale,
  confirmPixelSale,
  rejectPixelSale,
} from "./actions";
import EmptyState from "@/components/EmptyState";

export const metadata = { title: "Provision — Collabbs" };

/* eslint-disable @typescript-eslint/no-explicit-any */
// Colonnes ajoutées par la migration 0035, pas encore dans database.types.ts.
const untyped = (c: unknown) => c as any;

const SALE_STATUS_META: Record<string, { label: string; tone: string }> = {
  unfunded: { label: "Non financée", tone: "bg-red-50 text-red-700" },
  pending: { label: "Mise de côté", tone: "bg-amber-50 text-amber-700" },
  validated: { label: "Acquise au créateur", tone: "bg-emerald-50 text-emerald-700" },
  paid: { label: "Versée", tone: "bg-emerald-50 text-emerald-700" },
  refunded: { label: "Remboursée", tone: "bg-zinc-100 text-zinc-600" },
  rejected: { label: "Écartée", tone: "bg-zinc-100 text-zinc-500" },
};

const LEDGER_LABEL: Record<string, string> = {
  topup: "Approvisionnement",
  reserve: "Commission réservée",
  reserve_release: "Réservation rendue",
  payout: "Versement créateur",
  adjustment: "Régularisation",
};

function dateFr(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    topup?: string;
    error?: string;
    saved?: string;
    cancelled?: string;
    refunded?: string;
  }>;
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
  if (profile?.role !== "brand") redirect("/dashboard");

  const { data: brand } = await untyped(supabase)
    .from("brands")
    .select(
      "id, balance, payment_method_id, autotopup_enabled, autotopup_threshold, autotopup_amount, topup_failed_at",
    )
    .eq("id", user.id)
    .single();

  const balance = Number(brand?.balance ?? 0);
  const hasCard = Boolean(brand?.payment_method_id);
  const autoOn = Boolean(brand?.autotopup_enabled);
  const threshold = Number(brand?.autotopup_threshold ?? 50);
  const topupAmount = Number(brand?.autotopup_amount ?? 200);
  const cardFailed = Boolean(brand?.topup_failed_at);

  // Engagements en cours : ce que la provision doit encore couvrir.
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("brand_id", user.id);
  const campaignIds = (campaigns ?? []).map((c) => c.id);

  let reserved = 0;
  let validated = 0;
  let unfunded = 0;
  let sales: any[] = [];
  let toReview: any[] = [];
  if (campaignIds.length > 0) {
    const { data: links } = await supabase
      .from("affiliate_links")
      .select("id")
      .in("campaign_id", campaignIds);
    const linkIds = (links ?? []).map((l) => l.id);

    if (linkIds.length > 0) {
      const { data: events } = await untyped(supabase)
        .from("affiliate_events")
        .select(
          "id, status, sale_amount, commission_amount, platform_fee, occurred_at, source, needs_review, affiliate_links(creators(handle))",
        )
        .in("type", ["sale", "action"])
        .in("link_id", linkIds)
        .order("occurred_at", { ascending: false })
        .limit(30);

      const all = (events ?? []) as any[];
      // Les ventes en attente de confirmation ne sont pas encore de l'argent :
      // elles ont leur propre section et ne comptent dans aucun total.
      toReview = all.filter((e) => e.needs_review);
      sales = all.filter((e) => !e.needs_review);
      for (const e of sales) {
        const total = Number(e.commission_amount ?? 0) + Number(e.platform_fee ?? 0);
        if (e.status === "pending") reserved += total;
        else if (e.status === "validated") validated += total;
        else if (e.status === "unfunded") unfunded += total;
      }
    }
  }

  const { data: ledger } = await untyped(supabase)
    .from("brand_ledger")
    .select("id, kind, amount, balance_after, label, created_at")
    .eq("brand_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);
  const movements = (ledger ?? []) as any[];

  const low = hasCard ? balance < threshold : balance < 50;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">Provision</h1>
      <p className="mt-2 text-zinc-600">
        Le compte qui paie les commissions de tes créateurs. Chaque vente y réserve
        immédiatement la commission due — c&apos;est ce qui garantit à tes créateurs
        qu&apos;ils seront payés.
      </p>

      {sp.topup && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ Provision approvisionnée. Tes campagnes d&apos;affiliation peuvent tourner.
        </p>
      )}
      {sp.refunded && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ Remboursement pris en compte. La commission mise de côté t&apos;a été rendue.
        </p>
      )}
      {sp.saved && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ Réglages enregistrés.
        </p>
      )}
      {sp.cancelled && (
        <p className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700">
          Approvisionnement annulé. Rien n&apos;a été débité.
        </p>
      )}
      {sp.error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{sp.error}</p>
      )}

      {!stripeConfigured && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Les paiements ne sont pas configurés sur cet environnement.
        </p>
      )}

      {/* Solde et engagements */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            low ? "border-amber-200 bg-amber-50" : "border-zinc-100 bg-white"
          }`}
        >
          <p className="font-display text-2xl font-black text-ink">{eur(balance)}</p>
          <p className="text-xs text-zinc-500">Solde disponible</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="font-display text-2xl font-black text-ink">{eur(reserved)}</p>
          <p className="text-xs text-zinc-500">Réservé ({VALIDATION_DAYS} j)</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="font-display text-2xl font-black text-emerald-700">{eur(validated)}</p>
          <p className="text-xs text-zinc-500">Validé</p>
        </div>
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            unfunded > 0 ? "border-red-200 bg-red-50" : "border-zinc-100 bg-white"
          }`}
        >
          <p
            className={`font-display text-2xl font-black ${
              unfunded > 0 ? "text-red-700" : "text-ink"
            }`}
          >
            {eur(unfunded)}
          </p>
          <p className="text-xs text-zinc-500">Non financé</p>
        </div>
      </div>

      {toReview.length > 0 && (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">
            {toReview.length} vente{toReview.length > 1 ? "s" : ""} à confirmer
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Ces ventes ont été déclarées par le script installé sur ta boutique. Un
            script tourne dans le navigateur du visiteur : il ne peut pas prouver
            qu&apos;une commande existe vraiment. Vérifie-les dans ton back-office avant
            de verser. Rien n&apos;est débité tant que tu n&apos;as pas confirmé.
          </p>
          <ul className="mt-3 space-y-2">
            {toReview.map((s2: any) => {
              const commission = Number(s2.commission_amount ?? 0);
              return (
                <li
                  key={s2.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {eur(Number(s2.sale_amount ?? 0))}
                      {s2.affiliate_links?.creators?.handle
                        ? ` · @${s2.affiliate_links.creators.handle}`
                        : ""}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {dateFr(s2.occurred_at)} · commission {eur(commission)} si tu confirmes
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <form action={rejectPixelSale}>
                      <input type="hidden" name="eventId" value={s2.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-800"
                      >
                        Aucune commande
                      </button>
                    </form>
                    <form action={confirmPixelSale}>
                      <input type="hidden" name="eventId" value={s2.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                      >
                        Confirmer
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unfunded > 0 && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">
            {eur(unfunded)} de commissions ne sont pas couvertes
          </p>
          <p className="mt-1 text-sm text-red-700">
            Des créateurs ont généré des ventes que ta provision ne pouvait pas payer.
            Approvisionne pour régulariser — c&apos;est ta réputation auprès d&apos;eux qui
            est en jeu.
          </p>
        </div>
      )}

      {cardFailed && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Ta dernière recharge a été refusée</p>
          <p className="mt-1 text-sm text-amber-800">
            Vérifie ta carte, puis relance. Tant que la provision est vide, les commissions
            de tes créateurs ne sont plus garanties.
          </p>
          <form action={retryTopup} className="mt-3">
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Relancer la recharge
            </button>
          </form>
        </div>
      )}

      {/* Approvisionner */}
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">Approvisionner</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Minimum 20 €. Ta carte est enregistrée au passage, pour que les recharges
          suivantes se fassent sans toi.
        </p>
        <form action={startTopup} className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="amount"
              min={20}
              step={10}
              defaultValue={200}
              required
              aria-label="Montant à approvisionner en euros"
              className="w-32 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
            <span className="text-sm text-zinc-500">€</span>
          </div>
          <button
            type="submit"
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Approvisionner
          </button>
        </form>
      </div>

      {/* Recharge automatique */}
      <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">Recharge automatique</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {hasCard
            ? "Quand le solde passe sous le seuil, on recharge ta carte automatiquement. Tes campagnes ne s'arrêtent jamais."
            : "Disponible dès ton premier approvisionnement : ta carte sera enregistrée à ce moment-là."}
        </p>

        <form action={saveAutoTopup} className="mt-4 space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={autoOn}
              disabled={!hasCard}
              className="h-4 w-4 accent-purple-600"
            />
            <span className="text-sm font-medium text-ink">
              Activer la recharge automatique
            </span>
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Recharger sous</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="threshold"
                  min={0}
                  step={10}
                  defaultValue={threshold}
                  disabled={!hasCard}
                  className="w-28 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400 disabled:bg-zinc-50"
                />
                <span className="text-sm text-zinc-500">€</span>
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">Montant rechargé</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="amount"
                  min={20}
                  step={10}
                  defaultValue={topupAmount}
                  disabled={!hasCard}
                  className="w-28 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400 disabled:bg-zinc-50"
                />
                <span className="text-sm text-zinc-500">€</span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={!hasCard}
            className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Enregistrer
          </button>
        </form>

        {hasCard && (
          <form action={forgetCard} className="mt-4 border-t border-zinc-100 pt-4">
            <p className="text-sm text-zinc-500">
              Une carte est enregistrée pour les recharges.
            </p>
            <button
              type="submit"
              className="mt-2 text-sm font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
            >
              Oublier cette carte
            </button>
          </form>
        )}
      </div>

      {/* Comment ça marche */}
      <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
        <h2 className="font-semibold text-ink">Comment l&apos;argent circule</h2>
        <ol className="mt-3 space-y-2 text-sm text-zinc-600">
          <li>
            <strong className="text-ink">1.</strong> Un créateur génère une vente. La
            commission qui lui revient, plus les frais Collabbs (
            {Math.round(AFFILIATE_FEE_RATE * 100)} % de cette commission), sont
            immédiatement réservés sur ta provision.
          </li>
          <li>
            <strong className="text-ink">2.</strong> Pendant {VALIDATION_DAYS} jours, la
            vente peut encore être remboursée — dans ce cas la réservation t&apos;est
            rendue intégralement.
          </li>
          <li>
            <strong className="text-ink">3.</strong> Passé ce délai, la commission est
            acquise au créateur et lui est versée au prochain versement mensuel (à partir
            de {eur(MIN_PAYOUT)}).
          </li>
        </ol>
        <p className="mt-3 text-sm text-zinc-500">
          Le créateur touche exactement le taux annoncé dans ta campagne. Les frais
          Collabbs s&apos;ajoutent par-dessus, ils ne sont jamais prélevés sur sa part.
        </p>
      </div>

      {/* Ventes attribuées */}
      {sales.length > 0 && (
        <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-ink">Ventes attribuées</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Si tu rembourses un client, déclare-le ici : la commission mise de côté
            t&apos;est immédiatement rendue. Une fois la commission versée au créateur,
            ce n&apos;est plus possible automatiquement.
          </p>

          <ul className="mt-3 divide-y divide-zinc-100">
            {sales.map((s) => {
              const meta = SALE_STATUS_META[s.status] ?? {
                label: s.status,
                tone: "bg-zinc-100 text-zinc-600",
              };
              const handle = s.affiliate_links?.creators?.handle;
              const total =
                Number(s.commission_amount ?? 0) + Number(s.platform_fee ?? 0);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      Vente de {eur(Number(s.sale_amount ?? 0))}
                      {handle && (
                        <span className="font-normal text-zinc-500"> · @{handle}</span>
                      )}
                      {s.source === "promo_code" && (
                        <span className="font-normal text-zinc-500"> · code promo</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {dateFr(s.occurred_at)} · commission{" "}
                      {eur(Number(s.commission_amount ?? 0))} + frais{" "}
                      {eur(Number(s.platform_fee ?? 0))} = {eur(total)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    {(s.status === "pending" || s.status === "unfunded") && (
                      <form action={refundSale}>
                        <input type="hidden" name="eventId" value={s.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 underline underline-offset-2 hover:text-red-700"
                        >
                          Remboursée
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Registre */}
      <div className="mt-4 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-ink">Mouvements</h2>
        {movements.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              variant="card"
              icon="📒"
              title="Aucun mouvement"
              description="Ton premier approvisionnement apparaîtra ici, puis chaque commission réservée et chaque versement."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {movements.map((m) => {
              const amount = Number(m.amount);
              const credit = amount > 0;
              return (
                <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {m.label || LEDGER_LABEL[m.kind] || m.kind}
                    </p>
                    <p className="text-xs text-zinc-500">{dateFr(m.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        credit ? "text-emerald-700" : "text-ink"
                      }`}
                    >
                      {credit ? "+" : "−"}
                      {eur(Math.abs(amount))}
                    </p>
                    <p className="text-xs tabular-nums text-zinc-400">
                      solde {eur(Number(m.balance_after))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-sm text-zinc-500">
        Tu cherches le suivi de tes campagnes ?{" "}
        <Link href="/campaigns" className="font-medium text-purple-700 underline">
          Voir mes campagnes
        </Link>
      </p>
    </div>
  );
}
