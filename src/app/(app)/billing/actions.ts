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
import { valider, nombreDuFormulaire } from "@/lib/validation";
import { approvisionnementSchema, rechargeAutoSchema } from "@/lib/schemas/billing";
import { reportError } from "@/lib/report-error";
import { ouvrirAbonnement } from "@/lib/abonnement-stripe";
import { planValide } from "@/lib/tarifs";

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

  // `Number(formData.get(...))` laissait passer deux choses : un champ vidé
  // (qui vaut 0, un montant parfaitement valide en apparence) et une saisie à
  // la française — « 49,90 » devient NaN et partait jusqu'à Stripe.
  const controle = valider(approvisionnementSchema, {
    amount: nombreDuFormulaire(formData.get("amount")),
  });
  if (!controle.ok) {
    redirect(`/billing?error=${encodeURIComponent(controle.error)}`);
  }
  const { amount } = controle.data;

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
  let threshold = Number(formData.get("threshold"));
  let amount = Number(formData.get("amount"));

  // Le contrôle ne s'applique QUE si la recharge est activée : quand la case
  // est décochée, le formulaire désactive les deux champs et ils n'arrivent
  // pas jusqu'ici. Les exiger empêcherait simplement de désactiver la
  // recharge automatique.
  if (enabled) {
    const controle = valider(rechargeAutoSchema, {
      threshold: nombreDuFormulaire(formData.get("threshold")),
      amount: nombreDuFormulaire(formData.get("amount")),
    });
    if (!controle.ok) {
      redirect(`/billing?error=${encodeURIComponent(controle.error)}`);
    }
    threshold = controle.data.threshold;
    amount = controle.data.amount;
  }

  const admin = createAdminClient();
  const { error } = await untyped(admin)
    .from("brands")
    .update({
      autotopup_enabled: enabled,
      autotopup_threshold: Number.isFinite(threshold) ? threshold : 50,
      autotopup_amount: Number.isFinite(amount) ? amount : 200,
    })
    .eq("id", brandId);
  // Sans ce contrôle, la page annonçait « enregistré » quoi qu'il arrive. La
  // marque repartait en croyant sa recharge automatique active, et découvrait
  // le contraire le jour où sa provision tombait à sec en pleine campagne.
  if (error) {
    await reportError("billing/auto-topup", error, { userId: brandId });
    redirect("/billing?error=La+recharge+automatique+n%27a+pas+pu+%C3%AAtre+enregistr%C3%A9e.");
  }

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
  const { error } = await untyped(admin)
    .from("brands")
    .update({ payment_method_id: null, autotopup_enabled: false })
    .eq("id", brandId);
  // Dire « c'est oublié » quand la carte est toujours enregistrée serait le
  // pire mensonge de cette page.
  if (error) {
    await reportError("billing/forget-card", error, { userId: brandId });
    redirect("/billing?error=La+carte+n%27a+pas+pu+%C3%AAtre+oubli%C3%A9e.+R%C3%A9essaie.");
  }

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
  const { data: ecartee, error } = await untyped(admin)
    .from("affiliate_events")
    .update({
      needs_review: false,
      reviewed_at: new Date().toISOString(),
      status: "rejected",
      reject_reason: "Aucune commande correspondante chez la marque",
    })
    .eq("id", eventId)
    .eq("needs_review", true)
    .select("id");
  // Le créateur est prévenu juste en dessous qu'on a écarté sa vente : il ne
  // faut pas le lui annoncer si elle est en réalité toujours en attente.
  if (error || !ecartee || ecartee.length === 0) {
    if (error) await reportError("billing/reject-sale", error, { userId: brandId });
    redirect("/billing?error=La+vente+n%27a+pas+pu+%C3%AAtre+%C3%A9cart%C3%A9e.+R%C3%A9essaie.");
  }

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


/**
 * La marque souscrit un abonnement. Le plan est lu du formulaire et validé :
 * un plan inconnu ne doit pas ouvrir un paiement au hasard.
 */
export async function souscrireAbonnement(formData: FormData) {
  const brandId = await requireBrand();
  const voulu = planValide(String(formData.get("plan") ?? ""));
  if (voulu === "free") {
    redirect("/billing?error=Plan+inconnu.");
  }

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const res = await ouvrirAbonnement({
    brandId,
    plan: voulu,
    origin: `${proto}://${host}`,
  });
  if (!res.ok || !res.url) {
    redirect(`/billing?error=${encodeURIComponent(res.error ?? "Abonnement indisponible.")}`);
  }
  redirect(res.url);
}
