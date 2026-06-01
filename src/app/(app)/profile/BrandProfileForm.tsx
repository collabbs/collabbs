"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveBrandOnboarding } from "@/app/onboarding/actions";

export default function BrandProfileForm({
  userId,
  initial,
}: {
  userId: string;
  initial: {
    name: string;
    sector: string;
    website: string;
    logoUrl: string | null;
  };
}) {
  const [name, setName] = useState(initial.name);
  const [sector, setSector] = useState(initial.sector);
  const [website, setWebsite] = useState(initial.website);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  const hasLogo = Boolean(logoPreview);
  const completion =
    (name.trim() ? 30 : 0) +
    (hasLogo ? 30 : 0) +
    (sector.trim() ? 20 : 0) +
    (website.trim() ? 20 : 0);
  const ready = name.trim().length > 0 && hasLogo;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      let logoUrl = initial.logoUrl;
      if (logoFile) {
        const supabase = createClient();
        const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
        const path = `${userId}/logo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, logoFile, { upsert: true, cacheControl: "3600" });
        if (upErr) {
          setError("Le logo n'a pas pu être envoyé. Réessaie.");
          setSaving(false);
          return;
        }
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        logoUrl = `${data.publicUrl}?v=${Date.now()}`;
      }

      const res = await saveBrandOnboarding({
        name: name.trim(),
        sector: sector.trim(),
        website: website.trim(),
        logoUrl,
      });

      if (res.ok) {
        setSavedAt(Date.now());
        setLogoFile(null);
        if (logoUrl) setLogoPreview(logoUrl);
      } else {
        setError(res.error ?? "Une erreur est survenue.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      {/* En-tête */}
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Mon profil
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Ce que les créateurs voient quand tu les contactes.
        </p>
      </div>

      {/* Jauge de complétion */}
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-ink">Profil {completion}% complet</span>
          <span className={ready ? "text-emerald-600" : "text-zinc-400"}>
            {ready ? "✓ Prêt à collaborer" : "À compléter"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* Toast confirmation */}
      {savedAt && (
        <div
          key={savedAt}
          className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          <span>✓</span>
          <span className="font-medium">Modifications enregistrées.</span>
        </div>
      )}

      {/* Section unique */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Ma marque</h2>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 ring-2 ring-white"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-medium text-zinc-500">Logo</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
          >
            {logoPreview ? "Changer le logo" : "Ajouter un logo"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={onPickLogo}
            className="hidden"
          />
        </div>

        <label className="mt-6 block text-sm font-medium text-ink">Nom de la marque</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Lumi Cosmetics"
          className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
        />

        <label className="mt-5 block text-sm font-medium text-ink">Secteur</label>
        <input
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Ex : Beauté, SaaS, Mode, Food…"
          className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
        />

        <label className="mt-5 block text-sm font-medium text-ink">Site web</label>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          inputMode="url"
          placeholder="https://…"
          className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
        />
      </section>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {/* Barre d'action sticky */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3 px-1">
          <span className="hidden text-sm text-zinc-500 sm:inline">
            {ready
              ? "Tes modifs sont prêtes."
              : "Renseigne au moins le nom et le logo."}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
