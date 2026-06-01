import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";
import { fetchSidebarData } from "@/lib/sidebar-data";

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

  const data = await fetchSidebarData(user.id);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar {...data} />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
