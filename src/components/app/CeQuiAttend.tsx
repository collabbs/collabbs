import Link from "next/link";
import type { Attente } from "@/lib/ce-qui-attend";

/**
 * « Ce qui t'attend » — la première chose qu'on lit en arrivant.
 *
 * ─── Pourquoi en haut, et pourquoi pas une pastille ───
 * Une pastille affiche un nombre. « 3 » ne dit ni ce qu'on attend de vous, ni
 * si ça presse, ni par quoi commencer — il faut cliquer pour savoir, et on ne
 * clique que si on soupçonne déjà que c'est important. Ici chaque ligne est une
 * phrase adressée au lecteur et un verbe unique. On n'a rien à deviner.
 *
 * ─── Quand la liste est vide ───
 * On le dit, au lieu de masquer le bloc. « Rien ne t'attend » est une
 * information : la balle est dans l'autre camp, et c'est exactement ce qu'on
 * vient vérifier en ouvrant son espace. Un bloc qui disparaît laisse dans le
 * doute — ai-je oublié quelque chose, ou n'y a-t-il rien ?
 *
 * ─── Deux niveaux, pas cinq ───
 * `bloque` : tant que ce n'est pas fait, l'autre partie ne peut pas avancer —
 * un séquestre non réglé, un contrat non signé. `a_faire` : c'est votre tour,
 * mais personne n'est à l'arrêt. Trois niveaux de plus ne rendraient pas la
 * lecture plus rapide, ils la rendraient plus lente.
 */
export default function CeQuiAttend({
  attentes,
  prenom,
}: {
  attentes: Attente[];
  prenom?: string | null;
}) {
  if (attentes.length === 0) {
    return (
      <section
        aria-label="Ce qui t'attend"
        className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm"
      >
        <p className="text-[15px] text-zinc-600">
          <span className="font-semibold text-ink">Rien ne t&apos;attend</span> pour le
          moment{prenom ? `, ${prenom}` : ""} — tout ce qui dépendait de toi est fait.
        </p>
      </section>
    );
  }

  const bloquants = attentes.filter((a) => a.urgence === "bloque").length;

  return (
    <section
      aria-label="Ce qui t'attend"
      className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-100 px-5 py-3.5">
        <h2 className="font-display text-base font-black tracking-tight text-ink">
          Ce qui t&apos;attend
        </h2>
        <p className="text-xs font-semibold text-zinc-500">
          {attentes.length} chose{attentes.length > 1 ? "s" : ""} à faire
          {bloquants > 0 && (
            <>
              {" · "}
              <span className="text-rose-700">
                {bloquants} bloque{bloquants > 1 ? "nt" : ""} l&apos;autre partie
              </span>
            </>
          )}
        </p>
      </header>

      <ul className="divide-y divide-zinc-100">
        {attentes.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4 sm:flex-nowrap sm:items-center"
          >
            {/* Le repère de gravité : une barre, pas une couleur de fond. Un
                bloc entièrement rouge se lit comme une panne ; ici c'est une
                tâche, et il peut y en avoir trois à la suite. */}
            <span
              aria-hidden
              className={`mt-1.5 h-9 w-1 shrink-0 rounded-full sm:mt-0 ${
                a.urgence === "bloque" ? "bg-rose-500" : "bg-purple-400"
              }`}
            />

            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug text-ink">{a.quoi}</p>
              {a.echeance && (
                <p
                  className={`mt-1 text-xs font-semibold ${
                    a.echeance.depasse
                      ? "text-rose-700"
                      : a.echeance.jours <= 2
                        ? "text-amber-700"
                        : "text-zinc-500"
                  }`}
                >
                  {a.echeance.depasse
                    ? "Le délai est dépassé — la validation devient automatique"
                    : a.echeance.jours === 0
                      ? "Dernier jour"
                      : `Il te reste ${a.echeance.jours} jour${a.echeance.jours > 1 ? "s" : ""}`}
                </p>
              )}
            </div>

            <Link
              href={a.lien}
              className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {a.verbe}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
