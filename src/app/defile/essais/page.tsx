import type { Metadata } from "next";
import { briefsDuDefile } from "@/lib/defile";
import CarteBrief from "../CarteBrief";
import { Editorial, Aplat, ChiffrePlein, Scindee, Vitrine } from "./Variantes";

/**
 * Cinq directions artistiques, sur la même campagne, pour choisir en regardant.
 *
 * Page de travail : elle n'a rien à faire dans l'index des moteurs, et elle
 * disparaîtra une fois la direction retenue.
 */
export const metadata: Metadata = {
  title: "Essais de direction artistique — Collabbs",
  robots: { index: false, follow: false },
};

const PROPOSITIONS = [
  {
    n: "01",
    nom: "Éditorial",
    idee: "Papier blanc, encre noire, une règle. Ce qui fait premium n'est pas la profondeur mais la retenue.",
    Rendu: Editorial,
  },
  {
    n: "02",
    nom: "Aplat saturé",
    idee: "Une seule couleur franche. Elle ne cherche pas la finesse, elle cherche l'arrêt dans un fil.",
    Rendu: Aplat,
  },
  {
    n: "03",
    nom: "Chiffre plein",
    idee: "Le montant EST la carte : il déborde, il est coupé. La plus lisible à petite taille.",
    Rendu: ChiffrePlein,
  },
  {
    n: "04",
    nom: "Scindée",
    idee: "La marque en haut sur sa couleur, l'offre en bas sur du blanc. Qui propose, ce qu'on gagne.",
    Rendu: Scindee,
  },
  {
    n: "05",
    nom: "Vitrine",
    idee: "Le logo occupe presque tout. Met la marque au premier plan plutôt que l'argent.",
    Rendu: Vitrine,
  },
];

export default async function PageEssais() {
  const briefs = await briefsDuDefile();
  // On prend une campagne qui a un logo : c'est le cas qui départage vraiment
  // les propositions. Sans logo, elles se ressemblent toutes.
  const brief = briefs.find((b) => b.image) ?? briefs[0];

  if (!brief) {
    return (
      <main className="p-8 text-sm text-zinc-500">
        Aucune campagne ouverte — rien à mettre en page.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <h1 className="font-display text-[26px] font-black leading-tight tracking-tight text-ink">
        Cinq directions, une seule campagne
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">
        Le même contenu traité cinq fois. Dis-moi le numéro qui te parle — ou ce
        que tu prendrais dans l&apos;une et dans l&apos;autre.
      </p>

      <section className="mt-10">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] font-bold text-zinc-300">00</span>
          <h2 className="font-display text-[17px] font-black tracking-tight text-ink">
            L&apos;actuelle
          </h2>
        </div>
        <p className="mb-4 mt-1 text-[13px] leading-snug text-zinc-500">
          Le ticket sombre, pour comparer.
        </p>
        <div className="relative aspect-[3/4] w-full">
          <CarteBrief brief={brief} />
        </div>
      </section>

      {PROPOSITIONS.map(({ n, nom, idee, Rendu }) => (
        <section key={n} className="mt-12">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] font-bold text-zinc-300">{n}</span>
            <h2 className="font-display text-[17px] font-black tracking-tight text-ink">{nom}</h2>
          </div>
          <p className="mb-4 mt-1 text-[13px] leading-snug text-zinc-500">{idee}</p>
          <Rendu brief={brief} />
        </section>
      ))}
    </main>
  );
}
