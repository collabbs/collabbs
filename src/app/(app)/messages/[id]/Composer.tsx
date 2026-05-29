"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "../actions";

export default function Composer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    const res = await sendMessage(conversationId, text);
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
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
