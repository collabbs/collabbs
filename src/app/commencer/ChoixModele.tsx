"use client";

import { useState } from "react";
import CarteBrief from "@/app/defile/CarteBrief";
import type { BriefDefile } from "@/lib/defile";
import type { CarteMarque, ModeleCarte } from "@/lib/quiz";
import { televerserVisuelAnonyme } from "./actions";
import { CHAMP } from "./styles";

/**
 * Le choix du modèle de carte — la dernière étape, et la plus décisive.
 *
 * ─── Ce qui n'allait pas ───
 * L'étape précédente proposait des vignettes d'images extraites et rien
 * d'autre. Une marque voyait des ingrédients, pas sa carte, et n'avait aucun
 * recours quand l'extraction rendait peu : elle partait avec ce qu'on lui
 * avait trouvé, bon ou mauvais.
 *
 * ─── Le parti ───
 * On montre LA CARTE, en grand, telle qu'un créateur la verra. Et on donne le
 * choix entre deux façons de la présenter, parce que les deux marchent :
 * une photo en pleine carte, ou la marque dans un grand encadré. Ce qui ne
 * marche pas, c'est une carte sans rien — et c'est le seul cas qu'on refuse
 * de laisser passer.
 *
 * Quand on n'a rien pu lire sur le site, on ne se contente pas de le dire :
 * on explique ce que ça coûte. Une carte sans visuel ne se fait pas regarder,
 * et la marque a trente secondes à investir pour changer ça.
 */

const MODELES: { id: ModeleCarte; titre: string; detail: string }[] = [
  { id: "photo", titre: "Une photo", detail: "Ton produit en pleine carte." },
  { id: "logo", titre: "Ta marque", detail: "Ton logo, en grand, sur ta couleur." },
];

/** Construit l'aperçu exact : le même objet que celui du défilé. */
function apercu(carte: CarteMarque): BriefDefile {
  const taux = carte.commission;
  return {
    id: "apercu",
    marque: carte.nom?.trim() || "Ta marque",
    produit: carte.produit,
    titre: carte.produit?.slice(0, 70) ?? null,
    exigences: null,
    echeance: carte.echeance,
    audienceMini: null,
    type: carte.remuneration === "commission" ? "affiliation" : carte.remuneration === "les-deux" ? "hybrid" : "video",
    montant: carte.montant,
    commission: taux !== null ? { min: taux, max: taux } : null,
    spots: null,
    niches: [],
    image: carte.logo,
    couleurMarque: carte.couleur,
    photos: carte.visuel ? [carte.visuel] : [],
    enseigne: carte.enseigne,
    enseigneSombre: carte.enseigneSombre,
    enseigneCarree: carte.enseigneCarree,
    modele: carte.modele,
    dejaInteressee: false,
  };
}

