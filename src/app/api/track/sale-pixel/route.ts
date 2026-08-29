import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

// Pixel "client-side" pour le drop-in script (track.js).
// Sécurité : on n'a pas de secret côté navigateur, donc on vérifie que le
// `Referer` de l'appel correspond au site web enregistré par la marque.
// Idempotent : (link_id, external_ref) sous index unique partiel.

// GIF transparent 1×1.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(status = 200) {
  return new Response(new Uint8Array(PIXEL), {
    status,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function eur(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function hostOf(input: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    return url.host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function refererAllowed(referer: string | null, website: string | null): boolean {
  const ref = hostOf(referer);
  const allowed = hostOf(website);
  if (!ref || !allowed) return false;
  return ref === allowed || ref.endsWith("." + allowed);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get("brand");
  const ref = url.searchParams.get("ref");
  const amountRaw = url.searchParams.get("amount");
  const orderId = url.searchParams.get("order_id");

  // Toujours renvoyer un pixel (200) pour ne pas casser la page de la marque,
  // même en cas d'erreur — mais on ne fait rien d'autre.
  if (!brandId || !ref || !amountRaw || !orderId) return pixelResponse();
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return pixelResponse();

  const admin = createAdminClient();

  const { data: brand } = await admin
    .from("brands")
    .select("id, website")
    .eq("id", brandId)
    .maybeSingle();
  if (!brand) return pixelResponse();

  // Vérification d'origine : le Referer doit pointer sur le site enregistré.
  const referer = request.headers.get("referer");
  if (!refererAllowed(referer, brand.website)) return pixelResponse();

  const { data: link } = await admin
    .from("affiliate_links")
    .select(
      "id, creator_id, campaigns(brand_id, commission_nano, commission_micro, commission_mid, commission_macro)",
    )
    .eq("code", ref)
    .maybeSingle();
  if (!link) return pixelResponse();
  if (link.campaigns?.brand_id !== brand.id) return pixelResponse();

  // Palier de commission par audience du créateur.
  const { data: platforms } = await admin
    .from("creator_platforms")
    .select("subscribers")
    .eq("creator_id", link.creator_id);
  const subs = Math.max(0, ...(platforms ?? []).map((x) => x.subscribers ?? 0));
  const c = link.campaigns;
  let rate = 0;
  if (c) {
    if (subs >= 200000) rate = c.commission_macro ?? 0;
    else if (subs >= 50000) rate = c.commission_mid ?? 0;
    else if (subs >= 10000) rate = c.commission_micro ?? 0;
    else rate = c.commission_nano ?? 0;
  }
  // Au centime : on manipule désormais de l'argent réellement versé.
  const commission = Math.round(amount * rate) / 100;

  const insertRes = await admin
    .from("affiliate_events")
    .insert({
      link_id: link.id,
      type: "sale",
      // Le navigateur DÉCLARE une vente, il ne la prouve pas : le seul contrôle
      // possible ici est le `Referer`, que n'importe qui falsifie en une ligne
      // de commande. On enregistre donc sans rien réserver, et on demande à la
      // marque de confirmer. Voir la migration 0042 pour le détail.
      source: "pixel",
      needs_review: true,
      status: "unfunded",
      sale_amount: amount,
      commission_amount: commission,
      external_ref: orderId,
    })
    .select("id")
    .single();
  // En cas de doublon (même order_id), l'index unique renvoie une erreur
  // qu'on ignore — c'est exactement ce qu'on veut (succès idempotent).

  if (!insertRes.error && insertRes.data) {
    // Pas de `settleSale` ici : aucun argent ne bouge avant confirmation.
    // On prévient la marque, qui seule peut vérifier la commande chez elle.
    // `notify` et non `notifyOnce` : chaque vente en attente est de l'argent
    // dû à un créateur, elle mérite sa propre alerte.
    notify({
      // `brands.id` est aussi l'identifiant du profil propriétaire.
      userId: brand.id,
      type: "pixel_sale_to_review",
      title: "Une vente à confirmer",
      body: `Une vente de ${eur(amount)} a été déclarée depuis ta boutique. Confirme-la pour verser ${eur(commission)} de commission au créateur.`,
      link: "/billing",
    }).catch(() => {});
  }

  return pixelResponse();
}
