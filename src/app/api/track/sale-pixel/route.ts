import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOnce } from "@/lib/notifications";

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
  const commission = Math.round((amount * rate) / 100);

  const insertRes = await admin.from("affiliate_events").insert({
    link_id: link.id,
    type: "sale",
    sale_amount: amount,
    commission_amount: commission,
    external_ref: orderId,
  });
  // En cas de doublon (même order_id), l'index unique renvoie une erreur
  // qu'on ignore — c'est exactement ce qu'on veut (succès idempotent).

  if (!insertRes.error) {
    notifyOnce({
      userId: link.creator_id,
      type: "first_affiliate_sale",
      title: "🎉 Ta première vente affiliée !",
      body: `Une vente de ${amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} vient d'être attribuée à ton lien. Commission : ${commission.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}. Bienvenue dans le revenu passif.`,
      link: "/opportunities",
    }).catch(() => {});
  }

  return pixelResponse();
}
