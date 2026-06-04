"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlatformIcon from "@/components/PlatformIcon";
import { useToast } from "@/components/Toast";
import { addPortfolioItem, removePortfolioItem } from "./portfolio-actions";
import { importYouTubeVideos } from "./youtube-import-actions";

export type PortfolioItem = {
  id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  platform_slug: string | null;
};

/**
 * Section "Mon portfolio" sur /profile créateur.
 *
 * Structure :
 * 1. Trois cards "Import automatique" en haut (YouTube actif, TikTok/Insta
 *    validation en cours)
 * 2. En dessous : "Curation manuelle" — l'ancien manager
 *
 * Le manuel n'est pas un fallback : c'est l'option "choisis tes meilleures
 * vidéos toi-même" qui a sa propre valeur.
 */
export default function PortfolioManager({
  initial,
  defaultYouTubeHandle = "",
}: {
  initial: PortfolioItem[];
  /** @handle YouTube si renseigné dans creator_platforms (pré-rempli) */
  defaultYouTubeHandle?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<PortfolioItem[]>(initial);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytInput, setYtInput] = useState(defaultYouTubeHandle);
  const [busy, setBusy] = useState(false);

  // Manuel
  const [manualOpen, setManualOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState("");

  async function onYouTubeImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !ytInput.trim()) return;
    setBusy(true);
    const res = await importYouTubeVideos(ytInput);
    setBusy(false);
    if (res.ok) {
      toast.success(
        `${res.imported} vidéo${res.imported && res.imported > 1 ? "s" : ""} YouTube importée${res.imported && res.imported > 1 ? "s" : ""} 🎉`,
      );
      setYtOpen(false);
      setYtInput("");
      router.refresh();
    } else {
      toast.error(res.error ?? "Échec de l'import.");
    }
  }

  async function onAddManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await addPortfolioItem(url, title, thumb);
    setBusy(false);
    if (res.ok) {
      toast.success("Vidéo ajoutée au portfolio.");
      setUrl("");
      setTitle("");
      setThumb("");
      setManualOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Échec.");
    }
  }

  async function onRemove(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await removePortfolioItem(id);
    setBusy(false);
    if (res.ok) {
      setItems((cur) => cur.filter((it) => it.id !== id));
      toast.success("Supprimé.");
      router.refresh();
    } else {
      toast.error(res.error ?? "Échec.");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="font-display text-lg font-black text-ink">
          Mon portfolio
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Quelques vidéos pour que les marques voient ton style.{" "}
          <strong>Un bon portfolio change tout</strong> — les profils avec
          contenu reçoivent beaucoup plus de propositions.
        </p>
      </div>

      {/* ============ Import automatique ============ */}
      <div className="mt-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          🎥 Import automatique
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {/* YouTube — actif */}
          <button
            type="button"
            onClick={() => setYtOpen(true)}
            className="group flex items-center gap-3 rounded-xl border border-red-100 bg-gradient-to-br from-red-50/60 to-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-red-100">
              <PlatformIcon slug="youtube" className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                YouTube
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                  ✓ Actif
                </span>
              </p>
              <p className="text-[11px] text-zinc-500">
                Importe tes 10 dernières vidéos
              </p>
            </div>
            <span className="text-xs text-zinc-300 group-hover:text-brand">
              →
            </span>
          </button>

          {/* TikTok — bientôt */}
          <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/40 p-3 opacity-75">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
              <PlatformIcon slug="tiktok" className="h-6 w-6 opacity-60" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-zinc-500">
                TikTok
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                  🔜 ~6 sem.
                </span>
              </p>
              <p className="text-[11px] text-zinc-500">Validation officielle en cours</p>
            </div>
          </div>

          {/* Instagram — bientôt */}
          <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/40 p-3 opacity-75">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-100">
              <PlatformIcon slug="instagram" className="h-6 w-6 opacity-60" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-zinc-500">
                Instagram
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                  🔜 ~6 sem.
                </span>
              </p>
              <p className="text-[11px] text-zinc-500">Validation Meta en cours</p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] italic text-zinc-400">
          On bosse sur TikTok et Instagram en parallèle — leurs validations
          officielles prennent 4 à 6 semaines. En attendant, ajoute tes
          meilleures vidéos manuellement.
        </p>
      </div>

      {/* ============ Modale YouTube ============ */}
      {ytOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && setYtOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <PlatformIcon slug="youtube" className="h-8 w-8 shrink-0" />
              <div>
                <h3 className="font-display text-lg font-black text-ink">
                  Importer depuis YouTube
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Tes 10 dernières vidéos publiques seront ajoutées avec
                  leur vignette. Tu pourras supprimer celles que tu ne veux
                  pas garder.
                </p>
              </div>
            </div>
            <form onSubmit={onYouTubeImport} className="mt-4 space-y-3">
              <div>
                <label
                  className="block text-xs font-semibold text-zinc-700"
                  htmlFor="yt_input"
                >
                  URL ou @handle de ta chaîne
                </label>
                <input
                  id="yt_input"
                  type="text"
                  required
                  autoFocus
                  value={ytInput}
                  onChange={(e) => setYtInput(e.target.value)}
                  placeholder="@TonHandle ou youtube.com/@TonHandle"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Exemples : <code>@MrBeast</code>,{" "}
                  <code>youtube.com/@TonNom</code>, ou l&apos;URL complète.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !ytInput.trim()}
                  className="rounded-full bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Import en cours…" : "🎥 Importer mes vidéos"}
                </button>
                <button
                  type="button"
                  onClick={() => setYtOpen(false)}
                  disabled={busy}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ Curation manuelle ============ */}
      <div className="mt-6 border-t border-zinc-100 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              ✍️ Curation manuelle
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Choisis exactement quelles vidéos mettre en avant.
            </p>
          </div>
          {!manualOpen && (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
            >
              + Ajouter une vidéo
            </button>
          )}
        </div>

        {manualOpen && (
          <form
            onSubmit={onAddManual}
            className="mt-3 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50/40 p-4"
          >
            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                URL de la vidéo *
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@toi/video/..."
                className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Insta, TikTok, YouTube, Twitch — on détecte automatiquement
                la plateforme.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                Titre / description courte
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Hook avant/après produit beauté"
                maxLength={80}
                className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700">
                URL de la vignette (optionnel)
              </label>
              <input
                type="url"
                value={thumb}
                onChange={(e) => setThumb(e.target.value)}
                placeholder="https://… (capture d'écran de la vidéo)"
                className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !url.trim()}
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Ajout…" : "Ajouter au portfolio"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualOpen(false);
                  setUrl("");
                  setTitle("");
                  setThumb("");
                }}
                className="rounded-full px-4 py-2 text-xs font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ============ Liste des items ============ */}
      {items.length === 0 ? (
        <p className="mt-5 rounded-xl bg-zinc-50/50 p-4 text-center text-sm italic text-zinc-500">
          Pas encore de vidéo dans ton portfolio. Importe ton YouTube ou
          ajoute-en 3-5 manuellement pour augmenter significativement tes
          chances d&apos;être contacté·e.
        </p>
      ) : (
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Ton portfolio ({items.length})
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm"
              >
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="relative aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200">
                    {it.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.thumbnail_url}
                        alt={it.title ?? ""}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {it.platform_slug ? (
                          <PlatformIcon
                            slug={it.platform_slug}
                            className="h-12 w-12 opacity-60"
                          />
                        ) : (
                          <span className="text-4xl opacity-60">🎬</span>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                      <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-ink opacity-0 shadow-md transition group-hover:opacity-100">
                        ▶ Voir
                      </span>
                    </div>
                  </div>
                </a>
                <div className="p-3">
                  {it.title && (
                    <p className="line-clamp-2 text-sm font-bold text-ink">
                      {it.title}
                    </p>
                  )}
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">
                    {it.url.replace(/^https?:\/\//, "")}
                  </p>
                  <button
                    type="button"
                    onClick={() => onRemove(it.id)}
                    disabled={busy}
                    className="mt-2 text-[11px] font-medium text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
