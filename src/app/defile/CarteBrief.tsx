"use client";

import { useEffect, useRef, useState } from "react";
import type { BriefDefile } from "@/lib/defile";
import { assombrir, eclaircir, encreLisible, versRvb } from "@/lib/teinte";

/**
 * Une carte du défilé — pleine hauteur, qu'on attrape et qu'on jette.
 *
 * ─── Ce qui change par rapport à la première version ───
 * Elle occupe tout l'écran. Une vignette avec des boutons rectangulaires en
 * dessous, c'est une liste déguisée : on lit, on compare, on hésite. Une carte
 * pleine hauteur ne laisse qu'une chose à faire — trancher — et c'est de là
 * que vient le rythme.
 *
 * ─── Pourquoi les évènements « pointeur » ───
 * `pointerdown/move/up` couvrent le doigt, la souris et le stylet avec le même
 * code. Deux chemins séparés finiraient par diverger.
 *
 * ─── Les trois pièges du glissement ───
 * 1. `touch-action: none` : sans lui le navigateur prend le mouvement pour un
 *    défilement de page et la carte reste collée pendant que l'écran bouge.
 * 2. `setPointerCapture` : le geste continue quand le doigt sort de la carte.
 * 3. Aucune transition PENDANT le glissement, sinon la carte suit le doigt
 *    avec du retard. Elle ne s'anime qu'au relâchement.
 */

const SEUIL = 100;

/** `#rrggbb` + opacité → `rgba(...)`, pour composer des voiles teintés. */
function rgba(couleur: string, opacite: number): string {
  const c = versRvb(couleur) ?? [0, 0, 0];
  return `rgba(${c[0]},${c[1]},${c[2]},${opacite})`;
}

export type Direction = "gauche" | "droite";

export function remunerationLisible(brief: BriefDefile) {
  const c = brief.commission;
  const taux = c ? (c.min === c.max ? `${c.min} %` : `${c.min}–${c.max} %`) : null;
  if (brief.montant !== null && taux) {
    return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: `+ ${taux} sur les ventes` };
  }
  if (brief.montant !== null) {
    return { gros: `${brief.montant.toLocaleString("fr-FR")} €`, petit: "par créateur" };
  }
  if (taux) return { gros: taux, petit: "de commission" };
  return null;
}

/**
 * La pastille de marque : son logo, ou son initiale.
 *
 * ─── Pourquoi mesurer ───
 * Le service de logos annonce 256 px mais rend ce qu'il a. Pour Sephora, c'est
 * une icône de 16 px — étirée à 44, elle devient une tache floue, et rien ne
 * dit « bâclé » aussi vite qu'un logo flou sur une carte qu'on veut premium.
 *
 * La taille réelle ne se connaît qu'une fois l'image chargée. On la charge
 * donc à part pour la mesurer, et on retombe sur l'initiale quand elle est
 * trop petite : une lettre nette vaut mieux qu'un logo sale.
 */
