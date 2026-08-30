"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report-error";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Confirme le rôle d'un compte arrivé sans rôle — c'est-à-dire par Google.
 *
 * Tout se passe dans la fonction SQL `confirm_user_role` : elle bascule la
 * ligne métier (creators ↔ brands) et le rôle du profil en une seule
 * transaction, et refuse si le rôle a déjà été confirmé. Le faire ici, en
 * trois requêtes, laisserait la porte ouverte à un compte à moitié basculé.
 */
export async function confirmerRole(role: "creator" | "brand") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await (supabase as any).rpc("confirm_user_role", {
    p_role: role,
  });

  if (error) {
    await reportError("onboarding/role", error, { userId: user.id });
    redirect("/onboarding/role?error=1");
  }

  // `false` = le rôle était déjà confirmé. Ce n'est pas une erreur : deux
  // onglets ouverts, un double clic. On envoie simplement vers la suite.
  if (data === false) redirect("/start");

  redirect(role === "brand" ? "/onboarding/brand" : "/onboarding/creator");
}
