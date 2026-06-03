import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { startCreatorPayoutOnboarding } from "../deals/actions";
import { eur } from "@/lib/deal";
import EmptyState from "@/components/EmptyState";

export const metadata = { title: "Paiements — Collabbs" };

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  const { error, done } = await searchParams;
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
  if (profile?.role !== "creator") redirect("/dashboard");

  const { data: creator } = await supabase
    .from("creators")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  // Statut du compte connecté (live).
  let canReceive = false; // capacité "transfers" active → peut recevoir un versement
  let detailsSubmitted = false;
  let connectError = false;
  if (stripeConfigured && creator?.stripe_account_id) {
    try {
      const acct = await stripe.accounts.retrieve(creator.stripe_account_id);
      canReceive = acct.capabilities?.transfers === "active";
      detailsSubmitted = acct.details_submitted ?? false;
    } catch {
      connectError = true;
    }
  }

  // Récap des gains issus des deals + liste détaillée pour les factures.
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, deal_id, gross_amount, net_amount, platform_fee, status, created_at, paid_at")
    .eq("creator_id", user.id)
    .eq("type", "deal_payment")
    .order("created_at", { ascending: false });
  const txList = txs ?? [];
  const received = txList
    .filter((t) => t.status === "released" || t.status === "paid")
    .reduce((s, t) => s + Number(t.net_amount), 0);
  const pending = txList
    .filter((t) => t.status === "in_escrow")
    .reduce((s, t) => s + Number(t.net_amount), 0);

  // Titres des deals correspondants pour humaniser la liste
  const dealIds = txList.map((t) => t.deal_id).filter((id): id is string => Boolean(id));
  const { data: dealsData } = dealIds.length
    ? await supabase.from("deals").select("id, title, brand_id").in("id", dealIds)
    : { data: [] };
  const dealMap = new Map((dealsData ?? []).map((d) => [d.id, d]));
  const brandIds = (dealsData ?? []).map((d) => d.brand_id);
  const { data: brandsData } = brandIds.length
    ? await supabase.from("brands").select("id, name").in("id", brandIds)
    : { data: [] };
  const brandMap = new Map((brandsData ?? []).map((b) => [b.id, b.name]));

  const TX_STATUS_META: Record<
    string,
    { label: string; tone: string }
  > = {
    in_escrow: { label: "En séquestre", tone: "bg-amber-50 text-amber-700" },
    released: { label: "Libérée", tone: "bg-emerald-50 text-emerald-700" },
    paid: { label: "Versée", tone: "bg-emerald-50 text-emerald-700" },
    refunded: { label: "Remboursée", tone: "bg-zinc-100 text-zinc-600" },
    cancelled: { label: "Annulée", tone: "bg-zinc-100 text-zinc-500" },
    pending: { label: "En attente", tone: "bg-zinc-50 text-zinc-500" },
  };

  const hasAccount = Boolean(creator?.stripe_account_id);
  const ready = hasAccount && canReceive;

  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">Paiements</h1>
      <p className="mt-2 text-zinc-600">
        Connecte ton compte pour recevoir l&apos;argent de tes collaborations en toute sécurité.
      </p>

      {done && !ready && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Configuration enregistrée. Stripe peut demander quelques infos en plus avant d&apos;activer les versements.
        </p>
      )}
      {error === "connect" && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Stripe Connect n&apos;est pas encore activé sur la plateforme. (Réglage côté Collabbs.)
        </p>
      )}

      {/* Récap gains */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="font-display text-2xl font-black text-ink">{eur(received)}</p>
          <p className="text-xs text-zinc-500">Reçu</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="font-display text-2xl font-black text-ink">{eur(pending)}</p>
          <p className="text-xs text-zinc-500">En attente (séquestre)</p>
        </div>
      </div>

      {/* Carte connexion */}
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        {ready ? (
          <>
            <p className="font-semibold text-emerald-700">✓ Compte connecté — prêt à recevoir</p>
            <p className="mt-1 text-sm text-zinc-500">
              Tes versements arriveront automatiquement à la clôture de chaque deal.
            </p>
          </>
        ) : connectError ? (
          <>
            <p className="font-semibold text-ink">Connexion indisponible</p>
            <p className="mt-1 text-sm text-zinc-500">
              Les versements ne sont pas encore activés côté plateforme. Réessaie plus tard.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-ink">
              {hasAccount && detailsSubmitted
                ? "Configuration en cours de vérification"
                : hasAccount
                  ? "Termine la configuration de ton compte"
                  : "Connecte ton compte pour être payé"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Tu seras redirigé·e vers Stripe (notre partenaire de paiement) pour vérifier ton identité
              et ton compte bancaire. C&apos;est rapide et sécurisé.
            </p>
            <form action={startCreatorPayoutOnboarding} className="mt-4">
              <button
                type="submit"
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {hasAccount ? "Continuer la configuration" : "Connecter mon compte"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Liste des transactions */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-black text-ink">
          Historique <span className="text-zinc-400">({txList.length})</span>
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Télécharge la facture pour chaque transaction (justificatif comptable).
        </p>

        {txList.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              variant="card"
              icon="💸"
              title="Aucune transaction"
              description="Tes gains apparaîtront ici dès qu'une marque réglera un deal."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {txList.map((t) => {
              const deal = t.deal_id ? dealMap.get(t.deal_id) : null;
              const brandName = deal ? brandMap.get(deal.brand_id) : null;
              const meta = TX_STATUS_META[t.status] ?? TX_STATUS_META.pending;
              return (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {deal?.title ?? "Collaboration"}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {brandName ?? "Marque"} ·{" "}
                      {new Date(t.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-display text-base font-black text-ink">
                        {eur(Number(t.net_amount))}
                      </p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.tone}`}>
                        {meta.label}
                      </span>
                    </div>
                    <Link
                      href={`/invoices/${t.id}`}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-inset ring-purple-200 transition hover:bg-purple-50"
                    >
                      📄 Facture
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
