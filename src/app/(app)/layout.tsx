import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, avatar_url")
    .eq("id", user.id)
    .single();

  const role = profile?.role === "brand" ? "brand" : "creator";

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar
        role={role}
        name={profile?.display_name ?? "Mon compte"}
        avatarUrl={profile?.avatar_url ?? null}
      />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
