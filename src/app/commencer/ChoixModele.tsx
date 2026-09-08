"use client";

import { useState } from "react";
import CarteBrief from "@/app/defile/CarteBrief";
import type { CarteMarque, ModeleCarte } from "@/lib/quiz";
import { apercuDeLaCarte } from "./apercu-carte";
import { lireIdentiteMarque, televerserVisuelAnonyme } from "./actions";
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

/**
 * Un dépôt d'image : depuis l'appareil, ou par adresse.
 *
 * Écrit deux fois plutôt qu'une : la photo et le logo se donnent séparément,
 * et chacun doit avoir son propre bouton. Les confondre était le défaut.
 */
function Depot({
  titre,
  aide,
  bouton,
  rempli,
  onImage,
}: {
  titre: string;
  aide: string;
  bouton: string;
  rempli: boolean;
  onImage: (url: string) => void;
}) {
  const [adresse, setAdresse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function coller() {
    const v = adresse.trim();
    if (!v) return;
    try {
      const u = new URL(v.startsWith("http") ? v : `https://${v}`);
      if (u.protocol !== "https:") throw new Error("protocole");
      onImage(u.toString());
      setAdresse("");
      setErreur(null);
    } catch {
      setErreur("Colle l'adresse d'une image, en https.");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold text-ink">{titre}</span>
        {rempli && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            ajouté
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[12px] leading-snug text-zinc-500">{aide}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[13px] font-semibold text-ink transition hover:border-zinc-400">
          {envoi ? "Envoi…" : bouton}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={envoi}
            onChange={async (e) => {
              const fichier = e.target.files?.[0];
              // Vidé tout de suite : sans ça, rechoisir le même fichier après
              // une erreur ne déclenche rien.
              e.target.value = "";
              if (!fichier) return;
              setErreur(null);
              setEnvoi(true);
              const donnees = new FormData();
              donnees.append("file", fichier);
              const r = await televerserVisuelAnonyme(donnees);
              setEnvoi(false);
              if (r.ok && r.url) onImage(r.url);
              else setErreur(r.error ?? "Le téléversement a échoué.");
            }}
          />
        </label>
        <input
          type="text"
          inputMode="url"
          value={adresse}
          onChange={(e) => {
            setAdresse(e.target.value);
            setErreur(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && coller()}
          placeholder="ou colle une adresse"
          className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-[#F7F5F8] px-3 py-2 text-[13px] outline-none focus:border-zinc-400"
        />
      </div>
      {erreur && <p className="mt-2 text-[12px] text-red-600">{erreur}</p>}
    </div>
  );
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
  const [autreSite, setAutreSite] = useState("");
  const [relecture, setRelecture] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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
   * Un logo donné remplit la pastille ET l'enseigne.
   *
   * La pastille apparaît sur la carte photo, l'enseigne sur la carte marque.
   * C'est le même logo : n'en remplir qu'un revenait à le perdre en changeant
   * de modèle.
   */
  function poserLogo(url: string) {
    const img = new window.Image();
    const poser = (carree: boolean) =>
      maj({
        logo: url,
        enseigne: url,
        enseigneCarree: carree,
        // On ne sait pas lire le ton d'une image déposée. Un fond clair est le
        // pari le plus sûr : la plupart des logos sont en traits sombres, et
        // un logo opaque le recouvre de toute façon.
        enseigneSombre: true,
      });
    img.onload = () => poser(img.naturalWidth / Math.max(1, img.naturalHeight) < 2.5);
    img.onerror = () => poser(true);
    img.src = url;
  }

  /** Relit une autre adresse et remplace ce que la carte affiche. */
  async function relire() {
    const v = autreSite.trim();
    if (!v || relecture) return;
    setRelecture(true);
    setErreur(null);
    try {
      const lu = await lireIdentiteMarque(v);
      maj({
        site: v,
        logo: lu.logo,
        couleur: lu.couleur,
        photos: lu.photos,
        enseigne: lu.enseigne,
        enseigneSombre: lu.enseigneSombre,
        enseigneCarree: lu.enseigneCarree,
        visuel: lu.photos[0] ?? null,
        modele: lu.photos.length > 0 ? "photo" : "logo",
      });
      if (lu.photos.length === 0 && !lu.enseigne) {
        setErreur("Rien à récupérer sur cette adresse. Essaie une page produit.");
      }
    } finally {
      setRelecture(false);
    }
  }

  return (
    <div>
      {/* ═══ LA CARTE, PAS SES INGRÉDIENTS ═══
          En grand, et dans son vrai format : c'est ce qu'un créateur verra. */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px]">
        <CarteBrief brief={apercuDeLaCarte(carte)} />
      </div>

      {lectureEnCours && !aDesPhotos && (
        <p className="mt-4 text-center text-[13px] text-zinc-500">On regarde ton site…</p>
      )}

      {/* ─── Le modèle ─── */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {MODELES.map((m) => {
          // Aucune option n'est jamais grisée. « Une photo » l'était tant
          // qu'aucune image n'avait été trouvée — donc on ne pouvait pas la
          // CHOISIR pour ensuite en ajouter une, ce qui est exactement le
          // geste attendu. Choisir un modèle et le remplir sont deux actions
          // distinctes ; les confondre bloquait la seconde.
          const dispo = true;
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

      {/* Choisir « photo » sans en avoir : on demande, on ne bloque pas. */}
      {carte.modele === "photo" && !aDesPhotos && (
        <p className="mt-4 rounded-2xl bg-[#F4F1F5] p-4 text-[13px] leading-relaxed text-zinc-600">
          Il te manque une photo. Ajoute-la ci-dessous — une photo de ton produit
          ou de quelqu&apos;un qui l&apos;utilise. C&apos;est elle qui fera
          s&apos;arrêter un créateur.
        </p>
      )}

      {/* ─── Les photos trouvées ───

          Visibles dans LES DEUX modèles, et c'est le point.

          Elles n'apparaissaient qu'en modèle photo. En passant sur « Ta
          marque » pour ajouter un logo, elles disparaissaient de l'écran — et
          la carte cessait de les montrer. Tout indiquait qu'on venait de
          perdre sa photo, alors qu'elle était intacte en mémoire.

          Rien n'est detruit en changeant de modèle : les garder à l'écran le
          dit sans avoir à l'écrire. Cliquer une photo rebascule sur le modèle
          photo, ce qui rend l'aller-retour immédiat. */}
      {carte.photos.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {carte.photos.slice(0, 6).map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => maj({ visuel: url, modele: "photo" })}
                className={`aspect-square overflow-hidden rounded-xl border-2 bg-zinc-100 bg-cover bg-center transition ${
                  carte.visuel === url ? "border-brand" : "border-transparent hover:border-zinc-300"
                }`}
                style={{ backgroundImage: `url("${url}")` }}
                aria-label="Choisir cette photo"
              />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-zinc-500">
            {carte.modele === "logo"
              ? "Tes photos sont gardées — clique l'une d'elles pour revenir au modèle photo."
              : "Trouvées sur ton site. Choisis celle qui donne le plus envie."}
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

      {/* ─── Essayer une autre adresse, sans quitter l'étape ───

          Le banc d'essai vivait sur une page à part : pour comparer deux
          adresses il fallait sortir du questionnaire, donc perdre ses réponses.
          Le plus utile est de pouvoir taper une adresse ICI et voir la carte
          changer sous les yeux — la page produit plutôt que l'accueil, par
          exemple, qui rend souvent de bien meilleures photos. */}
      <div className="mt-5 rounded-2xl border border-zinc-200 p-3">
        <p className="text-[12px] font-semibold text-zinc-500">
          Essaie une autre adresse — une page produit donne souvent mieux que
          l&apos;accueil.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            inputMode="url"
            value={autreSite}
            onChange={(e) => setAutreSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && relire()}
            placeholder={carte.site ?? "ta-marque.com/un-produit"}
            className={`${CHAMP} flex-1`}
          />
          <button
            type="button"
            onClick={relire}
            disabled={relecture || !autreSite.trim()}
            className="shrink-0 rounded-xl bg-ink px-4 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {relecture ? "…" : "Voir"}
          </button>
        </div>
        {erreur && <p className="mt-2 text-[12px] text-red-600">{erreur}</p>}
      </div>

      {/* ═══ DEUX DÉPÔTS, PAS UN ═══

          Il n'y en avait qu'un, et il alimentait le modèle en cours. Pour
          ajouter un logo il fallait donc passer sur « Ta marque » — ce qui
          retirait la photo de la carte. Impossible d'avoir les deux.

          C'est une erreur de conception, pas d'affichage : une photo et un
          logo ne sont pas deux versions d'une même chose. La photo remplit la
          carte, le logo signe la marque, et une bonne carte photo porte les
          DEUX — l'image en grand, la pastille dans le coin.

          Le modèle ne décide plus que du sujet principal. Ce qu'on donne à la
          carte se donne indépendamment. */}
      <div className="mt-5 space-y-3">
        <Depot
          titre="La photo"
          aide="Elle remplit la carte."
          bouton={carte.visuel ? "Remplacer la photo" : "Ajouter une photo"}
          rempli={Boolean(carte.visuel)}
          onImage={(url) => maj({ visuel: url, modele: "photo" })}
        />
        <Depot
          titre="Le logo"
          aide="Il signe la marque, y compris sur la carte photo."
          bouton={carte.logo ? "Remplacer le logo" : "Ajouter mon logo"}
          rempli={Boolean(carte.logo)}
          onImage={poserLogo}
        />
      </div>
    </div>
  );
}
