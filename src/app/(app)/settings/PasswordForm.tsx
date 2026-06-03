"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { updatePassword } from "./actions";

export default function PasswordForm() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [newP, setNewP] = useState("");
  const [confirmP, setConfirmP] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await updatePassword(fd);
    setBusy(false);
    if (res.ok) {
      toast.success("Mot de passe mis à jour.");
      setNewP("");
      setConfirmP("");
    } else {
      toast.error(res.error ?? "Échec de la mise à jour.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="new_password">
          Nouveau mot de passe
        </label>
        <input
          id="new_password"
          name="new_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newP}
          onChange={(e) => setNewP(e.target.value)}
          className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          placeholder="8 caractères minimum"
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="confirm_password"
        >
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmP}
          onChange={(e) => setConfirmP(e.target.value)}
          className="mt-1.5 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          placeholder="Retape le mot de passe"
        />
      </div>
      <button
        type="submit"
        disabled={busy || newP.length < 8 || newP !== confirmP}
        className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Mise à jour…" : "Mettre à jour le mot de passe"}
      </button>
    </form>
  );
}