function Pastille({
  logo,
  marque,
  encre,
}: {
  logo: string | null;
  marque: string;
  encre: string;
}) {
  // On retient l'adresse ÉCARTÉE, pas un booléen : un booléen devrait être
  // remis à vrai à chaque changement de logo, donc modifié depuis l'effet —
  // ce qui déclenche un rendu en cascade. Comparer deux adresses se lit sans
  // état intermédiaire, et une carte qui change de marque repart juste.
  const [ecarte, setEcarte] = useState<string | null>(null);
  const utilisable = logo !== null && logo !== ecarte;

  useEffect(() => {
    if (!logo) return;
    const img = new window.Image();
    // 64 px : il en faut le double des 44 px affichés pour rester net sur un
    // écran à haute densité, ce qu'est tout téléphone.
    img.onload = () => {
      if (img.naturalWidth < 64) setEcarte(logo);
    };
    img.onerror = () => setEcarte(logo);
    img.src = logo;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [logo]);

  if (logo && utilisable) {
    return (
      <span
        className="h-11 w-11 shrink-0 rounded-xl bg-white bg-contain bg-center bg-no-repeat shadow-[0_4px_16px_-4px_rgba(0,0,0,.6)]"
        style={{ backgroundImage: `url("${logo}")` }}
      />
    );
  }

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-black backdrop-blur"
      style={{ background: rgba(encre, 0.2), color: encre }}
    >
      {marque.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function CarteBrief({
  brief,
  onDecision,
  onOuvrir,
  sortirVers,
  /** Carte du dessous : visible mais inerte, elle donne l'épaisseur du paquet. */
  enArriere,
}: {
  brief: BriefDefile;
  onDecision?: (d: Direction) => void;
  /** Pression simple, sans glissement : on ouvre la fiche détaillée. */
  onOuvrir?: () => void;
  /**
   * Sortie commandée de l'extérieur, par les boutons ♥ et ✕.
   *
   * Sans ça, les boutons faisaient avancer la pile SANS que la carte parte :
   * elle disparaissait d'un coup et on ne voyait pas de quel côté. Le geste
   * animait, le bouton non — deux comportements pour une même décision.
   */
  sortirVers?: Direction | null;
  enArriere?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [glisse, setGlisse] = useState(false);
  const [sortie, setSortie] = useState<Direction | null>(null);
  const depart = useRef(0);
  // Distingue une PRESSION d'un GLISSEMENT : sans ça, ouvrir la fiche au
  // toucher déclencherait aussi une décision, et inversement.
  const aBouge = useRef(false);

  const sortieEffective = sortie ?? sortirVers ?? null;
  const inerte = enArriere || sortieEffective !== null;

  function commencer(e: React.PointerEvent) {
    if (inerte || !onDecision) return;
    depart.current = e.clientX;
    aBouge.current = false;
    setGlisse(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : le geste marche quand même */
    }
  }

  function bouger(e: React.PointerEvent) {
    if (!glisse) return;
    const ecart = e.clientX - depart.current;
    // 6 px de tolérance : un doigt n'est jamais parfaitement immobile, et sans
    // cette marge une pression normale passerait pour un micro-glissement.
    if (Math.abs(ecart) > 6) aBouge.current = true;
    setDx(ecart);
  }

  function relacher() {
    if (!glisse) return;
    setGlisse(false);
    if (!aBouge.current) {
      setDx(0);
      onOuvrir?.();
      return;
    }
    if (Math.abs(dx) >= SEUIL) {
      const dir: Direction = dx > 0 ? "droite" : "gauche";
      setSortie(dir);
      window.setTimeout(() => onDecision?.(dir), 240);
    } else {
      setDx(0);
    }
  }

  const rotation = Math.max(-16, Math.min(16, dx / 14));
  const intensite = Math.min(1, Math.abs(dx) / SEUIL);
  const remuneration = remunerationLisible(brief);
  // Une photo par campagne, toujours la même : on tire dans la liste à partir
  // de l'identifiant plutôt qu'au hasard. Une carte qui change d'image d'un
  // chargement à l'autre donne l'impression que rien n'est décidé.
  const photo =
    brief.photos.length > 0
      ? brief.photos[
          [...brief.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) %
            brief.photos.length
        ]
      : null;

  /* ─── La palette de CETTE marque ───
     Tout ce qui suit se calcule à partir d'une seule couleur reçue : le fond,
     la lueur, l'assombrissement et l'encre. Rien n'est fixé en dur, sinon la
     carte irait bien avec une marque et mal avec les vingt autres. */
  const base = brief.couleurMarque ?? "#1b1b21";
  const clair = eclaircir(base, 0.36);
  const sombre = assombrir(base, 0.62);
  // Sur une photo, le blanc s'impose : on ne sait pas ce qu'elle contient.
  // Sur un aplat, l'encre se déduit de la luminance — une marque au jaune vif
  // aurait rendu le texte blanc illisible.
  const encre = photo ? "#ffffff" : encreLisible(sombre);
  const attenue = (o: number) => rgba(encre, o);
  // Deux encres, pas une : le bas de la carte est assombri, le haut non. Sur
  // une marque claire — le vert de Leroy Merlin — le blanc tenait en bas et
  // devenait illisible en haut. L'encre se décide donc pour chaque zone, sur
  // le fond qu'elle a réellement sous elle.
  const encreHaut = photo ? "#ffffff" : encreLisible(base);

  // Le montant est le sujet de la carte sans photo : il occupe la place que
  // l'image occupait. Mais « 12 000 € » et « 400 € » n'ont pas la même
  // longueur — une taille fixe déborderait ou flotterait.
  const tailleMontant = (() => {
    if (photo) return 62;
    const n = remuneration?.gros.length ?? 0;
    return n > 7 ? 64 : n > 5 ? 78 : 92;
  })();

  const transform = sortieEffective
    ? `translateX(${sortieEffective === "droite" ? 900 : -900}px) rotate(${sortieEffective === "droite" ? 26 : -26}deg)`
    : enArriere
      ? "scale(0.95) translateY(10px)"
      : `translateX(${dx}px) rotate(${rotation}deg)`;

  return (
    <div
      onPointerDown={commencer}
      onPointerMove={bouger}
      onPointerUp={relacher}
      onPointerCancel={relacher}
      style={{
        transform,
        transition: glisse ? "none" : "transform .24s cubic-bezier(.22,.61,.36,1), opacity .2s",
        touchAction: "none",
        opacity: sortieEffective ? 0 : 1,
      }}
      className={`absolute inset-0 select-none overflow-hidden rounded-[28px] shadow-[0_20px_60px_-24px_rgba(0,0,0,.55)] ${
        enArriere ? "pointer-events-none" : ""
      } ${inerte ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* ═══ LA PHOTO D'ABORD ═══

          Toutes mes tentatives précédentes arrangeaient du TEXTE sur un
          rectangle : dégradé, ticket, encoches, typographie. Aucune ne pouvait
          accrocher l'œil, parce qu'il n'y avait rien à regarder — ni humain,
          ni matière, ni produit.

          Les boutiques Shopify publient leurs fiches produit ouvertement
          (`/products.json`). On y trouve de vraies photos : des gens qui
          portent le vêtement, tiennent l'objet. C'est ça qui fait s'arrêter
          dans un fil, pas une mise en page.

          La photo occupe donc TOUTE la carte. Le reste — logo, montant,
          mission — se pose dessus, sur un voile. Quand aucune photo n'existe,
          on retombe sur le traitement graphique, qui redevient ce qu'il aurait
          toujours dû être : un repli, pas une ambition. */}
      {photo ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${photo}")` }}
          />
          {/* Deux voiles : un léger partout pour que le blanc tienne, un franc
              en bas où vit le texte. */}
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        </>
      ) : (
        <>
          {/* ═══ QUAND IL N'Y A PAS DE PHOTO ═══

              Avant : `bg-ink` et une lueur violet/rose. Une couleur inventée,
              la MÊME pour Decathlon et pour Sephora — donc un fond par défaut,
              et ça se voit. C'est ce que Julien a signalé : « ça va pas du
              tout ».

              Ces deux sites répondent 403 à tout accès automatisé, y compris
              en se présentant comme un navigateur. Aucune photo n'en sortira
              jamais. Mais leur LOGO reste joignable, et un logo contient la
              couleur de la marque : on la lit dans ses pixels
              (`couleurDominante`). Decathlon redevient bleu, Leroy Merlin
              vert, et Sephora reste noir — parce que Sephora EST noir.

              Le fond est donc un aplat de cette couleur, éclairé en haut et
              assombri en bas dans SA propre teinte. Plus de voile noir : il
              transformait chaque marque en la même bouillie grise. */}
          <div className="absolute inset-0" style={{ background: base }} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 80% at 22% 10%, ${rgba(clair, 0.9)} 0%, ${rgba(clair, 0)} 62%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[68%]"
            style={{
              background: `linear-gradient(to top, ${rgba(sombre, 0.96)} 0%, ${rgba(sombre, 0.6)} 38%, ${rgba(sombre, 0)} 100%)`,
            }}
          />
        </>
      )}

      {/* Tampons de décision : ils disent ce qui va se passer AVANT de lâcher.
          Supprimés par accident en réécrivant le fond — sans eux le geste perd
          son retour, et on lâche sans savoir de quel côté on va. */}
      {!enArriere && (
        <>
          <span
            style={{ opacity: dx > 0 ? intensite : 0 }}
            className="pointer-events-none absolute left-6 top-8 z-20 -rotate-[14deg] rounded-2xl border-4 border-emerald-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-emerald-400"
          >
            Intéressé
          </span>
          <span
            style={{ opacity: dx < 0 ? intensite : 0 }}
            className="pointer-events-none absolute right-6 top-8 z-20 rotate-[14deg] rounded-2xl border-4 border-rose-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-rose-400"
          >
            Passer
          </span>
        </>
      )}

      {/* Voile bas — seulement sous une photo : elle peut être claire là où le
          texte se pose. La carte colorée a déjà son propre assombrissement,
          dans sa teinte ; lui superposer du noir la ternissait. */}
      {photo && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" />
      )}

      {/* ─── UNE AFFICHE, PAS UNE FICHE ───

          Le défilé n'est pas qu'une fonctionnalité : c'est ce qui se filme et
          se capture pour faire venir du monde. Une carte couverte de texte ne
          se partage pas.

          Tout ce qui se lit a donc été retiré : la description, le nombre de
          places, l'audience minimale, l'invitation à toucher. Ça n'est pas
          perdu — c'est dans la fiche, qui s'ouvre d'une pression, et qui
          existe précisément pour que la carte n'ait pas à tout porter.

          Il ne reste que ce qui se voit en une seconde : QUI, COMBIEN, QUOI. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
        {/* Le logo en haut, petit : il identifie, il n'occupe plus la carte. */}
        <div className="flex items-center gap-2.5">
          <Pastille logo={brief.image} marque={brief.marque} encre={encreHaut} />
          <span
            className="font-display truncate text-[18px] font-black tracking-tight"
            style={{
              color: encreHaut,
              textShadow: photo ? "0 2px 10px rgba(0,0,0,.6)" : "none",
            }}
          >
            {brief.marque}
          </span>
          {brief.dejaInteressee && (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
              T&apos;a repéré
            </span>
          )}
        </div>

        {/* Ce qu'on gagne. Sur une carte sans photo, c'est LE sujet : le
            montant prend la place que l'image aurait prise, précédé d'une
            règle et d'un mot qui en font une offre plutôt qu'un nombre. */}
        <div>
          {!photo && (
            <>
              <div className="h-px w-14" style={{ background: attenue(0.45) }} />
              <p
                className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: attenue(0.6) }}
              >
                Tu gagnes
              </p>
            </>
          )}

          {remuneration ? (
            <>
              <p
                className="font-display font-black leading-[0.85] tracking-[-0.05em] [overflow-wrap:anywhere]"
                style={{
                  fontSize: `${tailleMontant}px`,
                  color: encre,
                  textShadow: photo ? "0 4px 24px rgba(0,0,0,.7)" : "none",
                }}
              >
                {remuneration.gros}
              </p>
              <p className="mt-1 text-[14px] font-bold" style={{ color: attenue(0.75) }}>
                {remuneration.petit}
              </p>
            </>
          ) : (
            <p
              className="font-display text-[38px] font-black leading-none tracking-tight"
              style={{ color: attenue(0.8) }}
            >
              À négocier
            </p>
          )}

          {brief.titre && (
            <p
              className="mt-3 line-clamp-2 text-[16px] font-semibold leading-snug"
              style={{ color: attenue(0.9) }}
            >
              {brief.titre}
            </p>
          )}

          {brief.niches.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {brief.niches.slice(0, 3).map((n) => (
                <span
                  key={n}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur"
                  style={{ background: attenue(0.18), color: encre }}
                >
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
