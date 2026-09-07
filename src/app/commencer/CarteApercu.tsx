"use client";

import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_BY_ID } from "@/components/landing/creators";
import { libelleTranche, type CarteCreateur } from "@/lib/quiz";

/**
 * La carte du créateur, telle qu'une marque la verra.
 *
 * ─── Le problème qu'elle doit résoudre ───
 * Le questionnaire ne demande pas de photo — téléverser une image avant
 * d'avoir un compte, sur téléphone, c'est le moment où l'on abandonne. Mais
 * une carte sans photo, c'est un rectangle dégradé avec un pseudo dessus :
 * ça ressemble à une image manquante, et ça donne l'impression d'un produit
 * bâclé.
 *
 * ─── La réponse ───
 * Ne pas imiter une photo absente : assumer un objet TYPOGRAPHIQUE. Le pseudo
 * devient le sujet de la carte, en très grand, sur un fond dont la teinte est
 * dérivée du pseudo lui-même — deux créateurs différents n'ont donc pas la
 * même carte. Et l'emplacement de la photo est marqué comme ce qu'il est : une
 * chose à ajouter, avec ce qu'elle apporte, plutôt qu'un trou.
 */

/**
 * Teinte dérivée du pseudo.
 *
 * Déterministe à dessein : la carte de quelqu'un ne change pas de couleur d'un
 * chargement à l'autre. Une couleur aléatoire donnerait l'impression que rien
 * n'est décidé.
 */
function teinte(graine: string): { de: string; vers: string } {
  let somme = 0;
  for (let i = 0; i < graine.length; i++) somme = (somme * 31 + graine.charCodeAt(i)) % 360;
  const h = somme;
  return {
    de: `hsl(${h} 72% 32%)`,
    vers: `hsl(${(h + 42) % 360} 78% 46%)`,
  };
}

export default function CarteApercu({ carte }: { carte: CarteCreateur }) {
  const palier = libelleTranche(carte.audience);
  const offres = carte.offres.map((id) => OFFER_BY_ID[id]).filter(Boolean);
  // Le plus bas des tarifs saisis. Les formats à la commission n'en ont pas,
  // et c'est normal : ils ne se facturent pas au forfait.
  const tarifs = Object.values(carte.prix).filter(
    (p): p is number => typeof p === "number" && p > 0,
  );
  const prixMini = tarifs.length > 0 ? Math.min(...tarifs) : null;
  const pseudo = carte.handle ?? "ton.pseudo";
  const { de, vers } = teinte(pseudo);

  return (
    <div className="w-full overflow-hidden rounded-[26px] bg-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,.06),0_28px_56px_-30px_rgba(0,0,0,.6)]">
      <div
        className="relative aspect-[4/5] overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${de}, ${vers})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_8%,rgba(255,255,255,.32),transparent_58%)]" />

        {/* Bandeau du haut : réseau et palier d'audience. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          {carte.plateforme ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <PlatformIcon slug={carte.plateforme} className="h-3.5 w-3.5" />
              {palier ?? "—"}
            </span>
          ) : (
            <span />
          )}
          {prixMini !== null && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black tabular-nums text-zinc-900">
              dès {prixMini.toLocaleString("fr-FR")} €
            </span>
          )}
        </div>

        {/* Le pseudo EST le visuel. En très grand, coupé sur plusieurs lignes
            s'il le faut : c'est ce qui donne à la carte l'air d'un objet
            dessiné plutôt que d'une image qui n'a pas chargé. */}
        <div className="absolute inset-x-0 bottom-0 p-5 pt-16">
          <p className="font-display text-[34px] font-black leading-[0.92] tracking-tighter text-white [overflow-wrap:anywhere]">
            @{pseudo}
          </p>
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex flex-wrap gap-1.5">
          {carte.niches.length > 0 ? (
            carte.niches.map((n) => (
              <span
                key={n}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                {n}
              </span>
            ))
          ) : (
            <span className="rounded-full border border-dashed border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/30">
              ta niche
            </span>
          )}
        </div>

        {/* Chaque offre porte SON prix. Un tarif unique ne disait pas ce qu'il
            couvrait ; là, une marque sait ce que coûte exactement ce qu'elle
            veut. Les formats à la commission affichent « % ventes » plutôt
            qu'un montant qui n'existe pas. */}
        <div className="space-y-1">
          {offres.length > 0 ? (
            offres.map((o) => {
              const prix = carte.prix[o.id as keyof typeof carte.prix];
              return (
                <div
                  key={o.id}
                  className="flex items-baseline justify-between gap-3 rounded-lg bg-white/10 px-2.5 py-1.5"
                >
                  <span className="text-[12px] font-medium text-white/85">
                    {o.emoji} {o.short}
                  </span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-white">
                    {typeof prix === "number"
                      ? `${prix.toLocaleString("fr-FR")} €`
                      : "% ventes"}
                  </span>
                </div>
              );
            })
          ) : (
            <span className="inline-block rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-[11px] font-medium text-white/30">
              ce que tu proposes
            </span>
          )}
        </div>

        {/* L'absence de photo est nommée — un manque expliqué se comble, un
            trou se subit — mais en une ligne : trois lignes de gris en bas de
            carte pesaient plus que l'information qu'elles portaient. */}
        <p className="pt-0.5 text-[11px] text-white/35">
          📷 Ta photo manque — c&apos;est elle qui fait s&apos;arrêter une marque.
        </p>
      </div>
    </div>
  );
}
