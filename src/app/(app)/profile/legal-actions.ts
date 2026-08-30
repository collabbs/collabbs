"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LegalInfoData } from "./legal-utils";
import { valider } from "@/lib/validation";
import { coordonneesLegalesSchema } from "@/lib/schemas/legal";

export async function saveLegalInfo(
  data: LegalInfoData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  // Ces valeurs finissent GELÉES dans un contrat signé : un SIRET erroné y
  // devient définitif. On vérifie donc le format de ce qui est fourni — sans
  // rien rendre obligatoire : sous le seuil de 1 000 €, la loi n'exige pas ces
  // mentions, et un créateur débutant n'a souvent aucun statut juridique. Le
  // blocage, quand il doit exister, se fait à l'acceptation d'une
  // collaboration qui franchit le seuil.
  const controle = valider(coordonneesLegalesSchema, data);
  if (!controle.ok) return { ok: false, error: controle.error };

  // Upsert : 1 ligne par utilisateur, on remplace si déjà existant.
  const { error } = await supabase.from("legal_info").upsert({
    user_id: user.id,
    status: data.status || null,
    legal_name: data.legalName.trim() || null,
    rep_name: data.repName.trim() || null,
    address: data.address.trim() || null,
    city: data.city.trim() || null,
    zip: data.zip.trim() || null,
    country: data.country.trim() || "France",
    siret: data.siret.trim() || null,
    vat: data.vat.trim() || null,
    contact_email: data.contactEmail.trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
