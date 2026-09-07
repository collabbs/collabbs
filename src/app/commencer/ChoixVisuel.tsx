"use client";

import { useState } from "react";
import { CHAMP, PRINCIPAL } from "./styles";

/**
 * Le choix du visuel — l'étape qui rend la garantie possible.
 *
 * ─── Pourquoi elle existe ───
 * On ne peut PAS garantir de récupérer une image sur tous les sites : mesuré
 * sur huit marques françaises, sept sont accessibles et une résiste — sa
 * protection bloque aussi bien notre lecture qu'un service de capture d'écran.
 * Aucune astuce technique ne passera : le refus est au niveau du réseau.
 *
 * La garantie ne peut donc pas venir de l'extraction. Elle vient de la RÈGLE :
 * une campagne ne part pas sans visuel. Pour la grande majorité des marques,
 * il est déjà là et l'étape se traverse d'un clic — elles ne remarquent rien.
 * Pour les autres, on demande, une fois, ce qu'elles ont sous la main.
 *
 * ─── Pourquoi une URL et pas un téléversement ───
 * Une marque a ses photos en ligne : sur sa boutique, son Instagram, son drive.
 * Coller une adresse se fait au clavier, en trois secondes, y compris depuis un
 * téléphone. Un téléversement demande de retrouver un fichier — c'est là qu'on
 * abandonne. Le téléversement viendra, mais après le compte, pas avant.
 */
export default function ChoixVisuel({
  photos,
  choisie,
  onChoisir,
  enCours,
}: {
  photos: string[];
  choisie: string | null;
  onChoisir: (url: string | null) => void;
  /** La lecture du site tourne encore : ne PAS annoncer un échec. */
  enCours?: boolean;
}) {
  const [manuelle, setManuelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  function ajouter() {
    const v = manuelle.trim();
    if (!v) return;
    try {
      const u = new URL(v.startsWith("http") ? v : `https://${v}`);
      if (u.protocol !== "https:") throw new Error("protocole");
      setErreur(null);
      onChoisir(u.toString());
      setManuelle("");
    } catch {
      setErreur("Colle l'adresse d'une image, en https.");
    }
  }

  return (
    <div>
      {/* ⚠️ L'attente d'abord. La lecture du site tourne en arrière-plan
          pendant qu'on répond aux questions suivantes — c'est voulu, ça évite
          d'immobiliser quiconque. Mais si on arrive ici avant qu'elle
          finisse, annoncer « on n'a rien trouvé » serait FAUX : on n'a pas
          encore cherché jusqu'au bout. */}
      {enCours && photos.length === 0 ? (
        <div className="rounded-xl bg-[#F4F1F5] p-5">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-200" />
            ))}
          </div>
          <p className="mt-3 text-[13px] text-zinc-500">On regarde ton site…</p>
        </div>
      ) : photos.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 6).map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => onChoisir(url)}
                className={`aspect-square overflow-hidden rounded-xl border-2 bg-zinc-100 bg-cover bg-center transition ${
                  choisie === url ? "border-brand" : "border-transparent hover:border-zinc-300"
                }`}
                style={{ backgroundImage: `url("${url}")` }}
                aria-label="Choisir ce visuel"
              />
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-snug text-zinc-500">
            Trouvés sur ton site. Choisis celui qui donnera le plus envie — c&apos;est
            la première chose qu&apos;un créateur verra.
          </p>
        </>
      ) : (
        <p className="rounded-xl bg-[#F4F1F5] p-4 text-[13px] leading-relaxed text-zinc-600">
          On n&apos;a rien pu récupérer sur ton site — certains bloquent les accès
          automatiques, et il n&apos;y a rien à y faire. Colle l&apos;adresse
          d&apos;une de tes photos : celle d&apos;une fiche produit fait
          parfaitement l&apos;affaire.
        </p>
      )}

      <div className="mt-4">
        <input
          type="text"
          inputMode="url"
          value={manuelle}
          onChange={(e) => {
            setManuelle(e.target.value);
            setErreur(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && ajouter()}
          placeholder="Ou colle l'adresse d'une image…"
          className={CHAMP}
        />
        {erreur && <p className="mt-2 text-[13px] text-red-600">{erreur}</p>}
        {manuelle.trim() && (
          <button type="button" onClick={ajouter} className={`${PRINCIPAL} mt-3`}>
            Utiliser cette image
          </button>
        )}
      </div>
    </div>
  );
}
