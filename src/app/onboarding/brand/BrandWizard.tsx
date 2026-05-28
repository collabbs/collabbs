"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import { createClient } from "@/lib/supabase/client";
import { saveBrandOnboarding } from "../actions";

export default function BrandWizard({
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
  const [done, setDone] = useState(false);
  const [name, setName] = useState(initial.name);
  const [sector, setSector] = useState(initial.sector);
  const [website, setWebsite] = useState(initial.website);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function finish() {
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

      if (res.ok) setDone(true);
      else setError(res.error ?? "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  function PreviewCard() {
    const initials = (name || "Marque")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <div className="w-full max-w-[240px] rounded-2xl border border-zinc-100 bg-white p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-lg font-extrabold text-zinc-500">
                {initials}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {name || "Ta marque"}
            </p>
            <p className="truncate text-xs text-zinc-500">{sector || "Secteur"}</p>
          </div>
        </div>
        {website && (
          <p className="mt-4 truncate text-xs text-brand">{website}</p>
        )}
      </div>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-3xl text-white shadow-lg shadow-purple-200">
          🚀
        </div>
        <h1 className="mt-6 font-display text-3xl font-black tracking-tight text-ink">
          Ton espace marque est prêt !
        </h1>
        <p className="mt-2 text-zinc-600">
          Tu peux maintenant parcourir les créateurs et lancer ta première
          collaboration.
        </p>
        <div className="mt-8">
          <PreviewCard />
        </div>
        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/creators"
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Trouver des créateurs
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full px-6 py-3 text-sm font-medium text-zinc-500 transition hover:text-ink"
          >
            Aller à mon tableau de bord
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1fr_280px]">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-400 transition hover:text-ink"
          >
            Plus tard →
          </Link>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-ink">Profil {completion}% complet</span>
            <span className={ready ? "text-emerald-600" : "text-zinc-400"}>
              {ready ? "✓ Prêt à collaborer" : "À compléter"}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        <div className="mt-8 flex-1">
          <h1 className="font-display text-3xl font-black tracking-tight text-ink">
            Présente ta marque
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            C&apos;est ce que les créateurs verront quand tu les contactes. La
            commission, elle, se règle à chaque campagne.
          </p>

          <div className="mt-6 flex items-center gap-4">
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

          <label className="mt-6 block text-sm font-medium text-ink">
            Nom de la marque
          </label>
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
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={finish}
            disabled={name.trim().length === 0 || saving}
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Terminer"}
          </button>
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Aperçu
          </p>
          <PreviewCard />
        </div>
      </aside>
    </main>
  );
}
