"use client";

import { useState } from "react";
import BoutonSoumettre from "@/components/BoutonSoumettre";
import { useRouter } from "next/navigation";
import { creerPropositionDirecte } from "../actions";
import {
  DEAL_FORMAT_LABEL,
  MODELES_REMUNERATION,
  MODELE_LABEL,
  MODELE_DESCRIPTION,
  LIBELLE_MONTANT,
  avecCommission,
  avecSommeVersee,
  type DealFormat,
  type ModeleRemuneration,
} from "@/lib/deal";

/**
 * Ce qu'une marque doit décider avant qu'une collaboration existe.
 *
 * Cinq champs, pas douze : un format, un montant, un nombre de contenus, une
 * échéance facultative, et ce qu'elle attend. Tout le reste — droits d'usage,
 * exclusivité, envoi de produit — se règle ensuite dans « Modifier les termes »,
 * sur une proposition qui existe déjà. Demander tout d'un coup ferait
 * abandonner avant la première ligne.
 *
 * Le format n'était pas demandé : toute proposition directe naissait « vidéo
 * postée », et rien ne permettait d'en changer ensuite. Une marque qui
 * commandait trois stories signait un contrat annonçant une vidéo — faux dans
 * le document qui fait foi. Il est donc ici, en premier : c'est la première
 * chose qu'on décide en commandant du contenu, avant même le prix.
 */
