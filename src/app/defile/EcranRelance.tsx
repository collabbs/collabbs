"use client";

import Link from "next/link";

/**
 * L'interruption au 5ᵉ intérêt — le moment où l'on demande le compte.
 *
 * ─── Pourquoi là, et pas à la fin ───
 * Le compte n'était proposé qu'après un match, ou quand le paquet était vide.
 * Quelqu'un qui retenait six campagnes puis refermait n'était jamais sollicité
 * — alors qu'il venait de faire exactement ce qu'on espérait. On demandait au
 * moment de la lassitude, pas au moment du désir.
 *
 * ─── Pourquoi pas un « match » ───
 * Il a été question d'en simuler un. Annoncer un match quand aucune marque n'a
 * marqué d'intérêt, c'est promettre une réponse qui ne viendra pas — et le
 * créateur le découvre au silence qui suit. On garde l'interruption, sa force
 * et son moment ; on change seulement la phrase pour une qui est vraie.
 *
 * Ce qu'on dit est plus fort, d'ailleurs : le compte n'est pas une formalité,
 * c'est ce qui empêche de perdre ce qu'on vient de retenir.
 */
export default function EcranRelance({
  nombre,
  cote,
  onContinuer,
}: {
  nombre: number;
  cote: "createur" | "marque";
  onContinuer: () => void;
}) {
  const estCreateur = cote === "createur";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 55% at 50% 18%, rgba(168,85,247,.55) 0%, rgba(236,72,153,.18) 45%, transparent 74%)",
        }}
      />

      <div className="relative">
        <p className="font-display text-[72px] font-black leading-none tabular-nums tracking-tight text-white">
          {nombre}
        </p>
        <h2 className="font-display mt-3 text-[26px] font-black leading-[1.15] tracking-tight text-white">
          {estCreateur
            ? nombre > 1
              ? "campagnes retenues."
              : "campagne retenue."
            : nombre > 1
              ? "créateurs repérés."
              : "créateur repéré."}
        </h2>

        <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-white/70">
          {estCreateur
            ? "Crée ton profil pour les garder — et pour que ces marques puissent te trouver."
            : "Crée ton compte pour les garder — et leur envoyer ton brief."}
        </p>

        <Link
          href={estCreateur ? "/signup?role=creator" : "/signup?role=brand"}
          className="mt-8 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white transition hover:opacity-90"
        >
          {estCreateur ? "Créer mon profil" : "Créer mon compte"}
        </Link>

        {/* On ne bloque pas. Quelqu'un qui veut continuer à regarder le fera —
            l'interrompre deux fois le ferait partir pour de bon. */}
        <button
          type="button"
          onClick={onContinuer}
          className="mt-4 text-[14px] font-medium text-white/50 underline underline-offset-4 transition hover:text-white/80"
        >
          Continuer à regarder
        </button>
      </div>
    </div>
  );
}
