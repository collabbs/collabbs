"use client";

import { useState } from "react";
import { lireIdentiteMarque } from "../actions";
import { CHAMP, PRINCIPAL, TITRE, AIDE, SECTION } from "../styles";

type Resultat = {
  site: string;
  logo: string | null;
  couleur: string | null;
  photos: string[];
  ms: number;
};

/**
 * Banc d'essai : coller des adresses, voir ce qu'on en tire.
 *
 * Écrit parce que Julien va tester sur beaucoup de sites, et qu'il faut
 * pouvoir le faire en série sans rejouer le questionnaire à chaque fois. On
 * mesure aussi le TEMPS : c'est lui qui décide si la lecture peut rester
 * discrète en arrière-plan ou s'il faut prévenir.
 */
export default function Banc() {
  const [saisie, setSaisie] = useState("gymshark.com\ncabaia.fr\nbonnegueule.fr\nasphalte.com\nsephora.fr\ndecathlon.fr");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [enCours, setEnCours] = useState(false);

  async function lancer() {
    const sites = saisie
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sites.length === 0) return;

    setEnCours(true);
    setResultats([]);
    // En série, pas en parallèle : on veut des temps comparables, et on ne
    // veut pas mesurer notre propre saturation.
    for (const site of sites) {
      const t0 = performance.now();
      const lu = await lireIdentiteMarque(site);
      setResultats((r) => [
        ...r,
        { site, logo: lu.logo, couleur: lu.couleur, photos: lu.photos, ms: Math.round(performance.now() - t0) },
      ]);
    }
    setEnCours(false);
  }

  const avecPhotos = resultats.filter((r) => r.photos.length > 0).length;
  const avecQuelqueChose = resultats.filter((r) => r.photos.length > 0 || r.logo).length;

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <p className={SECTION}>Banc d&apos;essai</p>
      <h1 className={`${TITRE} mt-3`}>Ce qu&apos;on arrive à tirer d&apos;un site</h1>
      <p className={AIDE}>
        Une adresse par ligne. On mesure ce qu&apos;on récupère et en combien de
        temps.
      </p>

      <textarea
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        rows={7}
        className={`${CHAMP} mt-6 resize-y py-4 font-mono text-[13px] leading-relaxed`}
      />
      <button type="button" onClick={lancer} disabled={enCours} className={`${PRINCIPAL} mt-3`}>
        {enCours ? "En cours…" : "Lancer"}
      </button>

      {resultats.length > 0 && (
        <p className="mt-6 rounded-xl bg-[#F4F1F5] p-4 text-[14px] font-semibold text-ink">
          {avecPhotos} sur {resultats.length} avec de vraies images ·{" "}
          {avecQuelqueChose} sur {resultats.length} avec quelque chose
        </p>
      )}

      <div className="mt-4 space-y-4">
        {resultats.map((r) => (
          <div key={r.site} className="rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center gap-2.5">
              {r.logo && (
                <span
                  className="h-8 w-8 shrink-0 rounded-lg bg-white bg-contain bg-center bg-no-repeat ring-1 ring-zinc-200"
                  style={{ backgroundImage: `url("${r.logo}")` }}
                />
              )}
              <span className="font-semibold text-ink">{r.site}</span>
              <span className="ml-auto font-mono text-[11px] text-zinc-400">{r.ms} ms</span>
            </div>

            <p className="mt-2 text-[13px] text-zinc-500">
              {r.photos.length > 0
                ? `${r.photos.length} images`
                : r.logo
                  ? "logo seul"
                  : "rien"}
              {r.couleur && ` · couleur ${r.couleur}`}
            </p>

            {r.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {r.photos.slice(0, 6).map((u) => (
                  <div
                    key={u}
                    className="aspect-square rounded-lg bg-zinc-100 bg-cover bg-center"
                    style={{ backgroundImage: `url("${u}")` }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
