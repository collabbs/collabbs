import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { montantAuxVues } from "@/lib/performance";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";
import { eur } from "@/lib/campaign";

/**
 * Règlement d'une collaboration payée aux vues.
 *
 * Le séquestre a été encaissé au PLAFOND — c'est la seule façon de garantir au
 * créateur qu'il sera payé. Une fois les vues validées, le dû réel est presque
 * toujours inférieur. Ce module ramène le séquestre au montant réel :
 *
 *   1. il rembourse à la marque la part non due, commission comprise ;
 *   2. il réécrit la transaction pour qu'elle dise la vérité.
 *
 * Le point 2 est ce qui permet de ne créer AUCUN second chemin d'argent :
 * `attemptDealPayout` verse `net_amount` sans rien savoir des vues. En
 * corrigeant la transaction ici, le versement existant devient juste.
 *
 * ⚠️ La commission est recalculée sur le montant RÉELLEMENT VERSÉ, jamais sur
 * le plafond. Prélever 10 % d'un plafond de 1 000 € pour une vidéo qui en a
 * mérité 120 reviendrait à facturer 100 € sur 12 € de service rendu.
 *
 * ⚠️ Le taux utilisé est celui FIGÉ dans la transaction au moment du paiement,
 * pas le taux courant de la marque. Si elle s'abonne entre le paiement et la
 * validation, on ne réécrit pas ce qui a déjà été encaissé.
 */

export type Reglement = {
  ok: boolean;
  error?: string;
  /** Ce qui revient au créateur, après plafonnement. */
  du?: number;
  /** Ce qui repart chez la marque. */
  rembourse?: number;
};

export async function reglerCollaborationAuxVues(dealId: string): Promise<Reglement> {
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("brand_id, creator_id, amount, perf_rate, perf_views, title")
    .eq("id", dealId)
    .single();
  if (!deal) return { ok: false, error: "Collaboration introuvable." };
  if (deal.perf_rate == null)
    return { ok: false, error: "Cette collaboration n'est pas payée aux vues." };

  const plafond = Number(deal.amount);
  const du = montantAuxVues(Number(deal.perf_views ?? 0), Number(deal.perf_rate), plafond);

  const { data: tx } = await admin
    .from("transactions")
    .select("id, gross_amount, platform_fee_rate, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();

  // Sans séquestre, il n'y a rien à ramener au réel — et surtout rien à verser.
  // On refuse plutôt que de valider dans le vide : une validation posée sur un
  // deal non financé donnerait au créateur le sentiment d'être payé.
  if (!tx)
    return {
      ok: false,
      error:
        "Le paiement n'a pas encore été mis en séquestre. La marque doit régler la collaboration avant que les vues puissent être validées.",
    };
  if (tx.status !== "in_escrow")
    return { ok: false, error: "Ce paiement n'est plus en séquestre." };

  const taux = Number(tx.platform_fee_rate ?? 0);
  const commission = Math.round(du * taux);
  const nouveauBrut = du + commission;
  const aRembourser = Number(tx.gross_amount) - nouveauBrut;

  // Rien à rendre : les vues ont atteint (ou dépassé) le plafond. La
  // transaction est déjà juste, on n'y touche pas.
  if (aRembourser <= 0) return { ok: true, du, rembourse: 0 };

  if (!stripeConfigured)
    return { ok: false, error: "Stripe n'est pas configuré : le remboursement du reliquat est impossible." };
  if (!tx.reference)
    return { ok: false, error: "Référence de paiement manquante : le reliquat ne peut pas être remboursé." };

  try {
    await stripe.refunds.create(
      {
        payment_intent: tx.reference,
        amount: Math.round(aRembourser * 100),
        metadata: { deal_id: dealId, motif: "reliquat_performance" },
      },
      // Le même reliquat ne doit jamais partir deux fois. La clé porte le
      // montant : si les vues étaient corrigées puis revalidées, le second
      // remboursement serait un autre mouvement, légitime celui-là.
      { idempotencyKey: `perf-reliquat-${tx.id}-${aRembourser}` },
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Le remboursement du reliquat a échoué.",
    };
  }

  // Le versement au créateur lira `net_amount`. Tant que cette écriture n'a pas
  // eu lieu, il vaut encore le plafond — c'est-à-dire plus que ce que le
  // séquestre contient désormais. Un échec ici doit se voir.
  const { error: errTx } = await admin
    .from("transactions")
    .update({
      gross_amount: nouveauBrut,
      platform_fee: commission,
      net_amount: du,
      // Zéro vue validée : il n'y a rien à verser et tout est reparti chez la
      // marque. La transaction est soldée, pas en attente d'un virement de 0 €
      // que Stripe refuserait.
      ...(du === 0 ? { status: "refunded" as const } : {}),
    })
    .eq("id", tx.id);
  if (errTx) {
    await reportError("performance/reglement", errTx, {
      detail: `Reliquat de ${aRembourser} € remboursé à la marque pour le deal ${dealId}, mais la transaction ${tx.id} dit encore ${tx.gross_amount} €. Le versement au créateur porterait sur un montant qui n'est plus en séquestre.`,
    });
    return {
      ok: false,
      error:
        "Le reliquat a bien été remboursé, mais son enregistrement a échoué. Ne relance pas : contacte le support avec la référence de la collaboration.",
    };
  }

  await notify({
    userId: deal.brand_id,
    type: "payment_received_brand",
    title: `${eur(aRembourser)} te sont remboursés`,
    body: `Les vues validées sur « ${deal.title ?? "la collaboration"} » représentent ${eur(du)}. Le reste du plafond que tu avais séquestré repart sur ton moyen de paiement.`,
    link: `/deals/${dealId}`,
  });

  return { ok: true, du, rembourse: aRembourser };
}
