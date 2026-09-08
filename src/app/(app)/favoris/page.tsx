import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIBELLES_TYPE, objetDuMontant } from "@/lib/collaboration";

export const metadata = { title: "Mes favoris — Collabbs" };

const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;

/**
 * Ce qu'on a retenu pendant le défilé, retrouvé dans son espace.
 *
 * ─── Pourquoi cette page existe ───
 * Le défilé était un cul-de-sac : on aimait des campagnes, on créait son
 * compte, et rien ne suivait. Le geste le plus engageant du produit ne menait
 * nulle part. Il mène ici.
 *
 * ─── Seulement côté créateur ───
 * La marque a déjà `/shortlist`, qui lit la même table que celle où sa reprise
 * écrit. Une seconde page pour la même liste finirait par la contredire.
 */
export default async function FavorisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const matchs = Number(typeof params.match === "string" ? params.match : 0);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const estMarque = profil?.role === "brand";

  // ⚠️ Côté marque, cette page n'existe pas : `/shortlist` fait déjà le
  // travail, sur la même table. J'allais en écrire une seconde — c'eût été
  // deux pages pour une même liste, qui finissent par se contredire.
  if (estMarque) redirect("/shortlist");

  const { data: liens } = await supabase
    .from("campagnes_favorites")
    .select("campaign_id, created_at")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  const ids = (liens ?? []).map((l) => l.campaign_id);
  const { data: campagnes } = ids.length
    ? await supabase
        .from("campaigns")
        .select("id, name, type, fixed_amount, commission_mid, status, brands(name)")
        .in("id", ids)
    : { data: [] };
  const parId = new Map((campagnes ?? []).map((c) => [c.id, c]));

  // Une campagne close reste dans la liste mais se signale : la retirer en
  // silence donnerait l'impression d'avoir perdu ce qu'on avait gardé.
  const favoris = (liens ?? [])
    .map((l) => ({ ...l, campagne: parId.get(l.campaign_id) }))
    .filter((f) => f.campagne);

  return (
    <>
      {/* ─── LE MATCH, ANNONCÉ ───
          Il vient d'être découvert en croisant ce qu'on a retenu avec ce que
          les marques avaient retenu de nous. C'est la première chose à voir en
          arrivant, pas une ligne au milieu d'une liste. */}
      {matchs > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_50%,#06b6d4_100%)] p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {matchs > 1 ? `${matchs} matchs` : "Un match"}
          </p>
          <p className="font-display mt-1.5 text-[24px] font-black leading-tight">
            {matchs > 1
              ? `${matchs} marques t'avaient déjà repéré.`
              : "Une marque t'avait déjà repéré."}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/80">
            Vous vous êtes choisis sans vous voir. Ouvre la campagne pour lui
            répondre.
          </p>
        </div>
      )}

      <h1 className="font-display text-3xl font-black tracking-tight text-ink">Mes favoris</h1>
      <p className="mt-2 text-[15px] text-zinc-500">
        Les campagnes que tu as retenues en faisant défiler.
      </p>

      {favoris.length === 0 ? (
        <Vide
          texte="Tu n'as encore retenu aucune campagne."
          lien="/defile"
          action="Voir les campagnes"
        />
      ) : (
        <ul className="mt-6 grid gap-3">
          {favoris.map((f) => {
            const c = f.campagne!;
            const close = c.status !== "active";
            return (
              <li key={f.campaign_id}>
                <Link
                  href={`/opportunities/${c.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-zinc-500">
                      {c.brands?.name ?? "Marque"}
                    </span>
                    <span className="block truncate font-semibold text-ink">{c.name}</span>
                    <span className="mt-1 inline-block rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
                      {LIBELLES_TYPE[c.type] ?? c.type}
                    </span>
                    {close && (
                      <span className="ml-2 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-500">
                        Fermée
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    {c.fixed_amount !== null ? (
                      <>
                        <span className="font-display block text-xl font-black tabular-nums text-ink">
                          {eur(c.fixed_amount)}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {objetDuMontant(c.type)}
                        </span>
                      </>
                    ) : c.commission_mid !== null ? (
                      <>
                        <span className="font-display block text-xl font-black tabular-nums text-ink">
                          {c.commission_mid} %
                        </span>
                        <span className="text-[11px] text-zinc-400">de commission</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Vide({ texte, lien, action }: { texte: string; lien: string; action: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 p-8 text-center">
      <p className="text-[15px] text-zinc-500">{texte}</p>
      <Link
        href={lien}
        className="mt-4 inline-flex items-center rounded-xl bg-ink px-5 py-2.5 text-[14px] font-semibold text-white transition hover:opacity-90"
      >
        {action}
      </Link>
    </div>
  );
}
