"use client";

import { useState } from "react";

/**
 * Zone de saisie. Elle ne connaît ni Supabase ni la Server Action : c'est le
 * fil (`Thread`) qui possède l'état des messages, donc lui seul peut afficher
 * l'envoi en optimiste et le retirer si la base refuse. Le composant se
 * contente de la saisie et de l'erreur à afficher.
 */
export default function Composer({
  onSend,
}: {
  onSend: (text: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    // On vide la zone tout de suite : le message est déjà visible dans le fil.
    setBody("");

    const res = await onSend(text);
    setBusy(false);
    if (!res.ok) {
      // L'envoi a échoué : on rend son texte à l'utilisateur plutôt que de le
      // laisser recopier un message qu'il croyait parti.
      setBody(text);
      setError(res.error ?? "Erreur.");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-zinc-100 bg-white p-3">
      {error && <p className="mb-2 px-1 text-xs text-red-600">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Écris ton message…  (Entrée pour envoyer)"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !body.trim()}
          className="shrink-0 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "…" : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
