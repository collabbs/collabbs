import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
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
