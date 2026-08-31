import type { Reperes } from "@/lib/benchmark";
import { phraseObservations } from "@/lib/benchmark";

/**
 * L'encart « combien mettre ».
 *
 * Deux rendus franchement différents, et c'est voulu : nos propres mesures et
 * des chiffres empruntés à d'autres ne doivent pas se ressembler. Les
 * présenter dans la même boîte reviendrait à laisser croire que le prix d'un
 * concurrent est une observation faite chez nous.
 *
 * Composant purement présentatif : il reçoit des données déjà calculées et ne
 * lit rien. C'est ce qui permet de le poser sur un formulaire client comme sur
 * une page serveur sans dupliquer la requête.
 */
export default function ReperesTarifaires({
  reperes,
  compact = false,
}: {
  reperes: Reperes;
  /**
   * Une seule ligne au lieu d'un encart.
   *
   * Sur l'écran où le créateur remplit trois tarifs d'affilée, trois encarts
   * complets noieraient les champs qu'ils sont censés aider à remplir. La
   * version compacte donne le chiffre et rien d'autre — le détail et les
   * sources ont leur place là où il n'y a qu'un montant à décider.
   */
  compact?: boolean;
}) {
  if (compact) {
    if (reperes.origine === "collabbs") {
      const { n, median } = reperes.stats;
      return (
        <p className="mt-2 text-xs text-zinc-500">
          Médiane sur Collabbs :{" "}
          <strong className="tabular-nums text-zinc-700">{median} €</strong>{" "}
          <span className="text-zinc-400">({n} tarifs affichés)</span>
        </p>
      );
    }
    return (
      <p className="mt-2 text-xs text-zinc-400">
        Pas encore assez de tarifs sur Collabbs pour ce format. Ailleurs, une
        vidéo UGC va de 28 € à 99 € selon le montage et les droits inclus.
      </p>
    );
  }

  if (reperes.origine === "collabbs") {
    const { n, q1, median, q3 } = reperes.stats;
    return (
      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ce qui se pratique sur Collabbs
        </p>
        <p className="mt-2 text-2xl font-black tabular-nums text-ink">
          {median} €
          <span className="ml-2 align-middle text-sm font-medium text-zinc-500">
            médiane
          </span>
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          La moitié des créateurs demandent entre{" "}
          <strong className="tabular-nums">{q1} €</strong> et{" "}
          <strong className="tabular-nums">{q3} €</strong>.
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          Calculé sur {n} tarifs affichés. Médiane et non moyenne : un tarif
          exceptionnel ne doit pas déplacer le repère.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Repères du marché
      </p>
      <p className="mt-1.5 text-sm text-zinc-600">
        {phraseObservations(reperes.observations)} En attendant, voici ce que
        d&apos;autres plateformes affichent publiquement — ce ne sont pas nos
        chiffres, et ils ne s&apos;accordent pas entre eux.
      </p>
      <ul className="mt-3 space-y-2.5">
        {reperes.reperes.map((r) => (
          <li key={r.url + r.libelle} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold tabular-nums text-ink">{r.valeur}</span>
            <span className="text-sm text-zinc-600">{r.libelle}</span>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600"
            >
              {r.source}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-400">
        L&apos;écart entre ces chiffres n&apos;est pas du bruit : une vidéo brute
        commandée en volume et une production livrée montée avec les droits ne
        se paient pas pareil.
      </p>
    </div>
  );
}
