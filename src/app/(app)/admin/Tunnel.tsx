import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Le tunnel d'entrée, étape par étape.
 *
 * ─── Pourquoi ça compte des SESSIONS et non des passages ───
 * Quelqu'un qui rouvre le défilé trois fois compterait trois fois, et
 * gonflerait une étape sans que personne n'y soit entré de plus. La question
 * n'est pas « combien de fois » mais « combien de gens » — donc on déduplique
 * sur le jeton de session.
 *
 * ─── Ce que ça permet de voir ───
 * Où l'on perd. Hier soir, les six pires cartes se sont retrouvées en tête du
 * paquet, et personne ne l'a su avant que Julien ne le voie de ses yeux. Un
 * effondrement entre « défilé ouvert » et « relance vue » l'aurait dit.
 */

const ETAPES: { cle: string; libelle: string }[] = [
  { cle: "tunnel_ouvert", libelle: "Arrive sur l'accueil" },
  { cle: "cote_choisi", libelle: "Choisit son côté" },
  { cle: "questionnaire_fini", libelle: "Termine le questionnaire" },
  { cle: "defile_ouvert", libelle: "Ouvre le défilé" },
  { cle: "relance_vue", libelle: "Atteint 5 intérêts" },
  { cle: "inscription_cliquee", libelle: "Clique pour créer un compte" },
];

export default async function Tunnel() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tunnel_evenements")
    .select("session, etape, cote")
    .order("created_at", { ascending: false })
    .limit(20000);

  const sessions = new Map<string, Set<string>>();
  for (const e of data ?? []) {
    const vues = sessions.get(e.etape) ?? new Set<string>();
    vues.add(e.session);
    sessions.set(e.etape, vues);
  }

  const compte = (cle: string) => sessions.get(cle)?.size ?? 0;
  const depart = compte("tunnel_ouvert");

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-black tracking-tight text-ink">
        Tunnel d&apos;entrée
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Personnes distinctes par étape. Une même personne qui revient ne compte
        qu&apos;une fois.
      </p>

      {depart === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
          Aucun passage enregistré pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {ETAPES.map((e, i) => {
            const n = compte(e.cle);
            const part = depart > 0 ? Math.round((n / depart) * 100) : 0;
            // La chute par rapport à l'étape PRÉCÉDENTE : c'est elle qui
            // désigne l'écran à corriger, pas le pourcentage global.
            const precedent = i > 0 ? compte(ETAPES[i - 1].cle) : n;
            const chute = precedent > 0 ? Math.round(((precedent - n) / precedent) * 100) : 0;
            return (
              <li key={e.cle} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold text-ink">{e.libelle}</span>
                  <span className="font-display text-lg font-black tabular-nums text-ink">
                    {n}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F4F1F5]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(135deg,#5b21b6_0%,#7c3aed_50%,#06b6d4_100%)]"
                    style={{ width: `${part}%` }}
                  />
                </div>
                {i > 0 && chute > 0 && (
                  <p className="mt-1.5 text-[12px] text-zinc-500">
                    {chute} % partent à cette étape
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
