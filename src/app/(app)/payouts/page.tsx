import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { startCreatorPayoutOnboarding } from "../deals/actions";
import { eur } from "@/lib/deal";

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

  // Récap des gains issus des deals.
  const { data: txs } = await supabase
    .from("transactions")
    .select("net_amount, status")
    .eq("creator_id", user.id)
    .eq("type", "deal_payment");
  const received = (txs ?? [])
    .filter((t) => t.status === "released" || t.status === "paid")
    .reduce((s, t) => s + Number(t.net_amount), 0);
  const pending = (txs ?? [])
    .filter((t) => t.status === "in_escrow")
    .reduce((s, t) => s + Number(t.net_amount), 0);

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
    </>
  );
}
