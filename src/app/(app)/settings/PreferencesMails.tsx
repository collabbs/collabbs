"use client";

import { useId, useState } from "react";
import { majPreferenceMail } from "./actions";
import { tenter } from "@/lib/tenter";

/**
 * Choisir les e-mails qu'on reçoit.
 *
 * ─── Deux interrupteurs, et un troisième qu'on n'offre pas ───
 * Un réglage par type de notification, ce seraient trente-six cases que
 * personne ne lit. Deux familles suffisent et correspondent à deux intentions
 * réelles : savoir où en sont ses collaborations, et être relancé.
 *
 * La troisième famille — l'argent et les obligations — est annoncée mais pas
 * débrayable. On l'ÉCRIT au lieu de la taire : un réglage absent sans
 * explication se lit comme un oubli, et quelqu'un cherche alors la case qui
 * n'existe pas. Dire « ceux-là partent toujours, et voici pourquoi » répond à
 * la question avant qu'elle ne se pose.
 *
 * ─── L'enregistrement est immédiat ───
 * Pas de bouton « Enregistrer » : un interrupteur qui ne s'applique qu'après
 * une validation laisse croire que c'est fait alors que ça ne l'est pas. On
 * remet l'état précédent si l'appel échoue, et on dit pourquoi.
 */
export default function PreferencesMails({
  suiviInitial,
  rappelsInitial,
}: {
  suiviInitial: boolean;
  rappelsInitial: boolean;
}) {
  const [suivi, setSuivi] = useState(suiviInitial);
  const [rappels, setRappels] = useState(rappelsInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  async function basculer(
    champ: "mails_suivi" | "mails_rappels",
    valeur: boolean,
    poser: (v: boolean) => void,
  ) {
    const precedent = !valeur;
    poser(valeur);
    setOccupe(champ);
    setErreur(null);
    const res = await tenter(() => majPreferenceMail(champ, valeur));
    setOccupe(null);
    if (!res.ok) {
      poser(precedent); // on ne laisse pas l'écran affirmer ce qui n'a pas eu lieu
      setErreur(res.error ?? "Le réglage n'a pas pu être enregistré.");
    }
  }

  return (
    <div className="space-y-4">
      <Interrupteur
        actif={suivi}
        occupe={occupe === "mails_suivi"}
        titre="Le suivi de mes collaborations"
        detail="Propositions, candidatures, livrables déposés ou validés, messages, avis."
        onChange={(v) => basculer("mails_suivi", v, setSuivi)}
      />
      <Interrupteur
        actif={rappels}
        occupe={occupe === "mails_rappels"}
        titre="Les rappels et les nouveautés"
        detail="Rappel du défilé, profil à compléter, bilan de la semaine."
        onChange={(v) => basculer("mails_rappels", v, setRappels)}
      />

      {erreur && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {erreur}
        </p>
      )}

      <p className="rounded-xl bg-zinc-50 p-3.5 text-[13px] leading-relaxed text-zinc-600">
        <strong className="text-ink">Ce qui part toujours :</strong> l&apos;argent et
        les obligations — un paiement reçu, des commissions qui t&apos;attendent, un
        contrat écrit devenu obligatoire, une échéance dépassée. Ce sont ceux dont
        l&apos;absence coûte cher, donc on ne propose pas de les couper.
        <br />
        <span className="mt-1.5 block">
          Quoi qu&apos;il arrive, <strong className="text-ink">tout reste dans tes
          notifications</strong> ici : ces réglages ne concernent que les e-mails.
        </span>
      </p>
    </div>
  );
}

function Interrupteur({
  actif,
  occupe,
  titre,
  detail,
  onChange,
}: {
  actif: boolean;
  occupe: boolean;
  titre: string;
  detail: string;
  onChange: (v: boolean) => void;
}) {
  // `useId` et non un `ref` lu pendant le rendu : c'est l'API prévue pour
  // lier un label à son contrôle, et elle reste stable entre serveur et client.
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-semibold text-ink">{titre}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-zinc-500">
          {detail}
        </span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={actif}
        aria-label={titre}
        disabled={occupe}
        onClick={() => onChange(!actif)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:cursor-wait disabled:opacity-60 ${
          actif ? "bg-emerald-500" : "bg-zinc-300"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            actif ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
