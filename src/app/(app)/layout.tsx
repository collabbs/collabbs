import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";
import RealtimeMessages from "@/components/app/RealtimeMessages";
import { fetchSidebarData } from "@/lib/sidebar-data";
import { isAdmin } from "@/lib/admin";
import RepriseDuDefile from "./RepriseDuDefile";

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

  const [data, admin, profil] = await Promise.all([
    fetchSidebarData(user.id),
    isAdmin(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar {...data} isAdmin={admin} />
      <RealtimeMessages userId={user.id} />
      {/* Ce qui a été retenu pendant le défilé rejoint le compte, quelle que
          soit la page d'arrivée après l'inscription. */}
      <RepriseDuDefile role={profil.data?.role ?? null} />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
