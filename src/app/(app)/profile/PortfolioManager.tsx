"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlatformIcon from "@/components/PlatformIcon";
import { useToast } from "@/components/Toast";
import { addPortfolioItem, removePortfolioItem } from "./portfolio-actions";

export type PortfolioItem = {
  id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  platform_slug: string | null;
};

export default function PortfolioManager({
  initial,
}: {
  initial: PortfolioItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<PortfolioItem[]>(initial);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
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
      setOpen(false);
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-black text-ink">
            Mon portfolio
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Ajoute tes meilleures vidéos pour que les marques voient
            concrètement ton style. Insta, TikTok, YouTube — tous les
            formats acceptés.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
          >
            + Ajouter une vidéo
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
              Insta, TikTok, YouTube, Twitch — on détecte automatiquement.
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
            <p className="mt-1 text-[11px] text-zinc-400">
              Si fournie, ta vignette s&apos;affichera. Sinon une icône par
              défaut.
            </p>
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
                setOpen(false);
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

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-zinc-50/50 p-4 text-center text-sm italic text-zinc-500">
          Pas encore de vidéo dans ton portfolio. Ajoute-en 3-5 pour
          significativement augmenter tes chances d&apos;être contacté·e.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm"
            >
              <div className="relative aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200">
                {it.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.thumbnail_url}
                    alt={it.title ?? ""}
                    className="h-full w-full object-cover"
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
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/30"
                  aria-label="Voir la vidéo"
                >
                  <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-ink opacity-0 shadow-md transition hover:bg-white group-hover:opacity-100">
                    ▶ Voir
                  </span>
                </a>
              </div>
              <div className="p-3">
                {it.title && (
                  <p className="text-sm font-bold text-ink">{it.title}</p>
                )}
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate font-mono text-[11px] text-zinc-500 hover:text-brand hover:underline"
                >
                  {it.url.replace(/^https?:\/\//, "")}
                </a>
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
      )}
    </section>
  );
}
