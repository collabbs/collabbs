"use client";

import { useState } from "react";
import { inviterCreateurs } from "./actions";
import { MAX_INVITATIONS_PAR_ENVOI } from "@/lib/invitations";

type CreateurChoisissable = {
  id: string;
  name: string;
  handle: string;
  photo: string;
};

type CampagneOuverte = { id: string; name: string };

/**
 * Inviter plusieurs créateurs d'un coup, depuis la shortlist.
 *
 * ─── Pourquoi tout est coché au départ ───
 * Une shortlist est déjà une sélection : la marque a cliqué sur un cœur pour
 * chacun de ces profils. Lui redemander de tout cocher reviendrait à lui
 * faire refaire le tri qu'elle a déjà fait. Décocher reste possible pour les
 * exceptions, ce qui est le sens du geste réel.
 *
 * ─── Pourquoi le panneau est replié ───
 * La shortlist sert aussi à simplement consulter. Un formulaire déplié en
 * permanence transformerait un écran de consultation en écran d'envoi.
 */
export default function InviterPanel({
  createurs,
  campagnes,
}: {
  createurs: CreateurChoisissable[];
  campagnes: CampagneOuverte[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [campagneId, setCampagneId] = useState(campagnes[0]?.id ?? "");
  const [choisis, setChoisis] = useState<Set<string>>(
    () => new Set(createurs.map((c) => c.id)),
  );
  const [busy, setBusy] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function basculer(id: string) {
    setChoisis((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
    setResultat(null);
  }

  async function envoyer() {
    setBusy(true);
    setErreur(null);
    setResultat(null);
    const res = await inviterCreateurs(campagneId, [...choisis]);
    setBusy(false);
    if (res.ok) setResultat(res.message ?? "Invitations envoyées.");
    else setErreur(res.error ?? "Erreur.");
  }

  // Sans campagne ouverte, il n'y a rien à proposer à personne : mieux vaut le
  // dire et donner la marche à suivre que d'afficher un formulaire mort.
  if (campagnes.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">
          Aucune campagne ouverte
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Pour inviter ces créateurs, il faut une campagne publiée à leur proposer.
          Crée-la d&apos;abord, tu reviendras ensuite ici.
        </p>
      </div>
    );
  }

  const nb = choisis.size;
  const trop = nb > MAX_INVITATIONS_PAR_ENVOI;

  return (
    <div className="mt-6 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-base font-black text-ink">
            ✨ Inviter sur une campagne
          </p>
          <p className="mt-0.5 text-sm text-zinc-600">
            Fais le premier pas : ces créateurs recevront ton invitation et
            pourront l&apos;accepter ou la décliner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {ouvert ? "Fermer" : "Choisir"}
        </button>
      </div>

      {ouvert && (
        <div className="mt-5 border-t border-purple-100 pt-5">
          <label
            className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
            htmlFor="campagne"
          >
            Campagne
          </label>
          <select
            id="campagne"
            value={campagneId}
            onChange={(e) => {
              setCampagneId(e.target.value);
              setResultat(null);
            }}
            className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
          >
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Créateurs ({nb}/{createurs.length})
            </p>
            <button
              type="button"
              onClick={() =>
                setChoisis(
                  nb === createurs.length
                    ? new Set()
                    : new Set(createurs.map((c) => c.id)),
                )
              }
              className="text-xs font-semibold text-brand hover:underline"
            >
              {nb === createurs.length ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl bg-white/70 p-2">
            {createurs.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white">
                  <input
                    type="checkbox"
                    checked={choisis.has(c.id)}
                    onChange={() => basculer(c.id)}
                    className="h-4 w-4 shrink-0 accent-purple-600"
                  />
                  {/* Une balise <img> nue, comme partout ailleurs dans le
                      produit : les photos de profil viennent d'un hôte
                      distant, et aucun domaine n'est déclaré dans
                      next.config.ts — <Image> échouerait à l'exécution. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.photo}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 truncate text-sm text-ink">
                    {c.name}{" "}
                    <span className="text-zinc-400">@{c.handle}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={envoyer}
            disabled={busy || nb === 0 || trop}
            className="mt-4 w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "Envoi…"
              : nb === 0
                ? "Sélectionne au moins un créateur"
                : trop
                  ? `Maximum ${MAX_INVITATIONS_PAR_ENVOI} à la fois`
                  : `Inviter ${nb} créateur${nb > 1 ? "s" : ""}`}
          </button>

          {resultat && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700">
              {resultat}
            </p>
          )}
          {erreur && (
            <p className="mt-2 text-center text-sm text-red-600">{erreur}</p>
          )}
        </div>
      )}
    </div>
  );
}
