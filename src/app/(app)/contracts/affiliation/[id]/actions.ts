"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

/* eslint-disable @typescript-eslint/no-explicit-any */
const untyped = (c: unknown) => c as any;

/**
 * Signature d'un contrat-cadre d'affiliation.
 *
 * Contrairement au contrat d'une collaboration — où l'acceptation du créateur
 * vaut signature des deux côtés au même instant — le contrat-cadre est établi
 * après coup, sur une relation déjà en cours. Chaque partie le signe donc
 * séparément, quand elle le veut. Le contrat devient `signed` quand les deux
 * l'ont fait.
 *
 * La plateforme ne signe jamais à leur place : elle n'est pas partie au
 * contrat, et ce serait précisément la confusion à éviter.
 */
export async function signAffiliateContract(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "");
  if (!contractId) redirect("/contracts?error=Contrat+introuvable.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: contrat } = await untyped(admin)
    .from("contracts")
    .select("id, kind, brand_id, creator_id, brand_signed_at, creator_signed_at, status")
    .eq("id", contractId)
    .maybeSingle();

  if (!contrat || contrat.kind !== "affiliate") {
    redirect("/contracts?error=Contrat+introuvable.");
  }

  const estMarque = contrat.brand_id === user.id;
  const estCreateur = contrat.creator_id === user.id;
  if (!estMarque && !estCreateur) {
    redirect("/contracts?error=Ce+contrat+ne+te+concerne+pas.");
  }

  const champ = estMarque ? "brand_signed_at" : "creator_signed_at";
  if (contrat[champ]) {
    // Déjà signé — double clic, ou deux onglets. Rien à faire, rien à dire.
    redirect(`/contracts/affiliation/${contractId}`);
  }

  const now = new Date().toISOString();
  const autreSignee = estMarque ? contrat.creator_signed_at : contrat.brand_signed_at;

  const { data: maj } = await untyped(admin)
    .from("contracts")
    .update({
      [champ]: now,
      // Le contrat n'est signé que lorsque les DEUX l'ont fait.
      status: autreSignee ? "signed" : "pending_signature",
    })
    .eq("id", contractId)
    .is(champ, null)
    .select("id");

  if (!maj || maj.length === 0) {
    // Une signature simultanée est passée avant : l'état voulu est atteint.
    redirect(`/contracts/affiliation/${contractId}`);
  }

  // On prévient l'autre partie : soit qu'on attend sa signature, soit que le
  // contrat est complet.
  const autre = estMarque ? contrat.creator_id : contrat.brand_id;
  notify({
    userId: autre,
    type: autreSignee ? "affiliate_contract_signed" : "affiliate_contract_awaiting",
    title: autreSignee
      ? "Contrat-cadre signé par les deux parties"
      : "Un contrat-cadre attend ta signature",
    body: autreSignee
      ? "Votre relation d'affiliation est désormais couverte par un contrat écrit, comme la loi l'impose au-delà de 1 000 € par an."
      : "L'autre partie vient de signer. Il ne manque plus que toi pour que votre relation soit couverte par un contrat écrit.",
    link: "/contracts",
  }).catch(() => {});

  revalidatePath("/contracts");
  revalidatePath(`/contracts/affiliation/${contractId}`);
  redirect(`/contracts/affiliation/${contractId}?signed=1`);
}
