import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreatorCard from "@/components/landing/CreatorCard";
import SaveCreatorButton from "@/components/landing/SaveCreatorButton";
import { getMarketplaceCreators } from "@/lib/creators-data";

export const metadata = { title: "Ma shortlist — Collabbs" };

export default async function ShortlistPage() {
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

  const { data: saves } = await supabase
    .from("brand_creator_saves")
    .select("creator_id, created_at")
    .eq("brand_id", user.id)
    .order("created_at", { ascending: false });
  const savedIds = (saves ?? []).map((s) => s.creator_id);

  // Pour ne pas dupliquer la logique d'assemblage des cartes, on récupère TOUS
  // les créateurs marketplace puis on filtre par les ids sauvés. Petit overhead
  // assumé sur des volumes < 1000 créateurs.
  const all = await getMarketplaceCreators();
  const savedSet = new Set(savedIds);
  const indexed = new Map(savedIds.map((id, i) => [id, i]));
  const list = all
    .filter((c) => savedSet.has(c.id))
    .sort((a, b) => (indexed.get(a.id) ?? 0) - (indexed.get(b.id) ?? 0));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink">
            Ma shortlist
          </h1>
          <p className="mt-1 text-zinc-600">
            {list.length === 0
              ? "Aucun créateur sauvé pour l'instant."
              : `${list.length} créateur${list.length > 1 ? "s" : ""} dans ta shortlist.`}
          </p>
        </div>
        <Link
          href="/creators"
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Trouver des créateurs
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <p className="text-2xl">⭐</p>
          <p className="mt-2 font-semibold text-ink">Ta shortlist est vide</p>
          <p className="mt-1 text-sm text-zinc-500">
            Clique sur le cœur sur n&apos;importe quelle carte créateur pour le
            sauvegarder ici. Tu pourras y revenir à tout moment pour le contacter
            ou lui proposer une collab.
          </p>
          <Link
            href="/creators"
            className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Parcourir la marketplace
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((c) => (
            <CreatorCard
              key={c.handle}
              creator={c}
              href={`/creators/${c.handle}`}
              overlay={<SaveCreatorButton creatorId={c.id} initialSaved={true} />}
            />
          ))}
        </div>
      )}
    </>
  );
}
