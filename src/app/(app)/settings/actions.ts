"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Change le mot de passe de l'utilisateur connecté.
 * Supabase v2 ne demande pas le mot de passe courant — la session
 * suffit. On garde quand même le champ pour la confirmation côté UI.
 */
export async function updatePassword(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const newPassword = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (newPassword.length < 8) {
    return { ok: false, error: "Le mot de passe doit faire au moins 8 caractères." };
  }
  if (newPassword !== confirm) {
    return { ok: false, error: "Les deux mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Supprime définitivement le compte de l'utilisateur courant.
 * - Requiert que l'utilisateur tape `SUPPRIMER` pour confirmer (anti accident).
 * - Utilise l'admin client pour la suppression (auth.users), qui cascade
 *   vers profiles via FK ON DELETE CASCADE et de là vers creators/brands/
 *   creator_niches/brand_niches/... idem.
 * - Sign out + redirect /login après suppression.
 */
export async function deleteAccount(formData: FormData) {
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "SUPPRIMER") {
    redirect("/settings?error=confirm");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  // L'utilisateur n'existe plus → sign out + retour login.
  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
