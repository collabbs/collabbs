import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
import { releaseReservation } from "@/lib/affiliate-billing";
import { notify } from "@/lib/notifications";
import { enregistrerVenteAuthentifiee } from "../sale/route";
import {
  EN_TETE_SIGNATURE,
  EN_TETE_BOUTIQUE,
  EN_TETE_SUJET,
  signatureValide,
  domaineBoutique,
  referenceDeLaCommande,
  montantDeLaCommande,
  referenceExterne,
  type CommandeShopify,
} from "@/lib/shopify-webhook";

/**
 * Les ventes Shopify, annoncées par la boutique elle-même.
 *
 * ─── Ce que ça remplace ───
 * Le pixel personnalisé. Éprouvé sur une vraie boutique le 19/09 : il n'atteint
 * jamais notre serveur, pas même sur une visite de page. Et même réparé, il
 * restait soumis au consentement du visiteur et aux bloqueurs — trop fragile
 * pour de l'argent dû à un créateur.
 *
 * ─── Ce que la marque fait, une fois ───
 * Shopify → Réglages → Notifications → Webhooks → « Commande payée », avec
 * notre adresse. Shopify affiche une clé de signature, elle la recopie dans
 * Collabbs. Pas d'application, pas de développeur, pas de code à écrire.
 *
 * ─── Pourquoi cette route est courte ───
 * Elle ne fait qu'UNE chose : prouver que l'appel vient bien de la boutique
 * déclarée, puis traduire la commande en vente. Le calcul de la commission, la
 * fenêtre d'attribution, la récurrence des abonnements, la réservation sur la
 * provision et la déduplication vivent dans le chemin de vente commun, déjà
 * éprouvé sur de l'argent réel. On ne duplique pas le circuit de l'argent.
 */

/** Shopify attend une réponse rapide et réessaie sinon : on ne traîne pas. */
export const maxDuration = 20;

