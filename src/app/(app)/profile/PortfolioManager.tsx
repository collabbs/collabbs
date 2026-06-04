"use client";

import { useState } from "react";
import Link from "next/link";
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
  view_count?: number | null;
  duration_seconds?: number | null;
  is_short?: boolean;
};

function fmtViews(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDuration(sec: number | null | undefined): string | null {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const mm = Math.floor((sec % 3600) / 60);
    return `${h}:${String(mm).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PortfolioManager({
  initial,
  defaultYouTubeHandle = "",
  publicHandle = null,
}: {
  initial: PortfolioItem[];
  defaultYouTubeHandle?: string;
  publicHandle?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<PortfolioItem[]>(initial);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytInput, setYtInput] = useState(defaultYouTubeHandle);
  const [manualOpen, setManualOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);

  async function onYouTubeImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !ytInput.trim()) return;
    setBusy(true);
    const res = await importYouTubeVideos(ytInput);
    setBusy(false);
    if (res.ok) {
      toast.success(
        `${res.imported} vidéo${res.imported && res.imported > 1 ? "s" : ""} importée${res.imported && res.imported > 1 ? "s" : ""} 🎉`,
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
      toast.success("Vidéo ajoutée.");
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
      {/* Header simple */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            Mon portfolio{" "}
            {items.length > 0 && (
              <span className="text-zinc-400">({items.length})</span>
            )}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Quelques vidéos pour que les marques voient ton style.
          </p>
        </div>
        {publicHandle && (
          <Link
            href={`/creators/${publicHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-zinc-200"
          >
            👁 Voir ma fiche publique
          </Link>
        )}
      </div>

      {/* CTAs compact en 1 ligne */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setYtOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
        >
          <PlatformIcon slug="youtube" className="h-4 w-4 text-white" />
          Importer depuis YouTube
        </button>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-ink transition hover:bg-zinc-200"
        >
          + Ajouter manuellement
        </button>
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
          <span className="opacity-60">🔜</span>
          TikTok et Instagram bientôt (validation officielle en cours)
        </span>
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
              <PlatformIcon slug="youtube" className="h-7 w-7 shrink-0" />
              <div>
                <h3 className="font-display text-lg font-black text-ink">
                  Importer depuis YouTube
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  On récupère tes 10 dernières vidéos avec leurs vues et durée.
                  Tu pourras supprimer celles que tu ne veux pas garder.
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
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !ytInput.trim()}
                  className="rounded-full bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Import en cours…" : "Importer mes vidéos"}
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

      {/* ============ Modale ajout manuel ============ */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && setManualOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl">
            <h3 className="font-display text-lg font-black text-ink">
              Ajouter une vidéo manuellement
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Insta, TikTok, YouTube, Twitch — on détecte la plateforme
              automatiquement.
            </p>
            <form onSubmit={onAddManual} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  URL de la vidéo *
                </label>
                <input
                  type="url"
                  required
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@toi/video/..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700">
                  Titre court (optionnel)
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
                  placeholder="https://… capture d'écran"
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !url.trim()}
                  className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Ajout…" : "Ajouter au portfolio"}
                </button>
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
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

      {/* ============ Liste compacte des items ============ */}
      {items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-6 text-center">
          <p className="text-3xl">🎬</p>
          <p className="mt-2 text-sm font-medium text-ink">
            Pas encore de vidéo dans ton portfolio
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Importe ton YouTube ou ajoute-en 3-5 manuellement — ça change
            tout pour ta visibilité.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const views = fmtViews(it.view_count);
            const dur = fmtDuration(it.duration_seconds);
            const short = it.is_short;
            return (
              <div
                key={it.id}
                className="group overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200">
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
                            className="h-10 w-10 opacity-60"
                          />
                        ) : (
                          <span className="text-4xl opacity-60">🎬</span>
                        )}
                      </div>
                    )}

                    {/* Overlay stats sur la thumb */}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2">
                      {views ? (
                        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                          👁 {views}
                        </span>
                      ) : (
                        <span />
                      )}
                      <div className="flex gap-1">
                        {short && (
                          <span className="rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                            Short
                          </span>
                        )}
                        {dur && (
                          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                            {dur}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover overlay "▶ Voir" */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                      <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-ink opacity-0 shadow-md transition group-hover:opacity-100">
                        ▶ Voir
                      </span>
                    </div>
                  </div>
                </a>
                {it.title && (
                  <div className="px-3 py-2">
                    <p className="line-clamp-2 text-xs font-medium text-zinc-700">
                      {it.title}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-1.5">
                  {it.platform_slug ? (
                    <PlatformIcon
                      slug={it.platform_slug}
                      className="h-3.5 w-3.5 opacity-70"
                    />
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(it.id)}
                    disabled={busy}
                    className="text-[10px] font-medium text-zinc-400 hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
