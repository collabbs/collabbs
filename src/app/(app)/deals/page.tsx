import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEAL_STATUS_META, eur, type DealStatus } from "@/lib/deal";

export const metadata = { title: "Collaborations — Collabbs" };

export default async function DealsPage() {
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
  const iAmBrand = profile?.role === "brand";

  const { data: dealsData } = await supabase
    .from("deals")
    .select("id, brand_id, creator_id, title, amount, status, deadline, created_at")
    .order("created_at", { ascending: false });
  const deals = dealsData ?? [];

  const otherIds = [
    ...new Set(deals.map((d) => (iAmBrand ? d.creator_id : d.brand_id))),
  ];
  const { data: profs } = otherIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", otherIds)
    : { data: [] as { id: string; display_name: string | null; avatar_url: string | null }[] };
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  const order: DealStatus[] = ["active", "negotiation", "completed", "cancelled"];
  const sorted = deals
    .slice()
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  const activeCount = deals.filter((d) => d.status === "active").length;
  const negoCount = deals.filter((d) => d.status === "negotiation").length;
  const doneCount = deals.filter((d) => d.status === "completed").length;

  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">
        Collaborations
      </h1>
      <p className="mt-2 text-zinc-600">
        Suis tes deals : négociation, livrables, clôture et paiement.
      </p>

      {deals.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { label: "En cours", value: activeCount },
            { label: "En négociation", value: negoCount },
            { label: "Terminés", value: doneCount },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
              <p className="font-display text-2xl font-black text-ink">{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {deals.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <p className="font-semibold text-ink">Aucune collaboration pour l&apos;instant</p>
          <p className="mt-1 text-sm text-zinc-500">
            {iAmBrand
              ? "Accepte une candidature puis crée un deal pour démarrer une collaboration."
              : "Tes deals avec les marques apparaîtront ici."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sorted.map((d) => {
            const p = profMap.get(iAmBrand ? d.creator_id : d.brand_id);
            const meta = DEAL_STATUS_META[d.status];
            return (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition hover:border-purple-200 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-200 to-pink-200 text-sm font-bold text-purple-700">
                  {p?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p?.display_name ?? "?").slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{d.title ?? "Collaboration"}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {iAmBrand ? "avec " : "pour "}
                    {p?.display_name ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-ink">{eur(d.amount)}</p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
