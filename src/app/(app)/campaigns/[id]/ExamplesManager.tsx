"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  addCampaignExample,
  removeCampaignExample,
} from "../examples-actions";

export type CampaignExample = {
  id: string;
  url: string | null;
  caption: string | null;
};

/**
 * Gestionnaire d'exemples de contenu attendu pour les créateurs.
 * Visible uniquement côté marque sur sa propre campagne.
 */
export default function ExamplesManager({
  campaignId,
  examples,
}: {
  campaignId: string;
  examples: CampaignExample[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await addCampaignExample(campaignId, url, caption);
    setBusy(false);
    if (res.ok) {
      toast.success("Exemple ajouté.");
      setUrl("");
      setCaption("");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Échec.");
    }
  }

  async function onRemove(exId: string) {
    if (busy) return;
    setBusy(true);
    const res = await removeCampaignExample(exId, campaignId);
    setBusy(false);
    if (res.ok) {
      toast.success("Exemple supprimé.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Échec.");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            Exemples de contenu
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Inspire les créateurs. Tu peux coller un lien Instagram, TikTok,
            YouTube, ou décrire ce que tu veux par écrit.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            + Ajouter un exemple
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={onAdd}
          className="mt-4 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/40 p-4"
        >
          <div>
            <label className="block text-xs font-semibold text-zinc-700">
              URL de référence (Insta, TikTok, YT…)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700">
              Description / Ce que tu veux qu&apos;ils retiennent
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Ex : Vidéo style 'avant/après' avec un démarrage rapide dans les 2 premières secondes. Ton décontracté, pas de musique forte."
              className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Ajout…" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setUrl("");
                setCaption("");
              }}
              className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {examples.length === 0 ? (
        <p className="mt-4 rounded-xl bg-zinc-50/50 p-4 text-center text-sm italic text-zinc-500">
          Pas encore d&apos;exemple. Ajoute-en au moins 1 pour vraiment guider
          les créateurs — ça augmente fortement la qualité des candidatures.
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {examples.map((ex) => (
            <div
              key={ex.id}
              className="rounded-xl border border-zinc-100 bg-white p-3"
            >
              {ex.url && (
                <a
                  href={ex.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs font-mono text-brand hover:underline"
                >
                  🔗 {ex.url}
                </a>
              )}
              {ex.caption && (
                <p className="mt-1.5 whitespace-pre-line text-sm text-zinc-700">
                  {ex.caption}
                </p>
              )}
              <button
                type="button"
                onClick={() => onRemove(ex.id)}
                disabled={busy}
                className="mt-2 text-[11px] font-medium text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
