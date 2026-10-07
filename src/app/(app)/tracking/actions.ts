"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { domaineBoutique } from "@/lib/shopify-webhook";
import { reportError } from "@/lib/report-error";

/**
 * La marque relie sa boutique Shopify.
 *
 * Deux valeurs, et elles ne jouent pas le même rôle : le domaine dit QUI nous
 * écrit, la clé prouve que c'est bien lui. Les stocker ensemble est ce qui
 * permet de refuser une vente fabriquée depuis n'importe où.
 */
export async function relierShopify(formData: FormData) {
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

  const domaine = domaineBoutique(String(formData.get("domaine") ?? ""));
  const cle = String(formData.get("cle") ?? "").trim();

  // Délier : les deux champs vides. C'est le geste d'une marque qui quitte
  // Shopify, et il doit être aussi simple que de relier.
  if (!domaine && !cle) {
    const { error } = await createAdminClient()
      .from("brands")
      .update({ shopify_domain: null, shopify_webhook_secret: null })
      .eq("id", user.id);
    if (error) {
      await reportError("shopify/deliaison", error, { userId: user.id });
      redirect("/tracking?error=" + encodeURIComponent("La boutique n'a pas pu être déliée."));
    }
    revalidatePath("/tracking");
    redirect("/tracking?shopify=delie");
  }

  if (!domaine || !domaine.endsWith(".myshopify.com")) {
    redirect(
      "/tracking?error=" +
        encodeURIComponent(
          "Donne l'adresse technique de ta boutique, celle qui finit par .myshopify.com — pas ton nom de domaine personnalisé. Shopify s'en sert pour signer ses envois.",
        ),
    );
  }
  if (!cle) {
    redirect(
      "/tracking?error=" +
        encodeURIComponent(
          "La clé de signature manque. Shopify l'affiche au moment où tu crées le webhook — sans elle, aucune vente ne peut être authentifiée.",
        ),
    );
  }

  const { error } = await createAdminClient()
    .from("brands")
    .update({ shopify_domain: domaine, shopify_webhook_secret: cle })
    .eq("id", user.id);

  if (error) {
    /* Une autre marque a déjà déclaré cette boutique. Le dire franchement :
       laisser croire que c'est enregistré ferait attendre des ventes qui
       n'arriveraient jamais. */
    const conflit = (error as { code?: string }).code === "23505";
    await reportError("shopify/liaison", error, { userId: user.id, detail: domaine });
    redirect(
      "/tracking?error=" +
        encodeURIComponent(
          conflit
            ? "Cette boutique est déjà reliée à un autre compte Collabbs. Écris-nous si c'est une erreur."
            : "La boutique n'a pas pu être reliée. Réessaie.",
        ),
    );
  }

  revalidatePath("/tracking");
  redirect("/tracking?shopify=relie");
}
