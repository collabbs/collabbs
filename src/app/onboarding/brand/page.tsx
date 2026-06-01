import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppOrLandingShell from "@/components/app/AppOrLandingShell";
import BrandWizard from "./BrandWizard";

export const metadata = {
  title: "Compléter mon profil marque — Collabbs",
};

export default async function BrandOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, brandRes] = await Promise.all([
    supabase.from("profiles").select("role, display_name").eq("id", user.id).single(),
    supabase
      .from("brands")
      .select("name, sector, website, logo_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (profileRes.data?.role !== "brand") redirect("/dashboard");

  const b = brandRes.data;
  return (
    <AppOrLandingShell>
      <BrandWizard
        userId={user.id}
        initial={{
          name: b?.name ?? profileRes.data?.display_name ?? "",
          sector: b?.sector ?? "",
          website: b?.website ?? "",
          logoUrl: b?.logo_url ?? null,
        }}
      />
    </AppOrLandingShell>
  );
}
