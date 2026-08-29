"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTopupCheckout,
  attemptAutoTopup,
  releaseReservation,
  settleSale,
} from "@/lib/affiliate-billing";
import { notify } from "@/lib/notifications";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Colonnes ajoutées par la migration 0035, pas encore dans database.types.ts.
const untyped = (c: unknown) => c as any;

async function requireBrand() {
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

  return user.id;
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "collabbs.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Approvisionne la provision : ouvre le paiement Stripe et y renvoie la marque. */
export async function startTopup(formData: FormData) {
  const brandId = await requireBrand();
  const amount = Number(formData.get("amount"));

  const res = await createTopupCheckout({
    brandId,
    amount,
    origin: await origin(),
  });

  if (!res.ok || !res.url) {
    redirect(`/billing?error=${encodeURIComponent(res.error ?? "Paiement indisponible.")}`);
  }
  redirect(res.url);
}

/** Règle la recharge automatique : activation, seuil de déclenchement, montant. */
export async function saveAutoTopup(formData: FormData) {
  const brandId = await requireBrand();

  const enabled = formData.get("enabled") === "on";
  const threshold = Number(formData.get("threshold"));
  const amount = Number(formData.get("amount"));

  if (enabled) {
    if (!Number.isFinite(threshold) || threshold < 0) {
      redirect("/billing?error=Seuil+invalide.");
    }
    if (!Number.isFinite(amount) || amount < 20) {
      redirect("/billing?error=Le+montant+de+recharge+doit+faire+au+moins+20+€.");
    }
  }

  const admin = createAdminClient();
  await untyped(admin)
    .from("brands")
    .update({
      autotopup_enabled: enabled,
      autotopup_threshold: Number.isFinite(threshold) ? threshold : 50,
      autotopup_amount: Number.isFinite(amount) ? amount : 200,
    })
    .eq("id", brandId);

  revalidatePath("/billing");
  redirect("/billing?saved=1");
}

/**
 * Relance une recharge à la main après un échec de carte.
 * Utile quand la marque a corrigé son moyen de paiement et veut débloquer
 * ses campagnes sans attendre la prochaine vente.
 */
export async function retryTopup() {
  const brandId = await requireBrand();
  const res = await attemptAutoTopup(brandId);
  revalidatePath("/billing");
  redirect(
    res.ok
      ? "/billing?topup=1"
      : `/billing?error=${encodeURIComponent(res.message ?? "Recharge impossible.")}`,
  );
}

/**
 * La marque déclare qu'une vente a été remboursée à son client.
 * La réservation correspondante lui est rendue sur sa provision.
 *
 * Contrôle indispensable : on vérifie que la vente appartient bien à une
 * campagne de cette marque, sinon n'importe qui pourrait annuler la commission
 * d'un créateur chez un concurrent.
 */
export async function refundSale(formData: FormData) {
  const brandId = await requireBrand();
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) redirect("/billing?error=Vente+introuvable.");

  const admin = createAdminClient();
  const { data: ev } = await untyped(admin)
    .from("affiliate_events")
    .select("id, affiliate_links(campaigns(brand_id))")
    .eq("id", eventId)
    .maybeSingle();

  const owner = ev?.affiliate_links?.campaigns?.brand_id;
  if (!ev || owner !== brandId) {
    redirect("/billing?error=Cette+vente+ne+t%27appartient+pas.");
  }

  const res = await releaseReservation({
    eventId,
    status: "refunded",
    reason: "Remboursement déclaré par la marque",
  });

  revalidatePath("/billing");
  redirect(
    res.ok
      ? "/billing?refunded=1"
      : `/billing?error=${encodeURIComponent(res.message ?? "Remboursement impossible.")}`,
  );
}

/** Oublie la carte enregistrée et coupe la recharge automatique. */
export async function forgetCard() {
  const brandId = await requireBrand();
  const admin = createAdminClient();
  await untyped(admin)
    .from("brands")
    .update({ payment_method_id: null, autotopup_enabled: false })
    .eq("id", brandId);

  revalidatePath("/billing");
  redirect("/billing?saved=1");
}

