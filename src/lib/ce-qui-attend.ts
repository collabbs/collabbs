import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parTranches } from "@/lib/par-tranches";
import { montant } from "@/lib/euros";

/**
 * Ce qui attend cette personne, maintenant.
 *
 * ─── Le manque que ça comble ───
 * Le produit savait tout dire, mais nulle part au bon moment. La timeline
 * d'une collaboration est juste — six étapes, qui agit, les délais — mais il
 * faut DÉJÀ avoir ouvert la bonne collaboration pour la lire. `/notifications`
 * est un fil chronologique : de l'histoire, pas une consigne. Le tableau de
 * bord montre des chiffres. Les pastilles du bandeau donnent des nombres sans
 * sens — « 3 » ne dit pas si c'est urgent ni ce qu'on attend de vous.
 *
 * Résultat constaté par Julien le 16/11, en parcourant une collaboration
 * entière des deux côtés : « un créateur ou une marque ne sait pas où elle en
 * est, et ça ne saute pas aux yeux ». Sur une place de marché, quelqu'un qui
 * ne sait pas ce qu'on attend de lui ne demande pas : il s'arrête.
 *
 * ─── Calculé depuis l'ÉTAT, jamais depuis les notifications ───
 * C'est la décision qui compte ici. Une liste bâtie sur la table des
 * notifications serait fausse deux fois : elle garderait des lignes pour des
 * choses déjà faites, et elle disparaîtrait au « marquer comme lu » alors que
 * le travail, lui, reste à faire. Ici tout est déduit de la base à l'instant
 * où la page se rend. Une tâche s'efface parce qu'elle est FAITE, pas parce
 * qu'on l'a regardée.
 *
 * ─── Ce qui entre dans la liste ───
 * Seulement ce qui attend une ACTION DE CETTE PERSONNE. Pas « le créateur a
 * déposé son contenu » (une nouvelle), mais « un livrable attend ta
 * validation » (une consigne). Si la liste est vide, c'est une vraie réponse :
 * la balle est dans l'autre camp.
 */

/** Ce qui bloque d'abord : sans ça, rien d'autre ne peut avancer. */
export type Urgence = "bloque" | "a_faire";

export type Attente = {
  /** Clé stable de rendu. */
  id: string;
  /** La phrase, adressée à la personne qui lit. */
  quoi: string;
  /** Le verbe du bouton. Un seul, à l'infinitif ou à l'impératif. */
  verbe: string;
  lien: string;
  urgence: Urgence;
  /** Quand une horloge tourne vraiment. */
  echeance?: { jours: number; depasse: boolean };
};

const JOUR = 24 * 60 * 60 * 1000;
const joursRestants = (iso: string, delaiJours: number) =>
  Math.ceil((new Date(iso).getTime() + delaiJours * JOUR - Date.now()) / JOUR);

/** Les statuts où une collaboration est encore en cours. */
const EN_COURS = ["negotiation", "active"] as const;

