import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import PostbackPanel from "../campaigns/[id]/PostbackPanel";

export const metadata = { title: "Tracking des ventes — Collabbs" };

export default async function TrackingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "brand") redirect("/dashboard");

  const { data: brand } = await supabase
    .from("brands")
    .select("postback_secret, website, tracking_verified_at")
    .eq("id", user.id)
    .single();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const verified = Boolean(brand?.tracking_verified_at);
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">
        Tracking des ventes
      </h1>
      <p className="mt-2 text-zinc-600">
        Branche le tracking sur ta boutique une fois, et toutes tes campagnes d&apos;affiliation
        en profiteront automatiquement.
      </p>

      {/* Bandeau d'état */}
      <div
        className={`mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ${
          verified
            ? "border border-emerald-200 bg-emerald-50"
            : "border border-amber-200 bg-amber-50"
        }`}
      >
        <div>
          <p className={`text-sm font-semibold ${verified ? "text-emerald-800" : "text-amber-800"}`}>
            {verified ? "✅ Tracking opérationnel" : "🟡 Tracking pas encore configuré"}
          </p>
          <p className={`mt-0.5 text-xs ${verified ? "text-emerald-700" : "text-amber-700"}`}>
            {verified
              ? `Dernière vérification réussie le ${fmtDate(brand!.tracking_verified_at!)}.`
              : "Tant qu'il n'est pas branché sur ton site, les ventes attribuées aux créateurs ne remonteront pas."}
          </p>
        </div>
        {!brand?.website && (
          <Link
            href="/onboarding/brand"
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Renseigner mon site
          </Link>
        )}
      </div>

      {brand?.postback_secret && (
        <PostbackPanel
          origin={origin}
          brandId={user.id}
          secret={brand.postback_secret}
          website={brand.website ?? null}
        />
      )}
    </>
  );
}
