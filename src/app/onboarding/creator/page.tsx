import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Wizard from "./Wizard";

export const metadata = {
  title: "Compléter mon profil — Collabbs",
};

export default async function CreatorOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, nichesRes, platformsRes, creatorRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase.from("niches").select("id, label").order("label"),
    supabase.from("platforms").select("id, label, slug").order("id"),
    supabase
      .from("creators")
      .select("handle, bio, custom_niche")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // L'onboarding créateur n'est pertinent que pour les créateurs.
  if (profileRes.data?.role !== "creator") redirect("/dashboard");

  return (
    <Wizard
      userId={user.id}
      displayName={profileRes.data?.display_name ?? "Créateur"}
      niches={nichesRes.data ?? []}
      platforms={platformsRes.data ?? []}
      initial={{
        handle: creatorRes.data?.handle ?? "",
        bio: creatorRes.data?.bio ?? "",
        avatarUrl: profileRes.data?.avatar_url ?? null,
        customNiche: creatorRes.data?.custom_niche ?? "",
      }}
    />
  );
}
