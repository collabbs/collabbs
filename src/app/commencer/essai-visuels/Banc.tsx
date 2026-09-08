"use client";

import { useState } from "react";
import { lireIdentiteMarque } from "../actions";
import { CHAMP, PRINCIPAL, TITRE, AIDE, SECTION } from "../styles";
import CarteBrief from "@/app/defile/CarteBrief";
import type { BriefDefile } from "@/lib/defile";

/**
 * Banc d'essai : coller des adresses, voir LA CARTE qu'un créateur verra.
 *
 * La première version affichait les images récupérées en vignettes. C'était
 * regarder les ingrédients : on ne jugeait pas ce qui compte. Une image
 * correcte en vignette peut donner une carte illisible — trop claire pour du
 * texte blanc, mal cadrée en portrait, ou si chargée qu'on ne lit plus le
 * montant.
 *
 * Chaque site rend donc la vraie carte, avec le vrai composant. On juge le
 * résultat, pas la matière première.
 */

/** Une campagne d'exemple, pour que toutes les cartes soient comparables. */
function briefExemple(
  site: string,
  logo: string | null,
  couleur: string | null,
  photos: string[],
  enseigne: string | null,
  enseigneSombre: boolean,
  enseigneCarree: boolean,
): BriefDefile {
  return {
    id: site,
    marque: site.replace(/^www\./, "").replace(/\.(fr|com|co|io|shop)$/, ""),
    produit: "Une campagne d'exemple, pour juger la carte.",
    titre: "2 vidéos pour le lancement",
    exigences: null,
    echeance: null,
    audienceMini: null,
    type: "hybrid",
    montant: 400,
    commission: { min: 4, max: 12 },
    spots: 5,
    niches: ["Mode", "Lifestyle"],
    image: logo,
    couleurMarque: couleur,
    photos,
    enseigne,
    enseigneSombre,
    enseigneCarree,
    modele: photos.length > 0 ? "photo" : "logo",
    dejaInteressee: false,
  };
}

type Resultat = {
  site: string;
  brief: BriefDefile;
  ms: number;
  nbPhotos: number;
  aLogo: boolean;
  aEnseigne: boolean;
};

export default function Banc() {
  const [saisie, setSaisie] = useState(
    "gymshark.com\ncabaia.fr\nbonnegueule.fr\nasphalte.com\nsephora.fr\ndecathlon.fr",
  );
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function lancer() {
    const sites = saisie
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sites.length === 0) return;

    setResultats([]);
    // En série : on veut des temps comparables, pas mesurer notre saturation.
    for (const site of sites) {
      setEnCours(site);
      const t0 = performance.now();
      const lu = await lireIdentiteMarque(site);
      setResultats((r) => [
        ...r,
        {
          site,
          brief: briefExemple(site, lu.logo, lu.couleur, lu.photos, lu.enseigne, lu.enseigneSombre, lu.enseigneCarree),
          ms: Math.round(performance.now() - t0),
          nbPhotos: lu.photos.length,
          aLogo: Boolean(lu.logo),
          aEnseigne: Boolean(lu.enseigne),
        },
      ]);
    }
    setEnCours(null);
  }

  const avecPhotos = resultats.filter((r) => r.nbPhotos > 0).length;

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <p className={SECTION}>Banc d&apos;essai</p>
      <h1 className={`${TITRE} mt-3`}>La carte que verra un créateur</h1>
      <p className={AIDE}>
        Une adresse par ligne. Chaque site rend la vraie carte, avec la vraie
        campagne d&apos;exemple — pour juger le résultat, pas les ingrédients.
      </p>

      <textarea
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        rows={7}
        className={`${CHAMP} mt-6 resize-y py-4 font-mono text-[13px] leading-relaxed`}
      />
      <button
        type="button"
        onClick={lancer}
        disabled={enCours !== null}
        className={`${PRINCIPAL} mt-3`}
      >
        {enCours ? `On regarde ${enCours}…` : "Lancer"}
      </button>

      {resultats.length > 0 && (
        <p className="mt-6 rounded-xl bg-[#F4F1F5] p-4 text-[14px] font-semibold text-ink">
          {avecPhotos} sur {resultats.length} avec de vraies photos
        </p>
      )}

      <div className="mt-6 space-y-10">
        {resultats.map((r) => (
          <div key={r.site}>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-semibold text-ink">{r.site}</span>
              <span className="text-[13px] text-zinc-500">
                {r.nbPhotos > 0
                  ? `${r.nbPhotos} photos`
                  : r.aEnseigne
                    ? "enseigne officielle"
                    : r.aLogo
                      ? "logo seul"
                      : "rien"}
              </span>
              <span className="ml-auto font-mono text-[11px] text-zinc-400">{r.ms} ms</span>
            </div>

            {/* La vraie carte, dans son format réel. */}
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px]">
              <CarteBrief brief={r.brief} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
