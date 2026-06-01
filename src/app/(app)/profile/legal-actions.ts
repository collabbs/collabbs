"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LegalInfoData } from "./legal-utils";

export async function saveLegalInfo(
  data: LegalInfoData,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

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
