import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";
import { fetchSidebarData } from "@/lib/sidebar-data";
import { isAdmin } from "@/lib/admin";

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

  const [data, admin] = await Promise.all([fetchSidebarData(user.id), isAdmin()]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar {...data} isAdmin={admin} />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