/**
 * Vérifie qu'une vente en attente appartient bien à la marque connectée, et
 * qu'elle est effectivement en attente. Renvoie l'événement, ou redirige.
 */
async function requireReviewableSale(brandId: string, eventId: string) {
  if (!eventId) redirect("/billing?error=Vente+introuvable.");

  const admin = createAdminClient();
  const { data: ev } = await untyped(admin)
    .from("affiliate_events")
    .select(
      "id, needs_review, commission_amount, sale_amount, affiliate_links(creator_id, campaigns(brand_id))",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!ev || ev.affiliate_links?.campaigns?.brand_id !== brandId) {
    redirect("/billing?error=Cette+vente+ne+t%27appartient+pas.");
  }
  if (!ev.needs_review) {
    // Déjà tranchée — probablement un double clic, ou deux onglets ouverts.
    redirect("/billing?error=Cette+vente+a+d%C3%A9j%C3%A0+%C3%A9t%C3%A9+trait%C3%A9e.");
  }
  return ev;
}

/**
 * La marque confirme une vente déclarée depuis sa boutique.
 *
 * C'est ici — et nulle part ailleurs — qu'une vente venue du navigateur devient
 * de l'argent. Le pixel ne peut pas prouver qu'une commande existe ; la marque,
 * elle, la voit dans son propre back-office.
 */
export async function confirmPixelSale(formData: FormData) {
  const brandId = await requireBrand();
  const eventId = String(formData.get("eventId") ?? "");
  const ev = await requireReviewableSale(brandId, eventId);

  const admin = createAdminClient();
  // On lève le drapeau AVANT de réserver, en le conditionnant à son état
  // actuel : si deux confirmations partent en même temps, une seule passe et
  // la commission n'est réservée qu'une fois.
  const { data: claimed } = await untyped(admin)
    .from("affiliate_events")
    .update({ needs_review: false, reviewed_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("needs_review", true)
    .select("id");

  if (!claimed || claimed.length === 0) {
    redirect("/billing?error=Cette+vente+a+d%C3%A9j%C3%A0+%C3%A9t%C3%A9+trait%C3%A9e.");
  }

  const res = await settleSale({
    eventId,
    brandId,
    creatorId: ev.affiliate_links?.creator_id,
    commission: Number(ev.commission_amount ?? 0),
    saleAmount: Number(ev.sale_amount ?? 0),
  });

  revalidatePath("/billing");
  redirect(
    res === "unfunded"
      ? "/billing?error=Vente+confirm%C3%A9e%2C+mais+ta+provision+est+insuffisante+pour+la+couvrir."
      : "/billing?confirmed=1",
  );
}

/**
 * La marque refuse une vente déclarée : aucune commande ne lui correspond.
 * Aucun argent n'ayant été réservé, il n'y a rien à libérer.
 */
export async function rejectPixelSale(formData: FormData) {
  const brandId = await requireBrand();
  const eventId = String(formData.get("eventId") ?? "");
  const ev = await requireReviewableSale(brandId, eventId);

  const admin = createAdminClient();
  await untyped(admin)
    .from("affiliate_events")
    .update({
      needs_review: false,
      reviewed_at: new Date().toISOString(),
      status: "rejected",
      reject_reason: "Aucune commande correspondante chez la marque",
    })
    .eq("id", eventId)
    .eq("needs_review", true);

  // Le créateur doit savoir, et pouvoir contester : une vente légitime peut
  // être refusée par erreur.
  const creatorId = ev.affiliate_links?.creator_id;
  if (creatorId) {
    notify({
      userId: creatorId,
      type: "affiliate_sale_rejected",
      title: "Une vente attribuée a été refusée",
      body: "La marque n'a pas retrouvé de commande correspondante. Si tu penses qu'il s'agit d'une erreur, contacte-la depuis la messagerie.",
      link: "/opportunities",
    }).catch(() => {});
  }

  revalidatePath("/billing");
  redirect("/billing?rejected=1");
}
