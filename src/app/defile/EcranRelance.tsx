"use client";

import Link from "next/link";
import { photoDuBrief, remunerationLisible } from "./CarteBrief";
import type { BriefDefile } from "@/lib/defile";
import { assombrir, eclaircir } from "@/lib/teinte";

/**
 * L'interruption au 5ᵉ intérêt — le moment où l'on demande le compte.
 *
 * ─── Pourquoi là, et pas à la fin ───
 * Le compte n'était proposé qu'après un match, ou une fois le paquet vide.
 * Quelqu'un qui retenait six campagnes puis refermait n'était jamais sollicité
 * — alors qu'il venait de faire exactement ce qu'on espérait. On demandait au
 * moment de la lassitude, pas au moment de l'envie.
 *
 * ─── Pourquoi montrer les cartes, et pas un compteur ───
 * Première version : un gros chiffre sur un dégradé. Ça ne pesait rien —
 * « 5 » est une abstraction, on ne perd pas un nombre. On perd des CAMPAGNES,
 * avec leurs photos, leurs marques et leurs montants.
 *
 * On les remet donc sous les yeux, en éventail, avec le total de ce qu'elles
 * proposent. Le total est le vrai argument : il est calculé, pas promis, et il
 * dit en un chiffre ce que représente le geste qu'on vient de faire.
 *
 * ─── Pourquoi pas un « match » ───
 * Il a été question d'en simuler un. Annoncer un match quand aucune marque n'a
 * marqué d'intérêt, c'est promettre une réponse qui ne viendra pas — et le
 * créateur le découvre au silence qui suit. On garde l'interruption et sa
 * force ; on ne fabrique pas une réciprocité qui n'existe pas.
 */
export default function EcranRelance({
  retenus,
  cote,
  onContinuer,
}: {
  /** Ce qui a été retenu, dans l'ordre. Vide côté marque. */
  retenus: BriefDefile[];
  nombre: number;
  cote: "createur" | "marque";
  onContinuer: () => void;
}) {
  const estCreateur = cote === "createur";
  const nombre = retenus.length;

  // Le total de ce que ces campagnes proposent. On additionne les forfaits :
  // une commission dépend des ventes, l'annoncer comme un gain serait inventer.
  const total = retenus.reduce((somme, b) => somme + (b.montant ?? 0), 0);
  const enEventail = retenus.slice(-3).reverse();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(85% 55% at 50% 12%, rgba(168,85,247,.5) 0%, rgba(236,72,153,.16) 45%, transparent 74%)",
        }}
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        {/* ═══ CE QU'ON PERD, EN ÉVENTAIL ═══
            Les trois dernières retenues, empilées comme un jeu de cartes qu'on
            tient en main. C'est ce qui rend la perte concrète. */}
        {enEventail.length > 0 && (
          <div className="relative mb-7 h-[190px] w-[150px]">
            {enEventail.map((b, i) => {
              const photo = photoDuBrief(b);
              const base = b.couleurMarque ?? "#1b1b21";
              const r = remunerationLisible(b);
              const angle = (i - 1) * 11;
              return (
                <div
                  key={b.id}
                  className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_44px_-16px_rgba(0,0,0,.9)]"
                  style={{
                    transform: `rotate(${angle}deg) translateY(${Math.abs(i - 1) * 6}px)`,
                    zIndex: 3 - i,
                    backgroundColor: assombrir(base, 0.3),
                    backgroundImage: photo
                      ? `url("${photo}")`
                      : `radial-gradient(90% 65% at 30% 15%, ${eclaircir(base, 0.4)} 0%, ${assombrir(base, 0.5)} 75%)`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
                  <p className="font-display absolute bottom-2 left-2.5 right-2 truncate text-left text-[15px] font-black text-white">
                    {r?.gros ?? b.marque}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Le total : calculé, pas promis. */}
        {estCreateur && total > 0 ? (
          <>
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/50">
              Ce que tu as retenu
            </p>
            <p className="font-display mt-2 text-[58px] font-black leading-none tabular-nums tracking-tight text-white">
              {total.toLocaleString("fr-FR")} €
            </p>
            <p className="mt-1 text-[14px] font-semibold text-white/60">
              sur {nombre} campagne{nombre > 1 ? "s" : ""}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[58px] font-black leading-none tabular-nums text-white">
              {nombre}
            </p>
            <p className="mt-1 text-[16px] font-bold text-white/80">
              {estCreateur
                ? `campagne${nombre > 1 ? "s" : ""} retenue${nombre > 1 ? "s" : ""}`
                : `créateur${nombre > 1 ? "s" : ""} repéré${nombre > 1 ? "s" : ""}`}
            </p>
          </>
        )}

        <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/70">
          {estCreateur
            ? "Tout ça disparaît si tu fermes. Crée ton profil pour le garder — et pour que ces marques puissent te trouver."
            : "Tout ça disparaît si tu fermes. Crée ton compte pour garder ta sélection et leur envoyer ton brief."}
        </p>

        <Link
          href={estCreateur ? "/signup?role=creator" : "/signup?role=brand"}
          className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white shadow-[0_14px_40px_-12px_rgba(168,85,247,.9)] transition hover:opacity-90"
        >
          {estCreateur ? "Garder mes campagnes" : "Garder ma sélection"}
        </Link>

        {/* On ne bloque pas. Interrompre deux fois ferait partir pour de bon. */}
        <button
          type="button"
          onClick={onContinuer}
          className="mt-4 text-[14px] font-medium text-white/45 underline underline-offset-4 transition hover:text-white/80"
        >
          Continuer à regarder
        </button>
      </div>
    </div>
  );
}
