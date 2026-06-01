"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleSavedCreator } from "@/app/(app)/shortlist/actions";

export default function SaveCreatorButton({
  creatorId,
  initialSaved,
}: {
  creatorId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // empêche la navigation vers la fiche du créateur quand on clique sur le cœur
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const res = await toggleSavedCreator(creatorId);
    setBusy(false);
    if (res.ok) {
      setSaved(Boolean(res.saved));
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? "Retirer de ma shortlist" : "Sauver dans ma shortlist"}
      title={saved ? "Retirer de ma shortlist" : "Sauver dans ma shortlist"}
      className={`absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition disabled:opacity-50 ${
        saved
          ? "bg-pink-500 text-white hover:bg-pink-600"
          : "bg-white/95 text-zinc-500 hover:bg-white hover:text-pink-500"
      }`}
    >
      <span aria-hidden className="text-sm">
        {saved ? "❤" : "🤍"}
      </span>
    </button>
  );
}