export default function ChoixModele({
  carte,
  maj,
  lectureEnCours,
}: {
  carte: CarteMarque;
  maj: (champs: Partial<CarteMarque>) => void;
  /** La lecture du site tourne encore : ne PAS annoncer un échec. */
  lectureEnCours?: boolean;
}) {
  const [manuelle, setManuelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const aDesPhotos = carte.photos.length > 0 || Boolean(carte.visuel);

  // ⚠️ « Ta marque » n'est JAMAIS indisponible.
  //
  // Elle l'était quand aucun logo n'avait été trouvé. Combinée à l'absence de
  // photo, ça donnait deux options grisées et un bouton bloqué : la marque
  // était dans un cul-de-sac, sans aucune carte possible. Le pire endroit pour
  // se retrouver coincé, c'est la dernière étape.
  //
  // Or on a toujours quelque chose à montrer : son NOM. Sans logo, l'encadré
  // le porte en grand — c'est une carte sobre, mais c'en est une, et elle se
  // lit. Le logo l'améliore, il ne la conditionne pas.

  /**
   * L'image ajoutée nourrit le modèle EN COURS.
   *
   * Elle basculait systématiquement en « photo ». Conséquence : une marque qui
   * choisissait « Ta marque » puis déposait son logo se retrouvait avec ce logo
   * étalé en pleine carte — son choix écrasé par son propre geste.
   *
   * En modèle « marque », l'image devient l'enseigne : elle se pose dans
   * l'encadré, à sa taille. On mesure ses proportions pour savoir la traiter
   * comme une icône ou comme une signature large — la même règle que pour les
   * logos qu'on extrait.
   */
  function ajouterImage(url: string) {
    setErreur(null);
    if (carte.modele === "logo") {
      const img = new window.Image();
      img.onload = () =>
        maj({
          enseigne: url,
          enseigneCarree: img.naturalWidth / Math.max(1, img.naturalHeight) < 2.5,
          // On ne sait pas lire le ton d'une image déposée. Un panneau clair
          // est le pari le plus sûr : la grande majorité des logos sont
          // dessinés en traits sombres, et un logo opaque le recouvre.
          enseigneSombre: true,
        });
      img.onerror = () => maj({ enseigne: url, enseigneCarree: true, enseigneSombre: true });
      img.src = url;
      return;
    }
    maj({ visuel: url, modele: "photo" });
  }

  /** Choisir une photo proposée, c'est vouloir le modèle photo. */
  function choisirImage(url: string) {
    maj({ visuel: url, modele: "photo" });
    setErreur(null);
  }

  function collerAdresse() {
    const v = manuelle.trim();
    if (!v) return;
    try {
      const u = new URL(v.startsWith("http") ? v : `https://${v}`);
      if (u.protocol !== "https:") throw new Error("protocole");
      ajouterImage(u.toString());
      setManuelle("");
    } catch {
      setErreur("Colle l'adresse d'une image, en https.");
    }
  }

  return (
    <div>
      {/* ═══ LA CARTE, PAS SES INGRÉDIENTS ═══
          En grand, et dans son vrai format : c'est ce qu'un créateur verra. */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px]">
        <CarteBrief brief={apercu(carte)} />
      </div>

      {lectureEnCours && !aDesPhotos && (
        <p className="mt-4 text-center text-[13px] text-zinc-500">On regarde ton site…</p>
      )}

      {/* ─── Le modèle ─── */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {MODELES.map((m) => {
          const dispo = m.id === "photo" ? aDesPhotos : true;
          const actif = carte.modele === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={!dispo}
              onClick={() => maj({ modele: m.id })}
              className={`rounded-2xl border-2 p-3 text-left transition ${
                actif ? "border-brand bg-purple-50" : "border-zinc-200 bg-white hover:border-zinc-300"
              } ${dispo ? "" : "cursor-not-allowed opacity-40"}`}
            >
              <span className="block text-[14px] font-bold text-ink">{m.titre}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-zinc-500">
                {m.detail}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Les photos trouvées ─── */}
      {carte.photos.length > 0 && carte.modele === "photo" && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {carte.photos.slice(0, 6).map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => choisirImage(url)}
                className={`aspect-square overflow-hidden rounded-xl border-2 bg-zinc-100 bg-cover bg-center transition ${
                  carte.visuel === url ? "border-brand" : "border-transparent hover:border-zinc-300"
                }`}
                style={{ backgroundImage: `url("${url}")` }}
                aria-label="Choisir cette photo"
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            Trouvées sur ton site. Choisis celle qui donne le plus envie.
          </p>
        </>
      )}

      {/* ─── Quand on n'a rien trouvé, on dit ce que ça coûte ─── */}
      {!lectureEnCours && !aDesPhotos && !carte.enseigne && (
        <div className="mt-4 rounded-2xl bg-[#F4F1F5] p-4">
          <p className="text-[14px] font-bold text-ink">Ajoute une image, ça change tout.</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
            Ton site ne nous a rien laissé lire — certains bloquent les accès
            automatiques, il n&apos;y a rien à y faire. Une carte sans visuel ne
            se fait pas regarder : c&apos;est l&apos;image qui décide si un
            créateur s&apos;arrête ou passe son chemin. Trente secondes ici valent
            tout le reste du questionnaire.
          </p>
          <p className="mt-2 text-[13px] font-semibold text-ink">
            Ajoute une photo de ton produit, ou ton logo si tu préfères la carte
            « Ta marque ».
          </p>
        </div>
      )}

      {/* ─── Sa propre image ─── */}
      <div className="mt-4">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-[14px] font-semibold text-ink transition hover:border-zinc-400">
          {envoi
            ? "Envoi…"
            : carte.modele === "logo"
              ? "Ajouter mon logo"
              : "Ajouter ma photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={envoi}
            onChange={async (e) => {
              const fichier = e.target.files?.[0];
              // Vidé tout de suite : sinon, rechoisir le même fichier après
              // une erreur ne déclenche rien.
              e.target.value = "";
              if (!fichier) return;
              setErreur(null);
              setEnvoi(true);
              const donnees = new FormData();
              donnees.append("file", fichier);
              const r = await televerserVisuelAnonyme(donnees);
              setEnvoi(false);
              if (r.ok && r.url) ajouterImage(r.url);
              else setErreur(r.error ?? "Le téléversement a échoué.");
            }}
          />
        </label>

        <input
          type="text"
          inputMode="url"
          value={manuelle}
          onChange={(e) => {
            setManuelle(e.target.value);
            setErreur(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && collerAdresse()}
          placeholder={
            carte.modele === "logo"
              ? "…ou colle l'adresse de ton logo"
              : "…ou colle l'adresse d'une image"
          }
          className={`${CHAMP} mt-3`}
        />
        {manuelle.trim() && (
          <button type="button" onClick={collerAdresse} className="mt-2 text-[13px] font-semibold text-brand">
            Utiliser cette image
          </button>
        )}
        {erreur && <p className="mt-2 text-[13px] text-red-600">{erreur}</p>}
      </div>
    </div>
  );
}
