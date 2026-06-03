"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  setDeliverableApproved,
  setDeliverableSubmission,
  recordDeliverableFiles,
  removeDeliverableFile,
} from "../actions";

export type DealFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  signedUrl: string | null;
};

export type Deliverable = {
  id: string;
  label: string;
  done: boolean;
  approved: boolean;
  position: number;
  submissionUrl: string | null;
  submissionNotes: string | null;
  submissionFiles: DealFile[];
  revisionRequested?: boolean;
  revisionMessage?: string | null;
};

const ACCEPTED =
  "video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif,application/pdf,application/zip";
const MAX_BYTES = 500 * 1024 * 1024; // 500 Mo / fichier

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export default function DeliverableRow({
  d,
  dealId,
  role,
  status,
  busy,
  onAction,
  revisionPanel,
}: {
  d: Deliverable;
  dealId: string;
  role: "brand" | "creator";
  status: "negotiation" | "active" | "completed" | "cancelled";
  busy: boolean;
  onAction: (fn: () => Promise<{ ok: boolean; error?: string }>) => Promise<void>;
  /** Panneau cliquable côté marque pour demander une retouche (rendu par DealControls). */
  revisionPanel?: React.ReactNode;
}) {
  const submitted = Boolean(d.submissionUrl) || d.submissionFiles.length > 0;
  const isCreatorActive = role === "creator" && status === "active";
  const canEdit = isCreatorActive && !d.approved;
  const [editing, setEditing] = useState(!submitted);
  const [url, setUrl] = useState(d.submissionUrl ?? "");
  const [notes, setNotes] = useState(d.submissionNotes ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function submitUrl() {
    await onAction(async () => {
      const res = await setDeliverableSubmission(d.id, url, notes);
      if (res.ok) setEditing(false);
      return res;
    });
  }

  async function handleFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    // Validations rapides côté client (Storage rejette quand même si abusif).
    for (const f of files) {
      if (f.size > MAX_BYTES) {
        setUploadError(
          `${f.name} fait ${(f.size / (1024 * 1024)).toFixed(0)} Mo (max 500 Mo). Compresse-la dans un éditeur ou exporte en 720p / bitrate plus bas.`,
        );
        return;
      }
    }

    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    const uploaded: DealFile[] = [];
    for (const f of files) {
      const unique = `${crypto.randomUUID()}-${safeName(f.name)}`;
      const path = `${dealId}/${d.id}/${unique}`;
      const { error } = await supabase.storage.from("deliverables").upload(path, f, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (error) {
        setUploadError(`Upload échoué : ${error.message}`);
        setUploading(false);
        return;
      }
      uploaded.push({
        path,
        name: f.name,
        size: f.size,
        mime: f.type || "application/octet-stream",
        signedUrl: null,
      });
    }

    await onAction(async () => {
      const res = await recordDeliverableFiles(d.id, uploaded);
      if (res.ok) {
        setEditing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return res;
    });
    setUploading(false);
  }

  return (
    <li className="rounded-xl border border-zinc-100 p-3.5">
      {/* Bandeau retouche demandée — visible des 2 côtés, prioritaire */}
      {d.revisionRequested && !d.approved && d.revisionMessage && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-800">
            {role === "creator" ? "↺ Retouche demandée par la marque" : "↺ Retouche demandée"}
          </p>
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-amber-700">
            « {d.revisionMessage} »
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{d.label}</span>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              d.done ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {d.done ? "Livré" : "À livrer"}
          </span>
          {role === "brand" && status === "active" && d.done && !d.approved ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction(() => setDeliverableApproved(d.id, true))}
                className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                ✓ Valider
              </button>
            </div>
          ) : (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                d.approved ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-400"
              }`}
            >
              {d.approved ? "Validé" : "Non validé"}
            </span>
          )}
        </div>
      </div>

      {/* Aperçu des fichiers déposés */}
      {d.submissionFiles.length > 0 && !editing && (
        <ul className="mt-3 space-y-2">
          {d.submissionFiles.map((f) => (
            <FilePreview key={f.path} file={f} canRemove={canEdit} onRemove={async () => {
              await onAction(() => removeDeliverableFile(d.id, f.path));
            }} />
          ))}
        </ul>
      )}

      {/* Lien + notes en mode lecture */}
      {d.submissionUrl && !editing && (
        <div className="mt-2.5 space-y-1.5">
          <a
            href={d.submissionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            🔗 Voir la publication ↗
          </a>
          {d.submissionNotes && (
            <p className="text-xs text-zinc-500">« {d.submissionNotes} »</p>
          )}
        </div>
      )}

      {submitted && !editing && canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-[11px] font-medium text-zinc-400 hover:text-ink hover:underline"
        >
          Modifier / ajouter
        </button>
      )}

      {/* Panneau retouches côté marque (rendu par DealControls quand applicable) */}
      {revisionPanel && (
        <div className="mt-3 border-t border-zinc-100 pt-3">{revisionPanel}</div>
      )}

      {/* Éditeur : lien + notes + fichier */}
      {canEdit && editing && (
        <div className="mt-3 space-y-3 rounded-lg bg-zinc-50 p-3">
          {/* Lien publication */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Lien de ta publication (optionnel si fichier)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@toi/video/..."
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Note pour la marque (optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Caption, contexte, points d'attention…"
              className="mt-1 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>

          {/* Upload fichier */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Joindre un fichier (vidéo MP4, image, PDF, ZIP — 500 Mo max)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
              className="mt-1 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:opacity-90"
            />
            {uploading && (
              <p className="mt-1.5 text-xs text-zinc-500">⏳ Upload en cours…</p>
            )}
            {uploadError && (
              <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={submitUrl}
              disabled={busy || (!url.trim() && d.submissionFiles.length === 0)}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {submitted ? "Enregistrer les changements" : "Déposer & marquer livré"}
            </button>
            {submitted && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setUrl(d.submissionUrl ?? "");
                  setNotes(d.submissionNotes ?? "");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      )}

      {/* Brand en attente */}
      {role === "brand" && status === "active" && !submitted && (
        <p className="mt-2 text-xs text-zinc-400">
          En attente du dépôt du contenu par le créateur.
        </p>
      )}
    </li>
  );
}

// ====== Aperçu d'un fichier ====== //

function FilePreview({
  file,
  canRemove,
  onRemove,
}: {
  file: DealFile;
  canRemove: boolean;
  onRemove: () => void | Promise<void>;
}) {
  const isVideo = file.mime.startsWith("video/");
  const isImage = file.mime.startsWith("image/");
  const isPdf = file.mime === "application/pdf";

  return (
    <li className="rounded-lg border border-zinc-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
          <p className="text-[11px] text-zinc-400">
            {humanSize(file.size)} · {file.mime || "fichier"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {file.signedUrl && (
            <a
              href={file.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={file.name}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
            >
              {isVideo || isImage || isPdf ? "Ouvrir" : "Télécharger"}
            </a>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:text-red-600"
              aria-label="Retirer"
              title="Retirer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Aperçu intégré quand possible */}
      {file.signedUrl && isVideo && (
        <video
          controls
          src={file.signedUrl}
          className="mt-2 max-h-72 w-full rounded-md bg-black object-contain"
        />
      )}
      {file.signedUrl && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.signedUrl}
          alt={file.name}
          className="mt-2 max-h-72 w-auto rounded-md object-contain"
        />
      )}
    </li>
  );
}
