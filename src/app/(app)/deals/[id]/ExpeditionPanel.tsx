"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  enregistrerAdresseLivraison,
  marquerExpedie,
  confirmerReception,
} from "../actions";
import {
  etatExpedition,
  adresseLivraison,
  adresseEnUneLigne,
  lienDeSuivi,
  TRANSPORTEURS,
  type Adresse,
} from "@/lib/expedition";

/**
 * L'envoi du produit, des deux côtés.
 *
 * La règle de l'écran : **à tout instant, une seule des deux parties a quelque
 * chose à faire, et l'autre doit savoir qu'elle attend — et quoi.** C'est ce
 * qui manquait complètement : le créateur attendait un colis sans savoir s'il
 * était parti, la marque attendait un contenu sans savoir s'il était arrivé,
 * et chacun soupçonnait l'autre de traîner.
 */
export default function ExpeditionPanel({
  dealId,
  role,
  adresse,
  shippedAt,
  receivedAt,
  carrier,
  tracking,
}: {
  dealId: string;
  role: "brand" | "creator";
  adresse: unknown;
  shippedAt: string | null;
  receivedAt: string | null;
  carrier: string | null;
  tracking: string | null;
}) {
  const router = useRouter();
  const existante = adresseLivraison(adresse);
  const etat = etatExpedition({
    shipping_address: adresse,
    shipped_at: shippedAt,
    received_at: receivedAt,
  });

  const [form, setForm] = useState<Adresse>({
    name: existante?.name ?? "",
    line1: existante?.line1 ?? "",
    line2: existante?.line2 ?? "",
    zip: existante?.zip ?? "",
    city: existante?.city ?? "",
    country: existante?.country ?? "France",
    phone: existante?.phone ?? "",
    note: existante?.note ?? "",
  });
  const [editionAdresse, setEditionAdresse] = useState(false);
  const [transporteur, setTransporteur] = useState("");
  const [numero, setNumero] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suivi = lienDeSuivi(carrier, tracking);

  async function lancer(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (res.ok) {
      setEditionAdresse(false);
      router.refresh();
    } else setError(res.error ?? "Erreur.");
  }

  const champ = (cle: keyof Adresse, libelle: string, obligatoire = true) => (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-500">
        {libelle}
        {!obligatoire && <span className="font-normal text-zinc-400"> (facultatif)</span>}
      </span>
      <input
        type="text"
        value={form[cle] ?? ""}
        onChange={(e) => setForm({ ...form, [cle]: e.target.value })}
        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
      />
    </label>
  );

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-black text-ink">Envoi du produit</h2>
        <span className="text-xs font-semibold text-zinc-500">
          {etat === "adresse_manquante"
            ? "En attente de l'adresse"
            : etat === "a_expedier"
              ? "À expédier"
              : etat === "en_transit"
                ? "En transit"
                : "Reçu"}
        </span>
      </div>

      {/* CRÉATEUR — l'adresse */}
      {role === "creator" && (!existante || editionAdresse) && !shippedAt && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-600">
            Indique où la marque doit envoyer le produit. Cette adresse n&apos;est visible que par
            elle, et uniquement pour cette collaboration.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {champ("name", "Nom du destinataire")}
            {champ("phone", "Téléphone", false)}
            {champ("line1", "Adresse")}
            {champ("line2", "Complément", false)}
            {champ("zip", "Code postal")}
            {champ("city", "Ville")}
            {champ("country", "Pays")}
          </div>
          {champ("note", "Indication pour la livraison", false)}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => lancer(() => enregistrerAdresseLivraison(dealId, form))}
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : existante ? "Corriger l'adresse" : "Enregistrer l'adresse"}
            </button>
            {existante && (
              <button
                type="button"
                onClick={() => setEditionAdresse(false)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      {/* L'adresse, une fois posée */}
      {existante && !(role === "creator" && editionAdresse && !shippedAt) && (
        <div className="mt-4 rounded-xl bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Adresse de livraison
          </p>
          <p className="mt-1 text-sm text-ink">{adresseEnUneLigne(existante)}</p>
          {existante.phone && <p className="text-sm text-zinc-500">{existante.phone}</p>}
          {existante.note && (
            <p className="mt-1 text-xs text-zinc-500">Indication : {existante.note}</p>
          )}
          {role === "creator" && !shippedAt && (
            <button
              type="button"
              onClick={() => setEditionAdresse(true)}
              className="mt-2 text-xs font-semibold text-purple-700 underline"
            >
              Corriger l&apos;adresse
            </button>
          )}
        </div>
      )}

      {/* MARQUE — expédier */}
      {role === "brand" && !shippedAt && (
        <div className="mt-4 space-y-3">
          {!existante ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Le créateur n&apos;a pas encore donné son adresse. Tu pourras déclarer l&apos;envoi dès
              qu&apos;elle sera renseignée — il vient d&apos;en être informé.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500">
                    Transporteur <span className="font-normal text-zinc-400">(facultatif)</span>
                  </span>
                  <input
                    type="text"
                    list="transporteurs"
                    value={transporteur}
                    onChange={(e) => setTransporteur(e.target.value)}
                    placeholder="Colissimo"
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                  />
                  <datalist id="transporteurs">
                    {TRANSPORTEURS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-500">
                    Numéro de suivi <span className="font-normal text-zinc-400">(facultatif)</span>
                  </span>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
                  />
                </label>
              </div>
              {/* On ne ment pas sur ce que le suivi apporte : sans numéro, le
                  créateur n'aura qu'une date. */}
              <p className="text-xs text-zinc-500">
                Sans numéro de suivi, le créateur verra seulement que le colis est parti.
              </p>
              <button
                type="button"
                onClick={() =>
                  lancer(() => marquerExpedie(dealId, { carrier: transporteur, tracking: numero }))
                }
                disabled={busy}
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "📦 J'ai expédié le produit"}
              </button>
            </>
          )}
        </div>
      )}

      {/* En transit */}
      {shippedAt && !receivedAt && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              📦 Expédié le {new Date(shippedAt).toLocaleDateString("fr-FR")}
              {carrier && <> · {carrier}</>}
            </p>
            {tracking && (
              <p className="mt-1 text-xs text-blue-800">
                Suivi : <span className="font-mono">{tracking}</span>
                {suivi && (
                  <>
                    {" · "}
                    <a
                      href={suivi}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      Suivre le colis
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          {role === "creator" ? (
            <button
              type="button"
              onClick={() => lancer(() => confirmerReception(dealId))}
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "✅ J'ai bien reçu le produit"}
            </button>
          ) : (
            <p className="text-xs text-zinc-500">
              En attente de la confirmation de réception par le créateur. Son délai de production ne
              commence réellement qu&apos;à ce moment-là.
            </p>
          )}
        </div>
      )}

      {/* Reçu */}
      {receivedAt && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">
            ✅ Reçu le {new Date(receivedAt).toLocaleDateString("fr-FR")}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            {role === "creator"
              ? "Tu peux produire ton contenu."
              : "Le créateur a le produit : la production peut commencer."}
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
