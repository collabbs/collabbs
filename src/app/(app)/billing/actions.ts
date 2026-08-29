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
} from "@/lib/affiliate-billing";

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
