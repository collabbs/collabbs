"use client";

import { useState, useTransition } from "react";
import { verifyYouTubeAudience } from "./audience-actions";

/**
 * Vérification d'audience côté créateur.
 *
 * Ce qui est en jeu : 81 % des annonceurs ont subi une fraude à l'influence
 * cette année, et l'écart médian entre l'audience promise et l'audience
 * mesurée est de 37 %. Un créateur dont les chiffres sont constatés se
 * distingue immédiatement — c'est un argument commercial, pas une corvée.
 */

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

export default function AudienceVerification({
  verifiedAt,
  verifiedSubscribers,
}: {
  verifiedAt: string | null;
  verifiedSubscribers: number | null;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    gapPct?: number | null;
  } | null>(null);

  const run = () =>
    start(async () => {
      const r = await verifyYouTubeAudience();
      if (!r.ok) {
        setResult({ ok: false, message: r.error ?? "Vérification impossible." });
        return;
      }
      setResult({
        ok: true,
        message: `Audience constatée : ${fmt(r.subscribers ?? 0)} abonnés.`,
        gapPct: r.gapPct,
      });
    });

  const already = Boolean(verifiedAt);

  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Vérifier mon audience</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Les marques se méfient des chiffres déclarés — et elles ont leurs raisons.
            Faire constater ton audience par YouTube te distingue immédiatement de
            ceux qui annoncent ce qui les arrange.
          </p>
        </div>
        {already && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            ✓ Audience vérifiée
          </span>
        )}
      </div>

      {already && (
        <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600">
          {fmt(verifiedSubscribers ?? 0)} abonnés constatés le{" "}
          {new Date(verifiedAt!).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Relance la vérification quand ta chaîne a grandi.
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="mt-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {pending
          ? "Vérification en cours…"
          : already
            ? "Revérifier mon audience YouTube"
            : "Vérifier mon audience YouTube"}
      </button>

      {result && (
        <div
          className={`mt-3 rounded-xl p-3 text-sm ${
            result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          <p>{result.message}</p>
          {result.ok && result.gapPct != null && result.gapPct > 5 && (
            <p className="mt-1 text-emerald-900">
              Ton chiffre déclaré était supérieur de {result.gapPct} %. Il a été aligné
              sur le constat — c&apos;est ce chiffre que les marques verront désormais.
            </p>
          )}
        </div>
      )}

      <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-500">
        Seul YouTube est vérifiable pour l&apos;instant : son API expose
        publiquement le nombre d&apos;abonnés d&apos;une chaîne. TikTok et Instagram
        exigent de connecter le compte, ce qui demande une validation de leur part —
        en attendant, leurs chiffres restent affichés comme déclarés.
        <br />
        Une réserve, dite franchement : cette vérification prouve l&apos;audience de
        la chaîne, pas que tu en sois le propriétaire. La preuve de propriété viendra
        avec la connexion des comptes.
      </p>
    </section>
  );
}