export default function FormulaireProposition({
  creatorId,
  nomCreateur,
  tarifDepart,
}: {
  creatorId: string;
  nomCreateur: string;
  tarifDepart: number | null;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<DealFormat>("video_post");
  // Deux questions indépendantes : ce qui est produit, et comment c'est payé.
  const [modele, setModele] = useState<ModeleRemuneration>("forfait");
  const [tarifVues, setTarifVues] = useState("");
  const [commission, setCommission] = useState("");
  const [urlDestination, setUrlDestination] = useState("");
  const [montant, setMontant] = useState(tarifDepart ? String(tarifDepart) : "");
  const [quantite, setQuantite] = useState("1");
  /* Sur une affiliation, le défaut est LIBRE : c'est le cas courant — un lien,
     un pourcentage, et le créateur publie comme il l'entend. Imposer « 1 vidéo
     postée » écrirait au contrat une obligation dont personne n'a parlé. */
  const [libre, setLibre] = useState(false);
  const contenuLibre = modele === "affiliation" && libre;
  const [echeance, setEcheance] = useState("");
  const [titre, setTitre] = useState("");
  const [brief, setBrief] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const res = await creerPropositionDirecte(creatorId, {
      amount: Number(montant),
      quantity: contenuLibre ? 0 : Number(quantite),
      deadline: echeance || null,
      brandNotes: brief.trim() || null,
      title: titre.trim() || null,
      format,
      modele,
      perfRate: modele === "performance" ? Number(tarifVues) : null,
      commission: avecCommission(modele) ? Number(commission) : null,
      urlDestination: avecCommission(modele) ? urlDestination.trim() : null,
    });
    setEnvoi(false);
    // Même refusée, la réponse peut porter la collaboration déjà ouverte :
    // on y emmène plutôt que d'afficher une impasse.
    if (res.dealId) {
      router.push(`/deals/${res.dealId}`);
      return;
    }
    if (!res.ok) {
      setErreur(res.error ?? "La proposition n'a pas pu être créée.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const champ =
    "mt-1.5 w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-purple-400";
  const legende = "block text-xs font-semibold uppercase tracking-wide text-zinc-500";

  return (
    <form onSubmit={envoyer} className="mt-7 space-y-5">
      {erreur && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erreur}</p>
      )}

      <div>
        <span className={legende}>Comment {nomCreateur} est payé</span>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODELES_REMUNERATION.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setModele(m);
                setLibre(m === "affiliation");
              }}
              aria-pressed={modele === m}
              className={
                modele === m
                  ? "rounded-xl border-2 border-ink px-3.5 py-3 text-left"
                  : "rounded-xl border-2 border-zinc-200 px-3.5 py-3 text-left transition hover:border-zinc-300"
              }
            >
              <span className="block text-sm font-semibold text-ink">
                {MODELE_LABEL[m]}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
                {MODELE_DESCRIPTION[m]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div hidden={contenuLibre}>
        <span className={legende}>Format du contenu</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(Object.keys(DEAL_FORMAT_LABEL) as DealFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={
                format === f
                  ? "rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-zinc-300"
              }
            >
              {DEAL_FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          C&apos;est ce qui sera écrit au contrat. Tu peux encore le changer tant
          que {nomCreateur}{" "}n&apos;a pas accepté.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {/* Le même champ ne veut pas dire la même chose selon le modèle.
              L'appeler « Montant » partout ferait croire à la marque qu'elle
              fixe un forfait alors qu'elle pose un plafond. */}
          <label className={legende} htmlFor="montant">
            {LIBELLE_MONTANT[modele]}
          </label>
          <input
            id="montant"
            type="number"
            min={avecSommeVersee(modele) ? 1 : 0}
            step={1}
            required
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder={modele === "performance" ? "400" : "300"}
            className={champ}
          />
          <p className="mt-1 text-xs text-zinc-400">
            {modele === "performance"
              ? "C'est le maximum que tu séquestres. Ce qui n'est pas dû te revient."
              : modele === "produit"
                ? "Sert à déclarer l'avantage en nature. Aucun argent n'est versé."
                : modele === "affiliation"
                  ? // Le libellé dit « s'il y en a un » : le champ doit donc
                    // accepter zéro. Il exigeait 1 € — une affiliation pure
                    // devenait impossible à proposer.
                    "Laisse 0 si tu n'envoies rien. Le créateur est payé à la commission."
                  : tarifDepart
                    ? `Son tarif affiché est de ${tarifDepart} €. Tu peux proposer autre chose.`
                    : "Ce créateur n'affiche pas de tarif — à toi de proposer."}
          </p>

          {avecCommission(modele) && (
            <div className="mt-3">
              <label className={legende} htmlFor="commission">
                Commission sur les ventes (%)
              </label>
              <input
                id="commission"
                type="number"
                min={1}
                max={50}
                step={1}
                required
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="10"
                className={champ}
              />
              <p className="mt-1 text-xs text-zinc-400">
                Reversé au créateur sur chaque vente qu&apos;il amène, pendant 30
                jours après le clic.
              </p>
            </div>
          )}

          {modele === "performance" && (
            <div className="mt-3">
              <label className={legende} htmlFor="tarifVues">
                Tarif pour 1 000 vues (€)
              </label>
              <input
                id="tarifVues"
                type="number"
                min={1}
                step={1}
                required
                value={tarifVues}
                onChange={(e) => setTarifVues(e.target.value)}
                placeholder="8"
                className={champ}
              />
              <p className="mt-1 text-xs text-zinc-400">
                {Number(tarifVues) > 0 && Number(montant) > 0
                  ? `Le plafond est atteint à ${Math.round((Number(montant) / Number(tarifVues)) * 1000).toLocaleString("fr-FR")} vues.`
                  : "Le créateur déclare ses vues, tu les valides avant paiement."}
              </p>
            </div>
          )}
        </div>

        <div>
          <label className={legende} htmlFor="quantite">
            {modele === "affiliation" ? "Contenus attendus" : "Nombre de contenus"}
          </label>
          {modele === "affiliation" && (
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setLibre(true)}
                aria-pressed={libre}
                className={
                  libre
                    ? "rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-600"
                }
              >
                Libre
              </button>
              <button
                type="button"
                onClick={() => setLibre(false)}
                aria-pressed={!libre}
                className={
                  !libre
                    ? "rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs font-medium text-zinc-600"
                }
              >
                Un nombre précis
              </button>
            </div>
          )}
          {!contenuLibre && (
            <input
              id="quantite"
              type="number"
              min={1}
              max={20}
              required
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              className={champ}
            />
          )}
          <p className="mt-1 text-xs text-zinc-400">
            {contenuLibre
              ? "Rien n'est imposé : il publie ce qu'il veut, quand il veut. Sa rémunération vient des ventes."
              : "Un livrable sera créé pour chacun."}
          </p>
        </div>
      </div>

      {avecCommission(modele) && (
        <div>
          <label className={legende} htmlFor="urlDestination">
            Où le lien du créateur envoie
          </label>
          <input
            id="urlDestination"
            type="url"
            required
            value={urlDestination}
            onChange={(e) => setUrlDestination(e.target.value)}
            placeholder="https://ma-boutique.fr/le-produit"
            className={champ}
          />
          {/* Sans destination, le lien renverrait vers le site de la marque —
              ou vers Collabbs — et le créateur enverrait son audience nulle
              part. C'est la page qui vend qu'il faut viser. */}
          <p className="mt-1 text-xs text-zinc-400">
            La page produit, de préférence : chaque clic y est compté, et les
            ventes qui suivent lui sont attribuées.
          </p>
        </div>
      )}

      <div>
        <label className={legende} htmlFor="titre">
          Intitulé <span className="font-normal normal-case text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="2 vidéos pour le lancement du sérum"
          className={champ}
        />
      </div>

      <div>
        <label className={legende} htmlFor="echeance">
          Échéance <span className="font-normal normal-case text-zinc-400">(facultatif)</span>
        </label>
        <input
          id="echeance"
          type="date"
          value={echeance}
          onChange={(e) => setEcheance(e.target.value)}
          className={`${champ} sm:max-w-xs`}
        />
      </div>

      <div>
        {/* Sur un produit offert, ce champ n'est plus un confort : c'est la
            seule contrepartie du créateur. Signer pour « un produit » et
            découvrir lequel à la livraison, c'est ce qui donne à ces
            collaborations leur mauvaise réputation. */}
        <label className={legende} htmlFor="brief">
          {modele === "produit" ? "Le produit offert, et ce que tu attends" : "Ce que tu attends"}{" "}
          <span className="font-normal normal-case text-zinc-400">
            {modele === "produit" ? "(obligatoire)" : "(facultatif)"}
          </span>
        </label>
        <textarea
          id="brief"
          rows={4}
          required={modele === "produit"}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={
            modele === "produit"
              ? "Quel produit, quelle valeur, ce qu'il faut montrer…"
              : "Le produit, le ton, ce qu'il faut montrer, ce qu'il faut éviter…"
          }
          className={`${champ} resize-y`}
        />
        <p className="mt-1 text-xs text-zinc-400">
          {modele === "produit"
            ? "Ce texte figure au contrat : c'est ce que le créateur reçoit en échange de son travail."
            : "Les droits d'usage, l'exclusivité et l'envoi de produit se règlent ensuite, sur la proposition."}
        </p>
      </div>

      <div className="rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-500">
        {nomCreateur}{" "}recevra la proposition et pourra l&apos;accepter ou en discuter.
        Le contrat se signe automatiquement à son acceptation, et{" "}
        <b className="text-ink">tu ne payes qu&apos;après</b> — les fonds restent bloqués
        jusqu&apos;à ce que tu valides la livraison.
      </div>

      <BoutonSoumettre
        disabled={envoi}
        className="w-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
      >
        {envoi ? "Envoi…" : "Envoyer la proposition"}
      </BoutonSoumettre>
    </form>
  );
}
