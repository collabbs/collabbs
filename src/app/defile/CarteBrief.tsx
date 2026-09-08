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
 * Le logo est-il assez défini pour être affiché ?
 *
 * ─── Pourquoi une mesure ───
 * Le service de logos annonce 256 px mais rend ce qu'il a. Pour Sephora, c'est
 * une icône de 16 px — étirée, elle devient une tache, et rien ne dit
 * « bâclé » aussi vite qu'un logo flou sur une carte qu'on veut premium.
 *
 * La taille réelle ne se connaît qu'une fois l'image chargée : on la charge
 * donc à part pour la mesurer. La réponse sert deux fois — la pastille du haut
 * et le grand signe du fond — d'où un crochet plutôt qu'un état local.
 */
function useLogoNet(logo: string | null): boolean {
  // On retient l'adresse ÉCARTÉE, pas un booléen : un booléen devrait être
  // remis à vrai à chaque changement de logo, donc modifié depuis l'effet —
  // ce qui déclenche un rendu en cascade. Comparer deux adresses se lit sans
  // état intermédiaire, et une carte qui change de marque repart juste.
  const [ecarte, setEcarte] = useState<string | null>(null);

  useEffect(() => {
    if (!logo) return;
    const img = new window.Image();
    // 32 px, et pas 44.
    //
    // Le seuil a baissé deux fois, chaque fois pour la même raison : il
    // jetait des logos parfaitement montrables. À 64 px il écartait Leroy
    // Merlin (48 px) ; à 44 px il écartait Loom et Respire, qui ne publient
    // que du 32 px — partout, y compris chez le service de domaines.
    //
    // Un logo de 32 px affiché à 44 est légèrement doux. Une lettre, elle, ne
    // dit rien de la marque. Pour une pastille de reconnaissance, être reconnu
    // vaut mieux qu'être parfaitement net.
    //
    // En dessous de 32 px on s'arrête : 16 px agrandis presque trois fois font
    // une tache, et là c'est la lettre qui est la meilleure carte.
    img.onload = () => {
      if (img.naturalWidth < 32) setEcarte(logo);
    };
    img.onerror = () => setEcarte(logo);
    img.src = logo;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [logo]);

  return logo !== null && logo !== ecarte;
}

/** La pastille d'identification, en haut : le logo, ou l'initiale à défaut. */
function Pastille({
  logo,
  net,
  marque,
  encre,
}: {
  logo: string | null;
  net: boolean;
  marque: string;
  encre: string;
}) {
  if (logo && net) {
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

/**
 * Le grand signe du fond — ce qui remplace la photo au lieu de laisser un vide.
 *
 * ─── Ce qui n'allait pas ───
 * La carte sans photo gardait la mise en page de la carte AVEC photo : tout en
 * bas, et un grand vide au-dessus. C'est le vide qu'on voyait, pas la couleur.
 * Une carte photo à qui il manque la photo ne peut pas être belle ; il fallait
 * qu'elle cesse d'en être une et devienne une affiche.
 *
 * ─── Le parti ───
 * Le signe est ÉNORME et COUPÉ par le bord. Un logo entier posé au milieu,
 * c'est ce qui a déjà été refusé deux fois — et à raison : ça reste une
 * vignette sur un fond. Débordant, il devient une matière.
 *
 * ─── Pourquoi l'initiale et pas le logo ───
 * Le logo agrandi a été essayé et jeté : les icônes de domaine sont dessinées
 * sur un carré plein, et à cette taille c'est ce CARRÉ qu'on voit — un bord
 * net en travers de la carte, qui passe pour un défaut d'affichage. Une lettre
 * n'a pas de fond, se met à l'échelle sans jamais se pixelliser, et vaut pour
 * toutes les marques y compris celles dont le logo est illisible.
 *
 * Elle est dessinée en SVG parce qu'un texte SVG se met exactement à l'échelle
 * de sa boîte, sans dépendre de la taille de l'écran ni de celle de la carte.
 */
function GrandSigne({ marque, encre }: { marque: string; encre: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="xMaxYMin meet"
      className="absolute -right-[10%] top-[1%] h-[52%] w-[86%]"
    >
      <text
        x="100"
        y="82"
        textAnchor="end"
        className="font-display"
        fontSize="112"
        fontWeight="900"
        fill={rgba(encre, 0.13)}
      >
        {marque.slice(0, 1).toUpperCase()}
      </text>
    </svg>
  );
}

/**
 * La photo d'un brief — toujours la même pour une campagne donnée.
 *
 * On tire dans la liste à partir de l'identifiant plutôt qu'au hasard : une
 * carte qui change d'image d'un chargement à l'autre donne l'impression que
 * rien n'est décidé. Exportée pour que la fiche détaillée s'ouvre sur LA photo
 * de la carte qu'on vient de toucher, et pas sur une autre.
 */
export function photoDuBrief(brief: BriefDefile): string | null {
  if (brief.modele === "logo" || brief.photos.length === 0) return null;
  const rang =
    [...brief.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 9973, 7) % brief.photos.length;
  return brief.photos[rang];
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
  const [glisse, setGlisse] = useState(false);
  /* ⚠️ Le geste ne peut pas dépendre d'un état React.
     `glisse` sert à couper la transition pendant le mouvement, et ça, c'est
     du rendu. Mais les gestionnaires d'évènements le LISAIENT aussi pour
     savoir si un geste était en cours — or entre `pointerdown` et `pointerup`,
     sur un tap rapide, React n'a pas encore validé le changement : le
     relâchement voyait `false` et ne faisait rien. Toucher une carte pour
     ouvrir sa fiche échouait une fois sur deux, sans rien dans la console.
     Une référence est à jour immédiatement ; c'est elle qui décide. */
  const enCours = useRef(false);
  const [sortie, setSortie] = useState<Direction | null>(null);
  const depart = useRef(0);

  /* ═══ LE GLISSEMENT NE PASSE PLUS PAR REACT ═══

     `dx` était un état : chaque pixel parcouru par le doigt déclenchait un
     rendu complet de la carte — quatre calques de dégradé, des unités de
     conteneur, une image de fond. À soixante images par seconde c'est
     intenable, et ça se voyait : « ça lag, c'est pas fluide du tout, ça va
     pas sur le côté ».

     Le décalage vit maintenant dans une référence, et le mouvement s'écrit
     directement sur le nœud du DOM. React ne rend plus rien pendant le geste ;
     il reprend la main au relâchement, quand il y a vraiment une décision à
     enregistrer. C'est la seule façon de tenir le rythme du doigt. */
  const racine = useRef<HTMLDivElement>(null);
  const tamponOui = useRef<HTMLSpanElement>(null);
  const tamponNon = useRef<HTMLSpanElement>(null);
  const dx = useRef(0);

  /** Écrit la position du doigt sur la carte, sans passer par un rendu. */
  function peindre(ecart: number) {
    const el = racine.current;
    if (!el) return;
    const rotation = Math.max(-16, Math.min(16, ecart / 14));
    el.style.transform = `translateX(${ecart}px) rotate(${rotation}deg)`;
    const intensite = Math.min(1, Math.abs(ecart) / SEUIL);
    if (tamponOui.current) tamponOui.current.style.opacity = String(ecart > 0 ? intensite : 0);
    if (tamponNon.current) tamponNon.current.style.opacity = String(ecart < 0 ? intensite : 0);
  }
  // Distingue une PRESSION d'un GLISSEMENT : sans ça, ouvrir la fiche au
  // toucher déclencherait aussi une décision, et inversement.
  const aBouge = useRef(false);

  const sortieEffective = sortie ?? sortirVers ?? null;
  const inerte = enArriere || sortieEffective !== null;

  function commencer(e: React.PointerEvent) {
    if (inerte || !onDecision) return;
    depart.current = e.clientX;
    dx.current = 0;
    aBouge.current = false;
    enCours.current = true;
    setGlisse(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* certains navigateurs refusent la capture : le geste marche quand même */
    }
  }

  function bouger(e: React.PointerEvent) {
    if (!enCours.current) return;
    const ecart = e.clientX - depart.current;
    // 6 px de tolérance : un doigt n'est jamais parfaitement immobile, et sans
    // cette marge une pression normale passerait pour un micro-glissement.
    if (Math.abs(ecart) > 6) aBouge.current = true;
    dx.current = ecart;
    peindre(ecart);
  }

  function relacher() {
    if (!enCours.current) return;
    enCours.current = false;
    setGlisse(false);
    const ecart = dx.current;
    dx.current = 0;

    if (!aBouge.current) {
      peindre(0);
      onOuvrir?.();
      return;
    }
    if (Math.abs(ecart) >= SEUIL) {
      const dir: Direction = ecart > 0 ? "droite" : "gauche";
      setSortie(dir);
      window.setTimeout(() => onDecision?.(dir), 240);
    } else {
      // Le retour au centre est la SEULE animation du geste : on repose la
      // transition juste avant, sinon la carte reviendrait d'un coup sec.
      const el = racine.current;
      if (el) el.style.transition = "transform .24s cubic-bezier(.22,.61,.36,1)";
      peindre(0);
      if (tamponOui.current) tamponOui.current.style.opacity = "0";
      if (tamponNon.current) tamponNon.current.style.opacity = "0";
    }
  }

  const remuneration = remunerationLisible(brief);
  // Une photo par campagne, toujours la même : on tire dans la liste à partir
  // de l'identifiant plutôt qu'au hasard. Une carte qui change d'image d'un
  // chargement à l'autre donne l'impression que rien n'est décidé.
  // ─── LE MODÈLE COMMANDE ───
  //
  // La marque choisit comment sa campagne se présente : une photo en pleine
  // carte, ou sa marque dans un grand encadré. Sans ce choix, une marque dont
  // on avait extrait une image médiocre la subissait — et une marque qui
  // n'avait qu'un beau logo se retrouvait avec une lettre.
  const photo = photoDuBrief(brief);

  /* ─── La palette de CETTE marque ───
     Tout ce qui suit se calcule à partir d'une seule couleur reçue : le fond,
     la lueur, l'assombrissement et l'encre. Rien n'est fixé en dur, sinon la
     carte irait bien avec une marque et mal avec les vingt autres. */
  const base = brief.couleurMarque ?? "#1b1b21";
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
  const logoNet = useLogoNet(brief.image);
  // L'enseigne officielle ne sert que faute de photo : une photo produit dit
  // toujours plus qu'un logo, aussi beau soit-il.
  const enseigne = photo ? null : brief.enseigne;

  // ⚠️ En unités de CONTENEUR, pas en pixels.
  //
  // Les tailles étaient fixes. Ça tient tant que la carte occupe l'écran, et
  // ça casse partout ailleurs : dans l'aperçu du questionnaire, large de 280 px,
  // « 400 € » passait à la ligne et le montant se coupait en deux. Une carte
  // qui ne supporte qu'une seule taille n'est pas une carte, c'est une capture.
  //
  // `cqw` = 1 % de la largeur de la carte. Les bornes évitent qu'elle devienne
  // illisible en très petit ou grotesque en très grand.
  const tailleMontant = (() => {
    if (photo) return "clamp(30px, 16cqw, 64px)";
    const n = remuneration?.gros.length ?? 0;
    if (n > 7) return "clamp(28px, 16cqw, 66px)";
    if (n > 5) return "clamp(32px, 20cqw, 80px)";
    return "clamp(36px, 24cqw, 94px)";
  })();

  // React ne décrit plus que les états STABLES : la sortie, la carte du
  // dessous, le repos. Le mouvement du doigt, lui, s'écrit dans `peindre`.
  const transform = sortieEffective
    ? `translateX(${sortieEffective === "droite" ? 900 : -900}px) rotate(${sortieEffective === "droite" ? 26 : -26}deg)`
    : enArriere
      ? "scale(0.95) translateY(10px)"
      : undefined;

  return (
    <div
      ref={racine}
      onPointerDown={commencer}
      onPointerMove={bouger}
      onPointerUp={relacher}
      onPointerCancel={relacher}
      style={{
        transform,
        // Aucune transition PENDANT le geste : sinon la carte suit le doigt
        // avec du retard. Elle ne s'anime qu'au relâchement et à la sortie.
        transition: glisse ? "none" : "transform .24s cubic-bezier(.22,.61,.36,1), opacity .2s",
        // Prévient le navigateur : il prépare un calque, le geste ne repeint
        // plus la carte à chaque image.
        willChange: "transform",
        touchAction: "none",
        opacity: sortieEffective ? 0 : 1,
        // C'est CETTE largeur que les tailles en `cqw` mesurent.
        containerType: "inline-size",
        // ⚠️ Un fond OPAQUE sur la carte elle-même.
        //
        // Les fonds étaient posés sur des calques intérieurs. Quand une photo
        // ne chargeait pas — adresse morte, hébergeur qui refuse — son calque
        // restait transparent et la carte du DESSOUS apparaissait au travers :
        // deux marques superposées, illisibles. Vu sur Anker et Gymshark.
        //
        // Une carte doit cacher ce qu'il y a derrière elle, même quand tout ce
        // qu'elle devait afficher a échoué.
        backgroundColor: assombrir(base, 0.42),
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
          {/* ═══ UNE MATIÈRE, PAS UN APLAT ═══

              Un fond d'une seule couleur avec un cadre posé dessus, ça reste
              un rectangle : c'est ce que Julien a vu, et il avait raison de le
              refuser. Ce qui fait « premium », c'est la PROFONDEUR — plusieurs
              sources de lumière dans la même teinte, qui se recouvrent et
              donnent un relief.

              Trois couches, toutes tirées de la couleur de la marque : un
              champ profond, une lumière haute à gauche, un rappel saturé en
              bas à droite. Rien n'est inventé, tout est une déclinaison de sa
              teinte — la carte reste la sienne. */}
          <div className="absolute inset-0" style={{ background: assombrir(base, 0.42) }} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(88% 62% at 20% 8%, ${rgba(eclaircir(base, 0.5), 0.98)} 0%, ${rgba(eclaircir(base, 0.3), 0.45)} 42%, ${rgba(base, 0)} 74%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(72% 52% at 92% 72%, ${rgba(base, 0.95)} 0%, ${rgba(base, 0)} 70%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `radial-gradient(130% 85% at 50% 118%, ${rgba(assombrir(base, 0.78), 0.98)} 0%, ${rgba(assombrir(base, 0.78), 0)} 62%)`,
            }}
          />
          {!enseigne && <GrandSigne marque={brief.marque} encre={encreHaut} />}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[68%]"
            style={{
              background: `linear-gradient(to top, ${rgba(sombre, 0.82)} 0%, ${rgba(sombre, 0.3)} 45%, ${rgba(sombre, 0)} 100%)`,
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
            ref={tamponOui}
            style={{ opacity: 0 }}
            className="pointer-events-none absolute left-6 top-8 z-20 -rotate-[14deg] rounded-2xl border-4 border-emerald-400 px-4 py-1.5 text-xl font-black uppercase tracking-wider text-emerald-400"
          >
            Intéressé
          </span>
          <span
            ref={tamponNon}
            style={{ opacity: 0 }}
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
        {/* ─── L'IDENTITÉ ───

            Avec l'enseigne officielle, elle prend toute la largeur : c'est le
            vrai logo de la marque, en haute définition, et il dit son nom
            mieux qu'une ligne de texte. La pastille et le nom écrit
            deviendraient alors une redite, donc ils disparaissent.

            Elle est toujours posée sur un PANNEAU, comme un fond de studio,
            et c'est le panneau qui s'adapte : clair sous une enseigne sombre,
            sombre sous une enseigne claire.

            Premier essai : pas de panneau du tout quand l'enseigne est claire,
            « puisqu'elle ressort sur du foncé ». Faux — le fond de la carte
            est la couleur de la MARQUE, et l'enseigne est de cette couleur
            aussi. Le logo Fnac, jaune sur une carte jaune, avait quasiment
            disparu. Ce qui compte n'est pas clair ou sombre dans l'absolu,
            c'est le contraste avec ce qu'il y a dessous. */}
        {!enseigne && brief.modele === "logo" ? (
          /* ─── LE NOM, FAUTE DE LOGO ───
             Le modèle « marque » ne peut jamais échouer : quand aucun logo
             n'est disponible, l'encadré porte le NOM de la marque en grand.
             C'est sobre, mais c'est une carte — et surtout ça supprime le
             seul cas où il n'y avait rien à afficher du tout. */
          /* Le nom seul, posé sur la matière — PAS dans un cadre blanc.
             Une boîte blanche au milieu d'une carte, ça se lit comme un
             emplacement vide en attente d'image. Le nom en grand, lui, EST le
             sujet : c'est le traitement d'une affiche, pas d'un gabarit. */
          <div className="flex items-center">
            <span
              className="font-display truncate font-black leading-[0.95] tracking-[-0.03em]"
              style={{ fontSize: "clamp(30px, 13cqw, 62px)", color: encreHaut }}
            >
              {brief.marque}
            </span>
          </div>
        ) : enseigne && brief.enseigneCarree ? (
          /* ─── UNE ICÔNE CARRÉE ───
             Elle porte déjà son propre fond : l'étaler sur toute la largeur
             la déforme, et lui coller un panneau derrière donne un
             autocollant sur une feuille. Elle se pose donc seule, à sa
             taille, comme une icône d'application — et le nom l'accompagne,
             puisqu'une icône ne le dit pas. */
          <div className="flex items-center gap-4">
            <span
              className="shrink-0 rounded-[24%] bg-contain bg-center bg-no-repeat shadow-[0_16px_40px_-14px_rgba(0,0,0,.65)]"
              style={{
                height: "clamp(74px, 30cqw, 150px)",
                width: "clamp(74px, 30cqw, 150px)",
                backgroundImage: `url("${enseigne}")`,
                // Un logo transparent a besoin d'un fond, et pas n'importe
                // lequel : clair sous des traits sombres, sombre sous des
                // traits clairs. Un logo opaque le recouvre de toute façon.
                //
                // `backgroundColor` et non `background` : la forme courte
                // efface l'image posée juste au-dessus.
                backgroundColor: brief.enseigneSombre
                  ? eclaircir(base, 0.95)
                  : assombrir(base, 0.84),
              }}
              role="img"
              aria-label={brief.marque}
            />
            <span
              className="font-display min-w-0 truncate font-black tracking-tight"
              style={{ fontSize: "clamp(20px, 8cqw, 40px)", color: encreHaut }}
            >
              {brief.marque}
            </span>
            {brief.dejaInteressee && (
              <span className="ml-auto shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
                T&apos;a repéré
              </span>
            )}
          </div>
        ) : enseigne ? (
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex flex-1 items-center justify-center rounded-2xl px-5 py-4 shadow-[0_14px_36px_-16px_rgba(0,0,0,.65)]"
              style={{
                height: "clamp(78px, 26cqw, 132px)",
                background: brief.enseigneSombre
                  ? eclaircir(base, 0.95)
                  : assombrir(base, 0.84),
              }}
            >
              <div
                className="h-full w-full bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${enseigne}")` }}
                role="img"
                aria-label={brief.marque}
              />
            </div>
            {brief.dejaInteressee && (
              <span className="shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
                T&apos;a repéré
              </span>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-2.5">
          {/* ─── LA MARQUE, SOUS SA MEILLEURE FORME ───

              La pastille lisait la petite icône du site. Chez cut by fred elle
              fait 35 px : écartée, donc la carte affichait un « C » alors que
              leur vraie signature venait d'être trouvée. Ce qui est bon pour
              le grand format l'est aussi pour le petit.

              Et une SIGNATURE ne rentre pas dans un carré de 44 px : elle s'y
              écraserait. Large, elle se pose comme un bandeau ; carrée, comme
              une pastille. */}
          {brief.enseigne && !brief.enseigneCarree ? (
            <span
              className="h-6 max-w-[58%] flex-1 bg-contain bg-left bg-no-repeat drop-shadow-[0_2px_6px_rgba(0,0,0,.55)]"
              style={{ backgroundImage: `url("${brief.enseigne}")` }}
              role="img"
              aria-label={brief.marque}
            />
          ) : (
          <>
          <Pastille
            logo={brief.enseigne ?? brief.image}
            net={brief.enseigne !== null || logoNet}
            marque={brief.marque}
            encre={encreHaut}
          />
          <span
            className="font-display truncate text-[18px] font-black tracking-tight"
            style={{
              color: encreHaut,
              textShadow: photo ? "0 2px 10px rgba(0,0,0,.6)" : "none",
            }}
          >
            {brief.marque}
          </span>
          </>
          )}
          {brief.dejaInteressee && (
            <span className="ml-auto shrink-0 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
              T&apos;a repéré
            </span>
          )}
        </div>
        )}

        {/* ─── L'OFFRE ───

            Avec une photo, tout se pose en bas : l'image occupe la carte et le
            texte se range sous elle. Sans photo, ce même empilement laissait un
            grand vide au-dessus — et c'est le vide qu'on voyait.

            L'offre prend donc toute la hauteur libre et se centre dedans. La
            carte n'a plus un trou en haut et un tas en bas : elle a un haut,
            un milieu et un pied. */}
        <div className={photo ? "" : "flex flex-1 flex-col justify-center"}>
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
                  fontSize: tailleMontant,
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

          {/* Sous une photo, la mission reste collée au montant : le bas de la
              carte est la seule zone lisible. */}
          {photo && brief.titre && (
            <p
              className="mt-3 line-clamp-2 text-[16px] font-semibold leading-snug"
              style={{ color: attenue(0.9) }}
            >
              {brief.titre}
            </p>
          )}
          {photo && brief.niches.length > 0 && (
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

        {/* Le pied, seulement sans photo : ce qu'on fait pour cet argent. */}
        {!photo && (
          <div>
            {brief.titre && (
              <p
                className="line-clamp-2 text-[16px] font-semibold leading-snug"
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
        )}
      </div>

    </div>
  );
}
