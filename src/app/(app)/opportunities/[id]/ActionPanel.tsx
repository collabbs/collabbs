"use client";

import { useState } from "react";
import Link from "next/link";
import {
  activateAffiliateLink,
  applyToCampaign,
  repondreInvitation,
} from "../actions";

export default function ActionPanel({
  campaignId,
  besoinLien,
  besoinCandidature,
  initialStatus,
  initialCode,
  clicks = 0,
  gains = 0,
  rewardedFor = "vente",
}: {
  campaignId: string;
  /** La campagne se suit par un lien : affiliation, CPA, code promo, hybride. */
  besoinLien: boolean;
  /** Une collaboration doit naître : forfait, performance, hybride. */
  besoinCandidature: boolean;
  initialStatus: "none" | "linked" | "applied" | "invited";
  initialCode?: string;
  clicks?: number;
  gains?: number;
  /**
   * Ce qui déclenche la rémunération sur cette campagne : « vente » en
   * affiliation, mais l'action définie par la marque au CPA. Annoncer « chaque
   * vente générée » sur une campagne payée à l'inscription décrivait un
   * mécanisme qui n'existe pas.
   */
  rewardedFor?: string;
}) {
  // Sur une campagne hybride, les deux gestes coexistent : le lien est actif
  // ET la candidature est en attente. Un état unique les rendait exclusifs, et
  // le second geste devenait inatteignable.
  const [lienActif, setLienActif] = useState(initialStatus === "linked");
  const [candidatureEnvoyee, setCandidatureEnvoyee] = useState(
    initialStatus === "applied",
  );
  // `null` = pas d'invitation, ou déjà répondu dans cet onglet.
  const [invitation, setInvitation] = useState<"pending" | null>(
    initialStatus === "invited" ? "pending" : null,
  );
  const [reponse, setReponse] = useState<"accepted" | "rejected" | null>(null);
  const [code, setCode] = useState(initialCode ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onActivate() {
    setBusy(true);
    setError(null);
    const res = await activateAffiliateLink(campaignId);
    setBusy(false);
    if (res.ok && res.code) {
      setCode(res.code);
      setLienActif(true);
    } else setError(res.error ?? "Erreur.");
  }

  async function onApply() {
    setBusy(true);
    setError(null);
    const res = await applyToCampaign(campaignId, message);
    setBusy(false);
    if (res.ok) setCandidatureEnvoyee(true);
    else setError(res.error ?? "Erreur.");
  }

  async function onRepondre(valeur: "accepted" | "rejected") {
    setBusy(true);
    setError(null);
    const res = await repondreInvitation(campaignId, valeur);
    setBusy(false);
    if (res.ok) {
      setInvitation(null);
      setReponse(valeur);
      // Accepter une invitation, c'est exactement l'état où mène une
      // candidature acceptée : la marque prend la main pour proposer la
      // collaboration. Autant le dire avec les mêmes mots.
      if (valeur === "accepted") setCandidatureEnvoyee(true);

    } else setError(res.error ?? "Erreur.");
  }

  function copyLink() {
    navigator.clipboard?.writeText(`https://collabbs.com/r/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const blocLien = lienActif ? (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-700">
          ✓ Ton lien d&apos;affiliation est actif
        </p>
        <p className="mt-1 text-xs text-emerald-600">
          Partage-le partout : chaque {rewardedFor} générée te rapporte une
          commission.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-mono text-xs text-brand ring-1 ring-emerald-200">
            collabbs.com/r/{code}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-200 pt-4 text-center">
          <div>
            <p className="text-xl font-extrabold text-emerald-700">{clicks}</p>
            <p className="text-[11px] text-emerald-600">Clics</p>
          </div>
          <div>
            <p className="text-xl font-extrabold text-emerald-700">
              {gains.toLocaleString("fr-FR", {
                minimumFractionDigits: gains % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2,
              })}
              €
            </p>
            <p className="text-[11px] text-emerald-600">Gains</p>
          </div>
        </div>
      </div>
  ) : null;

  const blocInvitation = invitation ? (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
      <p className="font-display text-base font-black text-purple-800">
        ✨ Cette marque t&apos;invite
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-purple-800/80">
        Elle a repéré ton profil et te propose de participer à cette campagne.
        Accepter ne t&apos;engage à rien de plus : la marque te fera ensuite une
        proposition chiffrée, que tu resteras libre de refuser.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onRepondre("accepted")}
          disabled={busy}
          className="flex-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Accepter l'invitation"}
        </button>
        <button
          type="button"
          onClick={() => onRepondre("rejected")}
          disabled={busy}
          className="rounded-full px-5 py-3 text-sm font-semibold text-purple-800 ring-1 ring-inset ring-purple-200 transition hover:bg-white/60 disabled:opacity-50"
        >
          Décliner
        </button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  ) : null;

  const blocInvitationTranchee =
    reponse === "rejected" ? (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
        <p className="text-sm font-bold text-zinc-700">Invitation déclinée</p>
        <p className="mt-1 text-xs text-zinc-500">
          La marque en a été informée. Rien d&apos;autre à faire de ton côté.
        </p>
      </div>
    ) : reponse === "accepted" ? (
      /* Volontairement pas le même texte que « Candidature envoyée » : ici la
         marque a déjà choisi ce créateur. Lui dire qu'elle « va étudier son
         profil » lui ferait attendre une décision qui est déjà prise. */
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-700">✓ Invitation acceptée</p>
        <p className="mt-1 text-xs text-emerald-600">
          La marque est prévenue. C&apos;est à elle de te faire une proposition
          chiffrée — tu la recevras dans tes collaborations, et tu resteras
          libre de la refuser.
        </p>
      </div>
    ) : null;

  const blocCandidatureEnvoyee = candidatureEnvoyee ? (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-bold text-emerald-700">✓ Candidature envoyée</p>
        <p className="mt-1 text-xs text-emerald-600">
          La marque va étudier ton profil. Tu seras notifié·e de sa réponse.
        </p>
      </div>
  ) : null;

  const blocActiverLien = (
      <div>
        <button
          type="button"
          onClick={onActivate}
          disabled={busy}
          className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Activation…" : "🔗 Activer mon lien en 1 clic"}
        </button>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Aucune validation requise — ton lien est généré instantanément.
        </p>
        {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
      </div>
  );

  const blocCandidater = (
    <div>
      <label className="text-xs font-semibold text-zinc-500" htmlFor="apply-msg">
        Message à la marque (optionnel)
      </label>
      <textarea
        id="apply-msg"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Présente-toi en quelques mots : pourquoi cette collab te parle, tes idées de contenu…"
        className="mt-1.5 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-purple-400"
      />
      <button
        type="button"
        onClick={onApply}
        disabled={busy}
        className="mt-3 w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Envoi…" : "Candidater à cette campagne"}
      </button>
      {error && (
        <div className="mt-2 text-center text-xs text-red-600">
          <p>{error}</p>
          {/* Cf. OpportunityCard : un refus doit dire où aller le lever. */}
          {error.includes("profil") && (
            <Link href="/profile" className="mt-1 inline-block font-semibold underline underline-offset-2">
              Compléter mon profil →
            </Link>
          )}
        </div>
      )}
    </div>
  );

  // Sur une campagne hybride, les deux blocs s'affichent l'un sous l'autre :
  // le créateur active son lien pour la commission, et candidate pour le
  // forfait. C'est exactement ce que la campagne lui promet.
  // Tant qu'une invitation attend une réponse, elle occupe seule le panneau :
  // proposer « Candidater » à quelqu'un qu'on vient d'inviter n'a aucun sens,
  // et lui montrer le bouton d'activation de lien le ferait passer à côté.
  if (invitation) {
    return <div className="space-y-4">{blocInvitation}</div>;
  }

  // Quand on vient de répondre à une invitation, son compte rendu remplace le
  // bloc candidature : les deux diraient la même chose, avec des mots
  // différents et l'un des deux serait faux.
  return (
    <div className="space-y-4">
      {blocInvitationTranchee}
      {besoinLien && (lienActif ? blocLien : blocActiverLien)}
      {besoinCandidature &&
        reponse === null &&
        (candidatureEnvoyee ? blocCandidatureEnvoyee : blocCandidater)}
    </div>
  );
}
