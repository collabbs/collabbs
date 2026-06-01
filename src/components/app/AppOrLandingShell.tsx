import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import Sidebar from "@/components/app/Sidebar";
import { fetchSidebarData } from "@/lib/sidebar-data";

/**
 * Coquille adaptive pour les pages mi-publiques / mi-privées (ex. la
 * marketplace `/creators`, les profils publics `/creators/[handle]`, les
 * pages d'édition de profil `/onboarding/*`).
 *
 * - User connecté → on garde la **sidebar app** (continuité de la navigation)
 *   + mobile top-nav identique au layout `(app)`.
 * - User anonyme → on rend la **Nav + Footer marketing** classiques.
 *
 * `contentClassName` contrôle la container styles (max-width, padding) ;
 * la valeur par défaut matche le layout `(app)`.
 */
export default async function AppOrLandingShell({
  children,
  contentClassName = "mx-auto max-w-5xl px-5 py-8 sm:px-8",
}: {
  children: React.ReactNode;
  contentClassName?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <Nav />
        <main className={contentClassName}>{children}</main>
        <Footer />
      </>
    );
  }

  const data = await fetchSidebarData(user.id);

  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar {...data} />
      <div className="lg:pl-60">
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}