export async function POST(request: Request) {
  // Le corps BRUT, avant tout analyse : la signature porte sur ces octets
  // exacts. Le relire depuis un objet reconstruit donnerait une empreinte
  // différente, et toutes les ventes seraient refusées sans bruit.
  const corpsBrut = await request.text();

  const signature = request.headers.get(EN_TETE_SIGNATURE);
  const boutique = domaineBoutique(request.headers.get(EN_TETE_BOUTIQUE));
  const sujet = request.headers.get(EN_TETE_SUJET) ?? "";

  if (!boutique) {
    return NextResponse.json({ ok: false, error: "boutique inconnue" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: marque } = await admin
    .from("brands")
    .select("id, shopify_webhook_secret, postback_secret")
    .eq("shopify_domain", boutique)
    .maybeSingle();

  /* Aucune marque n'a déclaré cette boutique. On répond 202 et non 404 : un
     webhook en erreur est réessayé huit fois par Shopify puis désactivé, et la
     marque recevrait un avertissement pour une configuration qui n'est
     simplement pas la nôtre. */
  if (!marque?.shopify_webhook_secret) {
    return NextResponse.json({ ok: true, ignore: "boutique non reliée" }, { status: 202 });
  }

  if (!signatureValide(corpsBrut, signature, marque.shopify_webhook_secret)) {
    /* Signé par personne, ou mal signé. C'est soit une clé recopiée de
       travers — le cas banal — soit quelqu'un qui tente de fabriquer une
       vente. Dans les deux cas on refuse, et on le signale : une marque dont
       la clé est fausse ne verrait jamais une seule vente remonter, sans
       comprendre pourquoi. */
    await reportError("shopify/signature", "signature invalide", {
      userId: marque.id,
      detail: `boutique ${boutique}, sujet ${sujet}`,
    });
    return NextResponse.json({ ok: false, error: "signature invalide" }, { status: 401 });
  }

  let commande: CommandeShopify;
  try {
    commande = JSON.parse(corpsBrut) as CommandeShopify;
  } catch {
    return NextResponse.json({ ok: false, error: "corps illisible" }, { status: 400 });
  }

  /* ─── Un remboursement reprend la commission ──────────────────────────────
     Sans ça, une marque qui rembourse son client laisse le créateur payé sur
     une vente qui n'a pas eu lieu. Elle pouvait déjà le faire à la main depuis
     sa provision ; Shopify nous le dit, autant ne pas le lui demander.

     On traite le remboursement AVANT de chercher une référence de créateur :
     l'objet reçu n'est pas une commande mais un remboursement, et ses champs
     ne sont pas les mêmes. */
  if (sujet === "refunds/create") {
    return traiterRemboursement(corpsBrut, marque.id, boutique);
  }

  const { code, clicke } = referenceDeLaCommande(commande);
  /* Aucune référence : la commande n'a pas été amenée par un créateur. C'est le
     cas de l'immense majorité des ventes d'une boutique, et ce n'est pas une
     erreur — on l'accepte sans rien enregistrer. */
  if (!code) {
    return NextResponse.json({ ok: true, ignore: "sans référence créateur" });
  }

  const montant = montantDeLaCommande(commande);
  if (montant <= 0) {
    return NextResponse.json({ ok: true, ignore: "montant nul" });
  }

  const externalRef = referenceExterne(commande);
  if (!externalRef) {
    /* Sans numéro de commande, rien n'empêche de compter deux fois la même
       vente — Shopify réessaie jusqu'à huit fois. Mieux vaut ne pas
       enregistrer que payer huit commissions. */
    await reportError("shopify/commande-sans-numero", "commande sans identifiant", {
      userId: marque.id,
      detail: `boutique ${boutique}`,
    });
    return NextResponse.json({ ok: false, error: "commande sans identifiant" }, { status: 400 });
  }

  /* Le chemin commun, avec le secret de la marque. Il revérifie que le lien du
     créateur appartient bien à cette marque : une référence volée à une autre
     boutique est rejetée là, par la comparaison des secrets. */
  return enregistrerVenteAuthentifiee({
    code,
    amount: String(montant),
    externalRef,
    clickedAt: clicke,
    abonnement: null,
    secret: marque.postback_secret ?? "",
  });
}


/**
 * Un remboursement Shopify annule la commission correspondante.
 *
 * Shopify envoie `order_id` : c'est la commande d'origine, donc exactement la
 * clé sous laquelle on a enregistré la vente. On retrouve l'évènement et on
 * relâche la réservation — la provision de la marque est recréditée, et la
 * commission n'est plus due.
 *
 * Remboursement PARTIEL : on ne touche à rien. Une commission proportionnelle
 * se discute (frais de port remboursés, un article sur trois rendu…) et
 * trancher à la place de la marque serait décider de l'argent d'un créateur
 * sans qu'il puisse en débattre. On la prévient, elle arbitre.
 */
async function traiterRemboursement(corpsBrut: string, brandId: string, boutique: string) {
  let remb: { order_id?: unknown; refund_line_items?: unknown[]; transactions?: unknown[] };
  try {
    remb = JSON.parse(corpsBrut);
  } catch {
    return NextResponse.json({ ok: false, error: "corps illisible" }, { status: 400 });
  }

  const externalRef = referenceExterne({ id: remb.order_id });
  if (!externalRef) return NextResponse.json({ ok: true, ignore: "remboursement sans commande" });

  const admin = createAdminClient();
  const { data: vente } = await admin
    .from("affiliate_events")
    .select("id, status, sale_amount, commission_amount")
    .eq("external_ref", externalRef)
    .eq("type", "sale")
    .maybeSingle();

  // Aucune vente de notre côté : la commande n'avait pas été amenée par un
  // créateur. C'est le cas courant, et ce n'est pas une anomalie.
  if (!vente) return NextResponse.json({ ok: true, ignore: "vente inconnue" });
  if (vente.status === "refunded") {
    return NextResponse.json({ ok: true, deja: true });
  }

  const montantRembourse = (remb.transactions ?? []).reduce((somme: number, t: unknown) => {
    const m = Number((t as { amount?: unknown })?.amount ?? 0);
    return somme + (Number.isFinite(m) ? m : 0);
  }, 0);
  const total = Number(vente.sale_amount ?? 0);
  const partiel = montantRembourse > 0 && total > 0 && montantRembourse < total - 0.01;

  if (partiel) {
    await notify({
      userId: brandId,
      type: "pixel_sale_to_review",
      title: "Remboursement partiel sur une vente commissionnée",
      body: `Tu as remboursé ${montantRembourse.toFixed(2)} € sur une commande de ${total.toFixed(2)} € qui a rapporté une commission. À toi de décider si elle reste due — depuis ta provision.`,
      link: "/billing",
    });
    return NextResponse.json({ ok: true, partiel: true });
  }

  const res = await releaseReservation({
    eventId: vente.id,
    status: "refunded",
    reason: `Remboursé sur Shopify (${boutique})`,
  });
  if (!res.ok) {
    await reportError("shopify/remboursement", res.message ?? "reprise impossible", {
      userId: brandId,
      detail: externalRef,
    });
    return NextResponse.json({ ok: false, error: res.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, rembourse: true });
}
