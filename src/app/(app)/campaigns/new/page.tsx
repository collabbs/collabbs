import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CampaignForm from "./CampaignForm";

export const metadata = {
  title: "Nouvelle campagne — Collabbs",
};

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, nichesRes, platformsRes, brandRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("niches").select("id, label").order("label"),
    supabase.from("platforms").select("id, label, slug").order("id"),
    supabase
      .from("brands")
      .select("commission_nano, commission_micro, commission_mid, commission_macro")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (profileRes.data?.role !== "brand") redirect("/dashboard");

  const b = brandRes.data;
  return (
    <CampaignForm
      niches={nichesRes.data ?? []}
      platforms={platformsRes.data ?? []}
      defaultCommission={{
        nano: b?.commission_nano ?? 3,
        micro: b?.commission_micro ?? 5,
        mid: b?.commission_mid ?? 8,
        macro: b?.commission_macro ?? 12,
      }}
    />
  );
}
