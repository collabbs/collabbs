"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/landing/Logo";
import PlatformIcon from "@/components/PlatformIcon";
import { createClient } from "@/lib/supabase/client";
import { OFFER_TYPES, OFFER_BY_ID, type OfferId } from "@/components/landing/creators";
import { saveCreatorOnboarding } from "../actions";

type Niche = { id: number; label: string };
type Platform = { id: number; label: string; slug: string };

const STEPS = ["Photo & identité", "Niches", "Réseaux", "Offres & tarifs"];

// Le créateur ne fixe que ses formats à prix fixe.
// Affiliation & performance dépendent de la marque → pas dans l'onboarding.
const CREATOR_OFFERS = OFFER_TYPES.filter(
  (o) => o.id === "ugc" || o.id === "post" || o.id === "story",
);

export default function Wizard({
  userId,
  displayName,
  niches,
  platforms,
  initial,
}: {
  userId: string;
  displayName: string;
  niches: Niche[];
  platforms: Platform[];
  initial: {
    handle: string;
    bio: string;
    avatarUrl: string | null;
    customNiche: string;
  };
}) {
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.avatarUrl);
  const [nicheIds, setNicheIds] = useState<number[]>([]);
  const [customNiche, setCustomNiche] = useState(initial.customNiche);
  const [otherOpen, setOtherOpen] = useState(Boolean(initial.customNiche));
  const [platformSel, setPlatformSel] = useState<
    Record<number, { handle: string; subs: string; url: string }>
  >({});
  const [offerSel, setOfferSel] = useState<Record<string, { price: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const nicheLabel = (id: number) => niches.find((n) => n.id === id)?.label ?? "";

  function toggleNiche(id: number) {
    setNicheIds((cur) =>
      cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id],
    );
  }
  function togglePlatform(id: number) {
    setPlatformSel((cur) => {
      const next = { ...cur };
      if (next[id]) delete next[id];
      else next[id] = { handle: "", subs: "", url: "" };
      return next;
    });
  }
  function bumpSubs(id: number, delta: number) {
    setPlatformSel((cur) => {
      const v = cur[id];
      if (!v) return cur;
      const next = Math.max(0, (Number(v.subs) || 0) + delta);
      return { ...cur, [id]: { ...v, subs: String(next) } };
    });
  }
  function toggleOffer(id: string) {
    setOfferSel((cur) => {
      const next = { ...cur };
      if (next[id]) delete next[id];
      else next[id] = { price: "" };
      return next;
    });
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  const hasPhoto = Boolean(photoPreview);
  const hasNiche = nicheIds.length > 0 || customNiche.trim().length > 0;
  const offerIds = Object.keys(offerSel) as OfferId[];
  const completion =
    (hasPhoto ? 25 : 0) +
    (handle.trim() ? 15 : 0) +
    (hasNiche ? 20 : 0) +
    (Object.keys(platformSel).length ? 20 : 0) +
    (offerIds.length ? 20 : 0);
  const listable = hasPhoto && hasNiche && offerIds.length > 0;

  const prices = offerIds.map((id) => Number(offerSel[id].price)).filter((n) => n > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;

  const canNext =
    step === 0
      ? handle.trim().length > 0
      : step === 1
        ? hasNiche
        : step === 3
          ? offerIds.length > 0
          : true;

  async function finish() {
    setError(null);
    setSaving(true);
    try {
      let avatarUrl = initial.avatarUrl;
      if (photoFile) {
        const supabase = createClient();
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true, cacheControl: "3600" });
        if (upErr) {
          setError("La photo n'a pas pu être envoyée. Réessaie.");
          setSaving(false);
          return;
        }
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      }

      const res = await saveCreatorOnboarding({
        handle: handle.trim(),
        bio: bio.trim(),
        avatarUrl,
        customNiche: customNiche.trim(),
        niches: nicheIds,
        platforms: Object.entries(platformSel).map(([pid, v]) => ({
          platformId: Number(pid),
          handle: v.handle.trim(),
          subscribers: v.subs ? Number(v.subs) : null,
          url: v.url.trim(),
        })),
        offers: offerIds.map((id) => ({
          offer: id,
          price: offerSel[id].price ? Number(offerSel[id].price) : null,
        })),
      });

      if (res.ok) setStep(4);
      else setError(res.error ?? "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  }

  function PreviewCard() {
    const initials = displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const nicheText =
      nicheIds.length > 0
        ? nicheLabel(nicheIds[0]) + (nicheIds.length > 1 ? ` +${nicheIds.length - 1}` : "")
        : customNiche.trim();
    return (
      <div className="w-full max-w-[220px] overflow-hidden rounded-2xl border border-zinc-100 bg-white p-2.5 shadow-lg">
        <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-purple-300 to-pink-300">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="Aperçu" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-3xl font-extrabold text-white/90">
              {initials}
            </span>
          )}
        </div>
        <div className="px-1 pb-1 pt-3">
          <p className="text-sm font-semibold text-ink">{displayName}</p>
          <p className="text-xs text-zinc-500">@{handle || "tonpseudo"}</p>
          {nicheText && (
            <p className="mt-1.5 text-[11px] font-medium text-purple-700">{nicheText}</p>
          )}
          {offerIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {offerIds.map((id) => (
                <span
                  key={id}
                  className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                >
                  {OFFER_BY_ID[id].emoji} {OFFER_BY_ID[id].short}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            {minPrice ? (
              <>
                à partir de <span className="text-sm font-bold text-ink">{minPrice}€</span>
              </>
            ) : (
              <span className="font-semibold text-ink">Tarif à définir</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-3xl text-white shadow-lg shadow-purple-200">
          🎉
        </div>
        <h1 className="mt-6 font-display text-3xl font-black tracking-tight text-ink">
          Ton profil est prêt !
        </h1>
        <p className="mt-2 text-zinc-600">
          {listable
            ? "Tu es maintenant visible par les marques. Elles peuvent te trouver et te proposer des deals."
            : "Ajoute une photo et au moins une offre pour devenir visible par les marques."}
        </p>
        <div className="mt-8">
          <PreviewCard />
        </div>
        <div className="mt-8 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Aller à mon tableau de bord
          </Link>
          <Link
            href="/creators"
            className="rounded-full px-6 py-3 text-sm font-medium text-zinc-500 transition hover:text-ink"
          >
            Explorer la marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[1fr_280px]">
      {/* Colonne formulaire */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-400 transition hover:text-ink"
          >
            Plus tard →
          </Link>
        </div>

        {/* Jauge de complétion */}
        <div className="mt-8">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-ink">Profil {completion}% complet</span>
            <span className={listable ? "text-emerald-600" : "text-zinc-400"}>
              {listable ? "✓ Visible par les marques" : "Non visible"}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Étapes */}
        <div className="mt-6 flex gap-2">
          {STEPS.map((label, i) => (
            <button key={label} type="button" onClick={() => setStep(i)} className="flex-1 text-left">
              <div className={`h-1 rounded-full ${i <= step ? "bg-ink" : "bg-zinc-200"}`} />
              <span
                className={`mt-1 block text-[11px] ${i === step ? "font-semibold text-ink" : "text-zinc-400"}`}
              >
                {label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8 flex-1">
          {/* Étape 1 — Photo & identité */}
          {step === 0 && (
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight text-ink">
                Mets-toi en valeur
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Les marques choisissent d&apos;abord avec les yeux. Une bonne photo
                multiplie tes chances d&apos;être contacté.
              </p>

              <div className="mt-6 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-100 to-pink-100 ring-2 ring-white"
                >
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Ta photo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-purple-700">Ajouter</span>
                  )}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
                  >
                    {photoPreview ? "Changer la photo" : "Choisir une photo"}
                  </button>
                  <p className="mt-1.5 text-xs text-zinc-400">JPG ou PNG, carré idéalement.</p>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  onChange={onPickPhoto}
                  className="hidden"
                />
              </div>

              <label className="mt-6 block text-sm font-medium text-ink">
                Ton identifiant Collabbs
              </label>
              <div className="mt-1.5 flex items-center rounded-lg border border-zinc-300 px-3 focus-within:border-purple-400">
                <span className="text-sm text-zinc-400">@</span>
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, ""))}
                  placeholder="tonpseudo"
                  className="w-full px-1 py-2.5 text-sm outline-none"
                />
              </div>

              <label className="mt-5 block text-sm font-medium text-ink">Ta bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={250}
                placeholder="Ex : Créatrice beauté & lifestyle, je teste des produits et je partage mes favoris à une communauté ultra-engagée."
                className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
              />
              <p className="mt-1 text-right text-xs text-zinc-400">{bio.length}/250</p>
            </div>
          )}

          {/* Étape 2 — Niches */}
          {step === 1 && (
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight text-ink">
                Tes niches
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                C&apos;est ce qui permet aux bonnes marques de te trouver. Choisis-en
                une ou plusieurs.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {niches.map((n) => {
                  const active = nicheIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNiche(n.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-ink text-white"
                          : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      {n.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setOtherOpen((v) => !v)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    otherOpen || customNiche.trim()
                      ? "bg-ink text-white"
                      : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  + Autre
                </button>
              </div>
              {otherOpen && (
                <input
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  maxLength={40}
                  placeholder="Ta niche (ex : Crochet, Crypto, Parentalité…)"
                  className="mt-3 w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-purple-400"
                />
              )}
            </div>
          )}

          {/* Étape 3 — Réseaux */}
          {step === 2 && (
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight text-ink">
                Tes réseaux
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Plus ton audience est renseignée, plus les marques te font confiance.
              </p>
              <div className="mt-6 space-y-3">
                {platforms.map((p) => {
                  const sel = platformSel[p.id];
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border p-3 transition ${
                        sel ? "border-purple-200 bg-purple-50/40" : "border-zinc-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className="flex w-full items-center gap-3"
                      >
                        <PlatformIcon slug={p.slug} className="h-5 w-5 shrink-0" />
                        <span className="flex-1 text-left text-sm font-medium text-ink">
                          {p.label}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
                            sel ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-zinc-300"
                          }`}
                        >
                          {sel ? "✓" : "+"}
                        </span>
                      </button>
                      {sel && (
                        <div className="mt-3 space-y-2">
                          <input
                            value={sel.handle}
                            onChange={(e) =>
                              setPlatformSel((c) => ({
                                ...c,
                                [p.id]: { ...c[p.id], handle: e.target.value },
                              }))
                            }
                            placeholder="@ ton compte"
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
                          />
                          <input
                            value={sel.url}
                            onChange={(e) =>
                              setPlatformSel((c) => ({
                                ...c,
                                [p.id]: { ...c[p.id], url: e.target.value },
                              }))
                            }
                            inputMode="url"
                            placeholder="Lien vers ton compte (https://…)"
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex items-center rounded-lg border border-zinc-300">
                              <button
                                type="button"
                                onClick={() => bumpSubs(p.id, -1000)}
                                className="px-3 py-2 text-zinc-500 hover:text-ink"
                                aria-label="Diminuer les abonnés"
                              >
                                ↓
                              </button>
                              <input
                                value={sel.subs}
                                onChange={(e) =>
                                  setPlatformSel((c) => ({
                                    ...c,
                                    [p.id]: {
                                      ...c[p.id],
                                      subs: e.target.value.replace(/[^0-9]/g, ""),
                                    },
                                  }))
                                }
                                inputMode="numeric"
                                placeholder="0"
                                className="w-24 border-x border-zinc-200 px-2 py-2 text-center text-sm outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => bumpSubs(p.id, 1000)}
                                className="px-3 py-2 text-zinc-500 hover:text-ink"
                                aria-label="Augmenter les abonnés"
                              >
                                ↑
                              </button>
                            </div>
                            <span className="text-sm text-zinc-400">abonnés</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Étape 4 — Offres & tarifs */}
          {step === 3 && (
            <div>
              <h1 className="font-display text-3xl font-black tracking-tight text-ink">
                Ce que tu proposes
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                Choisis tes formats et ton tarif de départ. Tu pourras tout ajuster
                plus tard.
              </p>
              <div className="mt-6 space-y-3">
                {CREATOR_OFFERS.map((o) => {
                  const sel = offerSel[o.id];
                  return (
                    <div
                      key={o.id}
                      className={`rounded-xl border p-3 transition ${
                        sel ? "border-purple-200 bg-purple-50/40" : "border-zinc-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleOffer(o.id)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="text-xl">{o.emoji}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-ink">{o.label}</span>
                          <span className="block text-xs text-zinc-400">{o.tag}</span>
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs text-white ${
                            sel ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-zinc-300"
                          }`}
                        >
                          {sel ? "✓" : "+"}
                        </span>
                      </button>
                      {sel && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            value={sel.price}
                            onChange={(e) =>
                              setOfferSel((c) => ({
                                ...c,
                                [o.id]: { price: e.target.value.replace(/[^0-9]/g, "") },
                              }))
                            }
                            inputMode="numeric"
                            placeholder="Prix de départ"
                            className="w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
                          />
                          <span className="text-sm text-zinc-400">€</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl bg-purple-50/60 p-3 text-xs leading-relaxed text-zinc-600">
                🔗 <span className="font-semibold text-brand-deep">Affiliation</span> et 📊{" "}
                <span className="font-semibold text-brand-deep">paiement à la performance</span> :
                rien à configurer ici. Ils s&apos;activent au cas par cas, selon la campagne et
                la commission fixées par chaque marque.
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-full px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:text-ink"
            >
              ← Retour
            </button>
          ) : (
            <span />
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Continuer
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={!canNext || saving}
              className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Terminer mon profil"}
            </button>
          )}
        </div>
      </div>

      {/* Colonne aperçu (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Aperçu de ta carte
          </p>
          <PreviewCard />
          <p className="mt-3 text-xs text-zinc-400">
            C&apos;est ce que les marques verront dans la marketplace.
          </p>
        </div>
      </aside>
    </main>
  );
}
