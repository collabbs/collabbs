"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";

/**
 * Avantages en nature — déclaration, annulation, contestation.
 *
 * La loi compte la valeur des cadeaux et dotations dans le seuil de 1 000 €
 * au même titre que l'argent versé. C'est la marque qui déclare : c'est elle
 * qui offre et qui connaît la valeur commerciale du bien. Le créateur peut
 * contester, parce que ça pèse sur SON cumul annuel.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

function back(msg: string, kind: "ok" | "error" = "ok"): never {
  redirect(`/contracts?${kind === "ok" ? "saved" : "error"}=${encodeURIComponent(msg)}`);
}

/** La marque déclare un cadeau, une dotation ou un service offert. */
export async function declareInKind(formData: FormData) {
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
  if (profile?.role !== "brand") back("Seule une marque peut déclarer un avantage.", "error");

  const handle = String(formData.get("handle") ?? "")
    .trim()
    .replace(/^@/, "");
  const label = String(formData.get("label") ?? "").trim();
  const value = Number(formData.get("value"));
  const sentAt = String(formData.get("sentAt") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!handle) back("Indique le @ du créateur.", "error");
  if (!label) back("Décris ce qui a été offert.", "error");
  if (!Number.isFinite(value) || value < 0) back("Valeur invalide.", "error");

  const { data: creator } = await supabase
    .from("creators")
    .select("id, handle")
    .eq("handle", handle)
    .maybeSingle();
  if (!creator) back(`Aucun créateur trouvé avec le @ « ${handle} ».`, "error");

  const { error } = await untyped(supabase).from("in_kind_benefits").insert({
    brand_id: user.id,
    creator_id: creator.id,
    label,
    value,
    sent_at: sentAt || new Date().toISOString().slice(0, 10),
    note: note || null,
  });
  if (error) back(error.message, "error");

  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();
  await notify({
    userId: creator.id,
    type: "in_kind_declared",
    title: `${brand?.name ?? "Une marque"} a déclaré un cadeau`,
    body:
      `« ${label} », valeur déclarée ${value.toFixed(2)} €. Cette valeur compte dans ` +
      `ton cumul annuel avec cette marque, au même titre qu'un paiement. Si c'est ` +
      `inexact, tu peux le contester.`,
    link: "/contracts",
  });

  revalidatePath("/contracts");
  back("Avantage déclaré. Sa valeur entre dans le cumul annuel.");
}

/** La marque retire une déclaration (erreur de saisie, envoi annulé). */
export async function cancelInKind(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) back("Déclaration introuvable.", "error");

  // La RLS restreint déjà à la marque propriétaire ; on filtre quand même.
  const { error } = await untyped(supabase)
    .from("in_kind_benefits")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("brand_id", user.id);
  if (error) back(error.message, "error");

  revalidatePath("/contracts");
  back("Déclaration retirée du cumul.");
}

/**
 * Le créateur conteste : jamais reçu, ou valeur surévaluée.
 * L'avantage sort du cumul tant que le litige n'est pas tranché — on ne va pas
 * imposer à un créateur un seuil gonflé par un cadeau qu'il n'a pas eu.
 */
export async function disputeInKind(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) back("Déclaration introuvable.", "error");
  if (reason.length < 5) back("Explique en quelques mots ce qui ne va pas.", "error");

  // Le créateur n'a pas le droit d'UPDATE via la RLS : on vérifie ici qu'il est
  // bien le destinataire, puis on écrit avec ses propres droits limités à la
  // contestation. Le service-role n'est pas nécessaire : la policy d'update est
  // réservée à la marque, donc on passe par une lecture + une écriture ciblée.
  const { data: row } = await untyped(supabase)
    .from("in_kind_benefits")
    .select("id, creator_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.creator_id !== user.id) back("Action non autorisée.", "error");

  const { error } = await untyped(supabase).rpc("dispute_in_kind_benefit", {
    p_id: id,
    p_reason: reason,
  });
  if (error) back(error.message, "error");

  const { data: full } = await untyped(supabase)
    .from("in_kind_benefits")
    .select("brand_id, label")
    .eq("id", id)
    .maybeSingle();
  if (full?.brand_id) {
    await notify({
      userId: full.brand_id,
      type: "in_kind_disputed",
      title: "Un créateur conteste un avantage déclaré",
      body: `« ${full.label} » — motif : ${reason}. La valeur est retirée du cumul annuel tant que ce n'est pas réglé.`,
      link: "/contracts",
    });
  }

  revalidatePath("/contracts");
  back("Contestation enregistrée. La marque est informée.");
}
