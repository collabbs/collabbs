"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import PlatformIcon from "@/components/PlatformIcon";
import { createCampaign, type CampaignType } from "../actions";

type Niche = { id: number; label: string };
type Platform = { id: number; label: string; slug: string };
type TierKey = "nano" | "micro" | "mid" | "macro";

const TIERS: { key: TierKey; label: string; range: string }[] = [
  { key: "nano", label: "Nano", range: "< 10k" },
  { key: "micro", label: "Micro", range: "10k–50k" },
  { key: "mid", label: "Mid", range: "50k–200k" },
  { key: "macro", label: "Macro", range: "> 200k" },
];

const TYPES: { id: CampaignType; emoji: string; label: string; desc: string }[] = [
  { id: "affiliation", emoji: "🔗", label: "Affiliation", desc: "Commission sur les ventes" },
  { id: "video", emoji: "🎬", label: "Paiement fixe", desc: "Montant fixe par contenu" },
  { id: "performance", emoji: "📊", label: "Performance", desc: "Payé aux vues générées" },
  { id: "hybrid", emoji: "✨", label: "Hybride", desc: "Fixe + commission" },
];

export default function CampaignForm({
  niches,
  platforms,
  defaultCommission,
}: {
  niches: Niche[];
  platforms: Platform[];
  defaultCommission: Record<TierKey, number>;
}) {
  const router = useRouter();
  const [type, setType] = useState<CampaignType>("affiliation");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [perfRate, setPerfRate] = useState("");
  const [nicheIds, setNicheIds] = useState<number[]>([]);
  const [platformIds, setPlatformIds] = useState<number[]>([]);
  const [minSubs, setMinSubs] = useState("");
  const [spots, setSpots] = useState("");
  const [commission, setCommission] = useState<Record<TierKey, string>>({
    nano: String(defaultCommission.nano),
    micro: String(defaultCommission.micro),
    mid: String(defaultCommission.mid),
    macro: String(defaultCommission.macro),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withAffiliation = type === "affiliation" || type === "hybrid";
  const withFixed = type === "video" || type === "hybrid";
  const isPerformance = type === "performance";

  const toggle = (arr: number[], id: number) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  async function submit() {
    setError(null);
    setSaving(true);
    const num = (v: string, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    const res = await createCampaign({
      type,
      name: name.trim(),
      description: description.trim(),
      requirements: requirements.trim(),
      fixedAmount: fixedAmount ? Number(fixedAmount) : null,
      perfRate: perfRate ? Number(perfRate) : null,
      minSubscribers: minSubs ? Number(minSubs) : null,
      spots: spots ? Number(spots) : null,
      commission: {
        nano: num(commission.nano, 3),
        micro: num(commission.micro, 5),
        mid: num(commission.mid, 8),
        macro: num(commission.macro, 12),
      },
      niches: nicheIds,
      platforms: platformIds,
    });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(res.error ?? "Une erreur est survenue.");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-400 transition hover:text-ink"
        >
          Annuler
        </Link>
      </div>

      <h1 className="mt-8 font-display text-3xl font-black tracking-tight text-ink">
        Nouvelle campagne
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Les créateurs qui correspondent la verront et pourront candidater ou activer
        leur lien d&apos;affiliation.
      </p>

      {/* Type de campagne */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TYPES.map((t) => {
          const active = type === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? "border-transparent bg-gradient-to-br from-purple-50 to-pink-50 ring-2 ring-purple-300"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <span className="text-xl">{t.emoji}</span>
              <p className="mt-1 text-sm font-semibold text-ink">{t.label}</p>
              <p className="text-xs text-zinc-500">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Brief */}
      <div className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink">
            Nom de la campagne
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Lancement gamme été"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Présente ton produit, l'offre, le message clé…"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Ce que tu attends des créateurs{" "}
            <span className="text-zinc-400">(optionnel)</span>
          </label>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
            placeholder="Ex : mention en story + lien en bio, ton authentique…"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Ciblage */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Ciblage
      </h2>
      <div className="mt-3">
        <label className="block text-sm font-medium text-ink">Niches</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {niches.map((n) => {
            const active = nicheIds.includes(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setNicheIds((c) => toggle(c, n.id))}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium text-ink">Réseaux</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {platforms.map((p) => {
            const active = platformIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatformIds((c) => toggle(c, p.id))}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <PlatformIcon slug={p.slug} className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">
            Abonnés min. <span className="text-zinc-400">(optionnel)</span>
          </label>
          <input
            value={minSubs}
            onChange={(e) => setMinSubs(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Ex : 10000"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Places <span className="text-zinc-400">(optionnel)</span>
          </label>
          <input
            value={spots}
            onChange={(e) => setSpots(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="Ex : 20"
            className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Budget fixe (vidéo / hybride) */}
      {withFixed && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Budget
          </h2>
          <label className="mt-3 block text-sm font-medium text-ink">
            Montant fixe par créateur
          </label>
          <div className="mt-1.5 flex w-48 items-center rounded-lg border border-zinc-300 px-3">
            <input
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="500"
              className="w-full py-2.5 text-sm outline-none"
            />
            <span className="text-sm text-zinc-400">€</span>
          </div>
        </div>
      )}

      {/* Performance (payé aux vues) */}
      {isPerformance && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Rémunération à la performance
          </h2>
          <label className="mt-3 block text-sm font-medium text-ink">
            Montant par tranche de vues
          </label>
          <div className="mt-1.5 flex w-56 items-center gap-2 rounded-lg border border-zinc-300 px-3">
            <input
              value={perfRate}
              onChange={(e) => setPerfRate(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="5"
              className="w-full py-2.5 text-sm outline-none"
            />
            <span className="whitespace-nowrap text-sm text-zinc-400">
              € / 1000 vues
            </span>
          </div>
        </div>
      )}

      {/* Commission (affiliation / hybride) */}
      {withAffiliation && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Commission d&apos;affiliation
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Le % reversé au créateur sur chaque vente, selon sa taille d&apos;audience.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TIERS.map((t) => (
              <div key={t.key} className="rounded-xl border border-zinc-200 p-3">
                <p className="text-sm font-semibold text-ink">{t.label}</p>
                <p className="text-xs text-zinc-400">{t.range}</p>
                <div className="mt-2 flex items-center rounded-lg border border-zinc-300 px-2">
                  <input
                    value={commission[t.key]}
                    onChange={(e) =>
                      setCommission((c) => ({
                        ...c,
                        [t.key]: e.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                      }))
                    }
                    inputMode="numeric"
                    className="w-full py-2 text-right text-sm outline-none"
                  />
                  <span className="text-sm text-zinc-400">%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={name.trim().length === 0 || saving}
          className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Publication…" : "Publier la campagne"}
        </button>
      </div>
    </main>
  );
}
