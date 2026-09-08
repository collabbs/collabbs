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
 * avec leurs photos et leurs marques. On les remet donc sous les yeux.
 *
 * ─── Pourquoi PAS le total des montants ───
 * Deuxième version : la somme de ce que ces campagnes proposent, en grand.
 * Elle était fausse dans ce qu'elle laissait entendre. Ces campagnes n'ont
 * rien accordé à personne : le créateur les a simplement retenues. Afficher
 * « 1 180 € » comme un acquis, c'est le même mensonge que le match simulé,
 * en plus discret — et il se paie de la même façon, à la déception.
 *
 * ─── Ce qui est vrai, et cohérent avec ce qu'il vient de faire ───
 * Troisième version : « ces marques ne peuvent pas te voir tant que tu n'as
 * pas de profil ». Faux aussi, d'une autre façon — il VIENT de créer sa carte
 * au questionnaire. Lui dire qu'il n'a pas de profil nie son travail.
 *
 * Le vrai état des choses : sa carte existe, mais seulement dans son
 * navigateur. Le compte n'est pas une inscription, c'est la PUBLICATION de ce
 * qu'il a déjà fait. C'est vrai, ça respecte son geste, et ça donne au bouton
 * un sens : « publier ma carte », pas « créer un compte ».
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

        <p className="font-display text-[58px] font-black leading-none tabular-nums text-white">
          {nombre}
        </p>
        <p className="mt-1 text-[16px] font-bold text-white/80">
          {estCreateur
            ? `campagne${nombre > 1 ? "s" : ""} retenue${nombre > 1 ? "s" : ""}`
            : `créateur${nombre > 1 ? "s" : ""} repéré${nombre > 1 ? "s" : ""}`}
        </p>

        <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/70">
          {estCreateur
            ? "Ta carte n'existe que dans ce navigateur. Publie-la pour que ces marques puissent te répondre."
            : "Ton brief n'existe que dans ce navigateur. Publie-le pour que ces créateurs puissent y répondre."}
        </p>

        <Link
          href={estCreateur ? "/signup?role=creator" : "/signup?role=brand"}
          className="mt-7 flex min-h-[58px] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 text-base font-bold text-white shadow-[0_14px_40px_-12px_rgba(168,85,247,.9)] transition hover:opacity-90"
        >
          {estCreateur ? "Publier ma carte" : "Publier mon brief"}
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