export async function ceQuiAttend(
  userId: string,
  role: "creator" | "brand",
): Promise<Attente[]> {
  const supabase = await createClient();
  const colonne = role === "brand" ? "brand_id" : "creator_id";

  const { data: dealsRows } = await supabase
    .from("deals")
    .select(
      "id, title, amount, status, accepted_at, brand_validated_at, brand_validation_deadline_days",
    )
    .eq(colonne, userId)
    .in("status", [...EN_COURS]);
  const deals = dealsRows ?? [];
  const idsDeals = deals.map((d) => d.id);
  const titre = (id: string) =>
    deals.find((d) => d.id === id)?.title ?? "une collaboration";

  /* Les trois lectures qui dépendent des collaborations en cours. Découpées :
     une marque-agence peut en avoir des centaines (voir `par-tranches.ts`). */
  const [paiements, livrables, contrats] = await Promise.all([
    parTranches(idsDeals, (t) =>
      supabase.from("transactions").select("deal_id, status").eq("type", "deal_payment").in("deal_id", t),
    ),
    parTranches(idsDeals, (t) =>
      supabase
        .from("deliverables")
        .select("id, deal_id, label, approved, revision_requested, submitted_at")
        .in("deal_id", t),
    ),
    parTranches(idsDeals, (t) =>
      supabase
        .from("contracts")
        .select("deal_id, brand_signed_at, creator_signed_at, status")
        .in("deal_id", t),
    ),
  ]);

  const regle = new Set(
    paiements.filter((p) => p.status !== "refunded" && p.deal_id).map((p) => p.deal_id as string),
  );
  const attentes: Attente[] = [];

  /* ─────────────────────────── CÔTÉ MARQUE ─────────────────────────── */
  if (role === "brand") {
    /* 1. Le séquestre non réglé — EN PREMIER, toujours.
       Tant qu'il n'est pas réglé, le créateur n'a aucune garantie d'être payé,
       et un créateur prudent ne commence pas. C'est le seul point de la liste
       qui bloque réellement l'autre partie. */
    for (const d of deals) {
      if (d.status === "active" && !regle.has(d.id)) {
        attentes.push({
          id: `sequestre-${d.id}`,
          quoi: `« ${d.title ?? "Collaboration"} » est acceptée mais pas réglée. Tant que l'argent n'est pas bloqué, le créateur n'a aucune garantie d'être payé — et il ne commencera pas.`,
          verbe: `Régler ${montant(Number(d.amount ?? 0))}`,
          lien: `/deals/${d.id}`,
          urgence: "bloque",
        });
      }
    }

    /* 2. Un livrable déposé qui attend la validation.
       L'horloge tourne : passé le délai, la validation devient automatique. */
    for (const l of livrables) {
      if (!l.submitted_at || l.approved || l.revision_requested) continue;
      const d = deals.find((x) => x.id === l.deal_id);
      if (!d || d.brand_validated_at) continue;
      const jours = joursRestants(l.submitted_at, d.brand_validation_deadline_days ?? 7);
      attentes.push({
        id: `valider-${l.id}`,
        quoi: `Le livrable « ${l.label} » de « ${titre(l.deal_id)} » attend ta validation.`,
        verbe: "Valider",
        lien: `/deals/${l.deal_id}`,
        urgence: "a_faire",
        echeance: { jours, depasse: jours <= 0 },
      });
    }

    /* 3. Les candidatures reçues. Quelqu'un attend une réponse ; ne pas
       répondre est une réponse, et c'est la pire. */
    const { data: mesCampagnes } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("brand_id", userId);
    const idsCampagnes = (mesCampagnes ?? []).map((c) => c.id);
    const candidatures = await parTranches(idsCampagnes, (t) =>
      supabase
        .from("applications")
        .select("id, campaign_id")
        .in("campaign_id", t)
        .eq("initiated_by", "creator")
        .eq("status", "pending"),
    );
    const parCampagne = new Map<string, number>();
    for (const a of candidatures) {
      parCampagne.set(a.campaign_id, (parCampagne.get(a.campaign_id) ?? 0) + 1);
    }
    for (const [campagneId, n] of parCampagne) {
      const nom = (mesCampagnes ?? []).find((c) => c.id === campagneId)?.name ?? "ta campagne";
      attentes.push({
        id: `candidatures-${campagneId}`,
        quoi:
          n === 1
            ? `Un créateur a candidaté sur « ${nom} » et attend ta réponse.`
            : `${n} créateurs ont candidaté sur « ${nom} » et attendent ta réponse.`,
        verbe: n === 1 ? "Voir la candidature" : "Voir les candidatures",
        lien: `/campaigns/${campagneId}`,
        urgence: "a_faire",
      });
    }
  }

  /* ────────────────────────── CÔTÉ CRÉATEUR ────────────────────────── */
  if (role === "creator") {
    /* 1. L'argent est bloqué, le travail peut commencer. C'est la meilleure
       nouvelle du produit et elle n'était annoncée nulle part. */
    for (const d of deals) {
      if (d.status !== "active" || !regle.has(d.id)) continue;
      const aLivrer = livrables.filter(
        (l) => l.deal_id === d.id && !l.submitted_at && !l.approved,
      );
      if (aLivrer.length === 0) continue;
      attentes.push({
        id: `livrer-${d.id}`,
        quoi: `L'argent de « ${d.title ?? "Collaboration"} » est bloqué pour toi : tu peux commencer. ${aLivrer.length === 1 ? "Un contenu reste" : `${aLivrer.length} contenus restent`} à déposer.`,
        verbe: "Déposer mon contenu",
        lien: `/deals/${d.id}`,
        urgence: "a_faire",
      });
    }

    /* 2. Une révision demandée : la marque attend, et le créateur ne le sait
       que s'il rouvre la collaboration. */
    for (const l of livrables) {
      if (!l.revision_requested) continue;
      attentes.push({
        id: `revision-${l.id}`,
        quoi: `La marque demande une reprise sur « ${l.label} » (${titre(l.deal_id)}).`,
        verbe: "Voir ce qui est demandé",
        lien: `/deals/${l.deal_id}`,
        urgence: "a_faire",
      });
    }

    /* 3. Les invitations reçues : une marque t'a choisi. */
    const { data: invitations } = await supabase
      .from("applications")
      .select("id, campaign_id")
      .eq("creator_id", userId)
      .eq("initiated_by", "brand")
      .eq("status", "pending");
    for (const i of invitations ?? []) {
      attentes.push({
        id: `invitation-${i.id}`,
        quoi: "Une marque t'invite sur sa campagne et attend ta réponse.",
        verbe: "Répondre",
        lien: `/opportunities/${i.campaign_id}`,
        urgence: "a_faire",
      });
    }
  }

  /* ─────────────────────── LES DEUX : LE CONTRAT ─────────────────────── */
  const champSignature = role === "brand" ? "brand_signed_at" : "creator_signed_at";
  for (const c of contrats) {
    if (c[champSignature] || !c.deal_id) continue;
    attentes.push({
      id: `contrat-${c.deal_id}`,
      quoi: `Le contrat de « ${titre(c.deal_id)} » attend ta signature.`,
      verbe: "Signer",
      lien: `/contracts/${c.deal_id}`,
      urgence: "bloque",
    });
  }

  /* Ce qui bloque d'abord, puis ce dont l'échéance est la plus proche. Une
     liste triée par date de création ferait remonter du vieux sans urgence. */
  return attentes.sort((a, b) => {
    if (a.urgence !== b.urgence) return a.urgence === "bloque" ? -1 : 1;
    const ja = a.echeance?.jours ?? 9999;
    const jb = b.echeance?.jours ?? 9999;
    return ja - jb;
  });
}
