"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import PlatformIcon from "@/components/PlatformIcon";
import { OFFER_TYPES, OFFER_BY_ID, type OfferId } from "@/components/landing/creators";
import { saveCreatorOnboarding, uploadAvatar } from "@/app/onboarding/actions";
import { extractHandleFromUrl } from "@/lib/social-handle";
import { compressImage } from "@/lib/image-compress";

type Niche = { id: number; label: string };
type Platform = { id: number; label: string; slug: string };

// Le créateur ne fixe que ses formats à prix fixe.
// Idem Wizard : UGC/Vidéo/Story = prix fixe au créateur ; Affiliation = signal
// d'acceptation (taux fixé par la marque) ; Performance = défini par campagne.
const CREATOR_OFFERS = OFFER_TYPES.filter(
  (o) => o.id === "ugc" || o.id === "post" || o.id === "story" || o.id === "affil",
);

export default function CreatorProfileForm({
  userId,
  displayName,
  niches,
  platforms,
  publicHandle,
  legalSection,
  portfolioSection,
  initial,
}: {
  userId: string;
  displayName: string;
  niches: Niche[];
  platforms: Platform[];
  publicHandle: string | null;
  legalSection?: React.ReactNode;
  portfolioSection?: React.ReactNode;
  initial: {
    handle: string;
    bio: string;
    avatarUrl: string | null;
    customNiche: string;
    nicheIds: number[];
    platforms: { platformId: number; handle: string; subs: string; url: string }[];
    offers: { offer: string; price: string }[];
  };
}) {
  const [handle, setHandle] = useState(initial.handle);
  const [bio, setBio] = useState(initial.bio);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initial.avatarUrl);
  const [nicheIds, setNicheIds] = useState<number[]>(initial.nicheIds);
  const [customNiche, setCustomNiche] = useState(initial.customNiche);
  const [otherOpen, setOtherOpen] = useState(Boolean(initial.customNiche));
  const [platformSel, setPlatformSel] = useState<
    Record<number, { handle: string; subs: string; url: string }>
  >(() => {
    const out: Record<number, { handle: string; subs: string; url: string }> = {};
    for (const p of initial.platforms) {
      out[p.platformId] = { handle: p.handle, subs: p.subs, url: p.url };
    }
    return out;
  });
  const [offerSel, setOfferSel] = useState<Record<string, { price: string }>>(() => {
    const out: Record<string, { price: string }> = {};
    for (const o of initial.offers) {
      out[o.offer] = { price: o.price };
    }
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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

  async function save() {
    setError(null);
    setSaving(true);
    try {
      // Upload photo VIA SERVER ACTION (la session SSR est plus fiable que
      // le client browser pour Storage). Best-effort : si ça échoue, on garde
      // l'ancienne photo et on sauve quand même le reste.
      let avatarUrl = initial.avatarUrl;
      let photoError: string | null = null;
      if (photoFile) {
        // Compresse en client (~300 Ko) pour passer la limite server action
        // et accélérer l'upload sur réseau mobile.
        const compressed = await compressImage(photoFile, { maxSize: 800 });
        const fd = new FormData();
        fd.append("file", compressed);
        const up = await uploadAvatar(fd, "avatar");
        if (!up.ok || !up.url) {
          photoError = up.error ?? "Erreur inconnue lors de l'upload";
          console.error("Avatar upload failed", up.error);
        } else {
          avatarUrl = up.url;
        }
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

      if (res.ok) {
        setSavedAt(Date.now());
        if (!photoError) {
          setPhotoFile(null);
          if (avatarUrl) setPhotoPreview(avatarUrl);
        }
        if (photoError) {
          setError(
            `Tes infos sont sauvegardées, mais la photo n'a pas pu être envoyée (${photoError}). Réessaie de la choisir et clique à nouveau Enregistrer.`,
          );
        }
        // Scroll en haut pour que le user voie le toast de confirmation.
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        setError(res.error ?? "Une erreur est survenue.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
            Mon profil
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            C&apos;est ce que les marques voient dans la marketplace.
          </p>
        </div>
        {publicHandle && (
          <Link
            href={`/creators/${publicHandle}`}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50"
          >
            👁 Voir ma fiche publique
          </Link>
        )}
      </div>

      {/* Jauge de complétion */}
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-ink">Profil {completion}% complet</span>
          <span className={listable ? "text-emerald-600" : "text-zinc-400"}>
            {listable ? "✓ Visible par les marques" : "Pas encore visible"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      {/* Toast confirmation — voyant et persistant 8s grâce à la key qui
          force le remount donc retrigger des transitions Tailwind. */}
      {savedAt && (
        <div
          key={savedAt}
          className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm"
        >
          <span className="text-xl">✅</span>
          <div className="flex-1">
            <p className="font-bold">Modifications enregistrées.</p>
            <p className="mt-0.5 text-xs">
              {listable
                ? "Ton profil est visible par les marques dans la marketplace."
                : "Continue à compléter pour devenir visible (photo + niche + 1 offre minimum)."}
            </p>
          </div>
          {publicHandle && listable && (
            <Link
              href={`/creators/${publicHandle}`}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50"
            >
              👁 Voir ma fiche →
            </Link>
          )}
        </div>
      )}

      {/* ============ Section 1 — Photo & identité ============ */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Photo & identité</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Une bonne photo + une bio claire multiplient tes chances d&apos;être contacté.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
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
        <div className="mt-1.5 flex max-w-md items-center rounded-lg border border-zinc-300 px-3 focus-within:border-purple-400">
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
      </section>

      {/* ============ Section 2 — Niches ============ */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Mes niches</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ce qui permet aux bonnes marques de te trouver.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
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
                    : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
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
                : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
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
      </section>

      {/* ============ Section 3 — Réseaux ============ */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Mes réseaux</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Plus ton audience est renseignée, plus les marques te font confiance.
        </p>
        <div className="mt-5 space-y-3">
          {platforms.map((p) => {
            const sel = platformSel[p.id];
            return (
              <div
                key={p.id}
                className={`rounded-xl border transition ${
                  sel
                    ? "border-purple-300 bg-purple-50/40"
                    : "border-zinc-200 hover:border-purple-200 hover:bg-purple-50/20"
                }`}
              >
                {/* Le card entier est cliquable quand pas sélectionné : grande
                    surface tactile + curseur pointer. Une fois sélectionné, on
                    sépare le clic toggle (sur l'icône X) du clic dans les
                    inputs pour éviter qu'un focus input ne fasse refermer. */}
                <button
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className="group flex w-full cursor-pointer items-center gap-3 p-3 text-left"
                >
                  <PlatformIcon slug={p.slug} className="h-6 w-6 shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-ink">
                    {p.label}
                  </span>
                  {sel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-xs font-bold text-white">
                      <span>✓</span>
                      Ajouté
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600 group-hover:bg-purple-100 group-hover:text-purple-700">
                      <span className="text-base leading-none">+</span>
                      Ajouter
                    </span>
                  )}
                </button>
                {sel && (
                  <div className="space-y-2 px-3 pb-3">
                    <input
                      value={sel.url}
                      onChange={(e) => {
                        const newUrl = e.target.value;
                        setPlatformSel((c) => {
                          const cur = c[p.id];
                          if (!cur) return c;
                          // Auto-extract @handle quand le user colle une URL
                          // (et seulement si le handle est encore vide pour ne
                          // pas écraser ce qu'il aurait tapé à la main).
                          const auto =
                            !cur.handle.trim()
                              ? extractHandleFromUrl(newUrl, p.slug)
                              : null;
                          return {
                            ...c,
                            [p.id]: {
                              ...cur,
                              url: newUrl,
                              handle: auto ?? cur.handle,
                            },
                          };
                        });
                      }}
                      inputMode="url"
                      placeholder={`Lien vers ton ${p.label} (https://…)`}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    />
                    <input
                      value={sel.handle}
                      onChange={(e) =>
                        setPlatformSel((c) => ({
                          ...c,
                          [p.id]: { ...c[p.id], handle: e.target.value },
                        }))
                      }
                      placeholder="@ ton pseudo (rempli auto depuis l'URL)"
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
      </section>

      {/* ============ Section 4 — Offres & tarifs ============ */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Mes offres & tarifs</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tes formats à prix fixe (UGC, post, story). Affiliation et
          performance se règlent par campagne, côté marque.
        </p>
        <div className="mt-5 space-y-3">
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
                    <span className="block text-sm font-semibold text-ink">
                      {OFFER_BY_ID[o.id].label}
                    </span>
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
                {sel && o.id !== "affil" && (
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
                {sel && o.id === "affil" && (
                  <p className="mt-3 text-xs italic text-brand-deep">
                    💎 Taux de commission défini par la marque dans sa campagne.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ Section Portfolio (entre Réseaux et Offres) ============ */}
      {portfolioSection}

      {/* ============ Section 5 — Infos légales (contrats) ============ */}
      {legalSection}

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {displayName && <span className="hidden">{displayName}</span>}

      {/* ============ Barre d'action sticky en bas ============
          Voyante : fond opaque + ombre, message explicite côté gauche,
          bouton grand format avec icône à droite. Sur mobile, le message
          se passe en dessous du bouton pour rester lisible. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)] lg:left-60">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span
              className={`flex h-2 w-2 shrink-0 rounded-full ${
                listable ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <span className="text-zinc-600">
              {listable ? (
                <>
                  <strong className="text-emerald-700">Visible par les marques.</strong>{" "}
                  Tes modifs sont prêtes à être enregistrées.
                </>
              ) : (
                <>
                  <strong className="text-amber-700">Pas encore visible.</strong>{" "}
                  Il te manque photo + niche + 1 offre.
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-7 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] hover:opacity-95 active:scale-100 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Enregistrement…
              </>
            ) : (
              <>
                <span>💾</span>
                Enregistrer mon profil
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
