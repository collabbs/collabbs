"use client";

import { useState } from "react";
import Link from "next/link";
import { capturerProspect } from "../actions";

/**
 * Demande du modèle de contrat, au moment où il devient nécessaire.
 *
 * ─── Deux promesses à ne pas trahir ───
 *
 * 1. La page annonce « rien ne quitte ton navigateur ». C'est vrai des
 *    collaborations saisies, et ça doit le rester : on n'envoie QUE l'adresse
 *    et deux compteurs anonymes (combien de marques au-dessus du seuil). Ni
 *    les noms de marques, ni les montants. Le dire explicitement, sinon ce
 *    formulaire fait mentir la ligne du dessous.
 *
 * 2. Le modèle est une page PUBLIQUE, librement consultable. Cacher ce fait
 *    pour arracher une adresse serait un péage déguisé — et se retournerait
 *    au premier visiteur qui découvre le lien. On propose donc les deux, et
 *    l'e-mail garde un vrai usage : le retrouver plus tard.
 */
export default function DemandeModele({
  marquesAuDessus,
  marquesQuiApprochent,
}: {
  marquesAuDessus: number;
  marquesQuiApprochent: number;
}) {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<"repos" | "envoi" | "envoye">("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEtat("envoi");
    const res = await capturerProspect({
      email,
      source: "seuil-1000-euros",
      contexte: { marquesAuDessus, marquesQuiApprochent },
    });
    if (res.ok) {
      setEtat("envoye");
    } else {
      setErreur(res.error ?? "Une erreur est survenue.");
      setEtat("repos");
    }
  }

  if (etat === "envoye") {
    return (
      <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-display text-lg font-black text-emerald-900">
          C&apos;est parti — regarde tes e-mails
        </p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-800">
          Le modèle t&apos;attend au bout du lien. S&apos;il n&apos;arrive pas
          d&apos;ici quelques minutes, regarde dans les indésirables — ou{" "}
          <Link href="/outils/modele-contrat" className="font-semibold underline underline-offset-2">
            ouvre-le directement
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="font-display text-lg font-black text-ink">
        {marquesAuDessus > 0
          ? `Il te faut un contrat écrit avec ${marquesAuDessus > 1 ? `ces ${marquesAuDessus} marques` : "cette marque"}`
          : "Prépare le contrat avant de franchir le seuil"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Le décret impose le contrat écrit, mais n&apos;impose à personne de le
        fournir. On a écrit le modèle : toutes les mentions obligatoires, à
        compléter et à imprimer. Il est gratuit.
      </p>

      <form onSubmit={envoyer} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          placeholder="ton@email.com"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
        />
        <button
          type="submit"
          disabled={etat === "envoi"}
          className="shrink-0 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {etat === "envoi" ? "Envoi…" : "Recevoir le modèle"}
        </button>
      </form>

      {erreur && (
        <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{erreur}</p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        On envoie seulement le modèle.{" "}
        <strong className="font-semibold text-zinc-600">
          Tes collaborations restent sur cet appareil
        </strong>{" "}
        — ni les marques ni les montants ne partent avec. Tu peux aussi{" "}
        <Link href="/outils/modele-contrat" className="font-medium underline underline-offset-2 hover:text-ink">
          le consulter sans rien laisser
        </Link>
        .
      </p>
    </div>
  );
}
