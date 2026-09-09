"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { blocagesAvantSuppression, archiverContratsDe } from "@/lib/suppression-compte";
import { reportError } from "@/lib/report-error";

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
 *
 * ─── Ce que faisait cette fonction avant, et pourquoi c'était grave ───
 * Elle appelait `deleteUser` et rien d'autre. Tout cascade en base : profil →
 * collaborations → transactions → contrats. Or une collaboration a DEUX
 * parties, et l'autre n'a rien demandé.
 *
 * Un créateur qui partait pendant qu'un séquestre était ouvert effaçait le
 * deal ET la transaction. L'argent restait chez Stripe, la marque n'était
 * jamais remboursée, et il ne restait plus une ligne en base pour rattraper à
 * la main. Les contrats signés disparaissaient aussi pour l'autre partie — un
 * contrat est une preuve à deux exemplaires, et l'un des signataires pouvait
 * faire disparaître celui de l'autre, d'un clic, sans qu'il en soit informé.
 *
 * ─── Ce qu'elle fait maintenant, dans cet ordre ───
 *   1. Elle REFUSE tant que quelque chose est en cours — argent immobilisé,
 *      collaboration active, commission due — et dit quoi faire pour partir.
 *   2. Elle ARCHIVE les contrats signés pour la partie qui reste.
 *   3. Alors seulement elle supprime.
 *
 * Si l'archivage échoue, on ne supprime PAS. Un compte qu'on n'a pas pu
 * effacer se réessaie ; des preuves détruites ne se rattrapent pas.
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

  // ── 1. Rien ne doit être en cours ──
  const blocages = await blocagesAvantSuppression(user.id);
  if (blocages.length > 0) {
    const message = blocages.map((b) => `${b.quoi} ${b.issue}`).join(" — ");
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }

  // ── 2. Ce que l'autre partie garde ──
  try {
    await archiverContratsDe(user.id);
  } catch (e) {
    await reportError("compte/archivage-contrats", e, { detail: `utilisateur ${user.id}` });
    redirect(
      "/settings?error=" +
        encodeURIComponent(
          "Tes contrats signés n'ont pas pu être mis à l'abri pour tes partenaires, et on ne supprime pas un compte sans ça. Réessaie dans un moment — si ça persiste, écris-nous.",
        ),
    );
  }

  // ── 3. La suppression elle-même ──
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
