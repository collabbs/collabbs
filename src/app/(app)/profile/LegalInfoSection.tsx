"use client";

import { useState } from "react";
import { saveLegalInfo } from "./legal-actions";
import { LEGAL_STATUSES, type LegalInfoData } from "./legal-utils";

/**
 * Section "Infos légales" — partagée brand + creator.
 * S'auto-sauve via son propre bouton (indépendant du save global du profil),
 * car ces infos sont transversales (contrats, factures) et le user peut
 * vouloir juste les remplir une fois sans toucher au reste.
 */
export default function LegalInfoSection({
  initial,
  role,
}: {
  initial: LegalInfoData;
  role: "creator" | "brand";
}) {
  const [data, setData] = useState<LegalInfoData>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isProStatus = data.status && data.status !== "individual";
  const set = <K extends keyof LegalInfoData>(k: K, v: LegalInfoData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await saveLegalInfo(data);
      if (res.ok) setSavedAt(Date.now());
      else setError(res.error ?? "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  const completeBase = Boolean(
    data.status && data.legalName.trim() && data.address.trim() && data.city.trim() && data.zip.trim(),
  );

  return (
    <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            Infos légales · contrats
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Remplies <strong>1 seule fois</strong>. Tous tes contrats futurs
            s&apos;auto-rempliront avec ces infos — comme ça plus jamais à les
            re-saisir à chaque collab.
          </p>
        </div>
        {completeBase && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            ✓ Prêt pour contrats
          </span>
        )}
      </div>

      {savedAt && (
        <div
          key={savedAt}
          className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-sm text-emerald-700"
        >
          <span>✓</span>
          <span className="font-medium">Infos légales enregistrées.</span>
        </div>
      )}

      {/* Statut juridique */}
      <label className="mt-5 block text-sm font-medium text-ink">Statut</label>
      <select
        value={data.status}
        onChange={(e) => set("status", e.target.value)}
        className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-400"
      >
        <option value="">— Choisis ton statut —</option>
        {LEGAL_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Nom légal */}
      <label className="mt-5 block text-sm font-medium text-ink">
        {role === "brand" ? "Raison sociale" : "Nom légal complet"}
        <span className="ml-1 text-red-500">*</span>
      </label>
      <input
        value={data.legalName}
        onChange={(e) => set("legalName", e.target.value)}
        placeholder={
          role === "brand"
            ? "Ex : Lumière Cosmétiques SAS"
            : "Prénom Nom (ta vraie identité)"
        }
        className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
      />

      {/* Représentant légal — uniquement si entreprise */}
      {isProStatus && role === "brand" && (
        <>
          <label className="mt-5 block text-sm font-medium text-ink">
            Représentant légal
          </label>
          <input
            value={data.repName}
            onChange={(e) => set("repName", e.target.value)}
            placeholder="Ex : Marie Dupont, Présidente"
            className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
          <p className="mt-1 text-xs text-zinc-400">
            La personne qui signe les contrats au nom de la marque.
          </p>
        </>
      )}

      {/* Adresse */}
      <label className="mt-5 block text-sm font-medium text-ink">
        Adresse <span className="ml-1 text-red-500">*</span>
      </label>
      <input
        value={data.address}
        onChange={(e) => set("address", e.target.value)}
        placeholder="Ex : 12 rue de la Paix"
        className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
      />

      <div className="mt-3 grid max-w-md grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-ink">
            Code postal<span className="ml-1 text-red-500">*</span>
          </label>
          <input
            value={data.zip}
            onChange={(e) => set("zip", e.target.value)}
            placeholder="75002"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-ink">
            Ville<span className="ml-1 text-red-500">*</span>
          </label>
          <input
            value={data.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Paris"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      <label className="mt-5 block text-sm font-medium text-ink">Pays</label>
      <input
        value={data.country}
        onChange={(e) => set("country", e.target.value)}
        placeholder="France"
        className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
      />

      {/* SIRET / TVA si pro */}
      {isProStatus && (
        <>
          <label className="mt-5 block text-sm font-medium text-ink">
            SIRET / SIREN
          </label>
          <input
            value={data.siret}
            onChange={(e) => set("siret", e.target.value.replace(/[^0-9 ]/g, ""))}
            placeholder="14 chiffres (SIRET) ou 9 (SIREN)"
            inputMode="numeric"
            maxLength={16}
            className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />

          <label className="mt-5 block text-sm font-medium text-ink">
            N° TVA intracommunautaire <span className="text-zinc-400">(optionnel)</span>
          </label>
          <input
            value={data.vat}
            onChange={(e) => set("vat", e.target.value.toUpperCase())}
            placeholder="Ex : FR12345678901"
            className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </>
      )}

      <label className="mt-5 block text-sm font-medium text-ink">
        Email de contact <span className="text-zinc-400">(factures, contrats)</span>
      </label>
      <input
        value={data.contactEmail}
        onChange={(e) => set("contactEmail", e.target.value)}
        type="email"
        placeholder="contact@tamarque.com"
        className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
      />

      {error && (
        <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer mes infos légales"}
        </button>
      </div>
    </section>
  );
}
