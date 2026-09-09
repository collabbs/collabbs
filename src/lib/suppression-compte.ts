import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { eurExact } from "@/lib/deal";

/**
 * Ce qu'il faut vérifier, et sauver, avant d'effacer un compte.
 *
 * ─── Pourquoi ce fichier existe ───
 * `deleteAccount` appelait `auth.admin.deleteUser` et rien d'autre. Tout
 * cascade en base. Une collaboration a pourtant DEUX parties, et l'autre n'a
 * rien demandé : un créateur qui partait pendant qu'un séquestre était ouvert
 * effaçait le deal et la transaction, l'argent restait chez Stripe, et la
 * marque n'était jamais remboursée — sans qu'il reste une ligne pour rattraper
 * à la main.
 *
 * Deux gestes, donc, et dans cet ordre :
 *   1. REFUSER tant que quelque chose est en cours. On ne part pas d'une
 *      partie de cartes avec l'argent des autres sur la table.
 *   2. ARCHIVER ce que l'autre partie a le droit de conserver. Un contrat est
 *      une preuve à deux exemplaires ; que l'un des signataires puisse faire
 *      disparaître celui de l'autre n'est pas une suppression de compte.
 */

export type Blocage = {
  /** Ce qui bloque, dit à la personne, pas à la machine. */
  quoi: string;
  /** Ce qu'elle peut faire pour débloquer. */
  issue: string;
};

/**
 * Tout ce qui empêche ce compte de disparaître aujourd'hui.
 *
 * On regarde l'argent d'abord, l'engagement ensuite : un séquestre ouvert est
 * plus grave qu'une négociation, parce qu'il y a déjà des euros immobilisés
 * chez Stripe et qu'ils n'ont plus de chemin de retour une fois la ligne
 * effacée.
 */
export async function blocagesAvantSuppression(userId: string): Promise<Blocage[]> {
  const admin = createAdminClient();
  const blocages: Blocage[] = [];

  // ── 1. De l'argent immobilisé ──
  // `pending` = paiement lancé, `in_escrow` = payé et bloqué, `released` =
  // libéré mais pas encore viré. Dans les trois cas, la somme existe et
  // attend quelqu'un.
  const { data: argent } = await admin
    .from("transactions")
    .select("id, status, gross_amount, type")
    .or(`brand_id.eq.${userId},creator_id.eq.${userId}`)
    .in("status", ["pending", "in_escrow", "released"]);

  if (argent && argent.length > 0) {
    const total = argent.reduce((s, t) => s + Number(t.gross_amount ?? 0), 0);
    blocages.push({
      quoi:
        argent.length === 1
          ? `Une somme de ${eurExact(total)} est encore immobilisée sur une collaboration.`
          : `${argent.length} sommes sont encore immobilisées, pour ${eurExact(total)} au total.`,
      issue:
        "Il faut d'abord que ces collaborations aillent à leur terme — livraison et validation, ou remboursement. Une fois l'argent revenu à qui de droit, la suppression est possible.",
    });
  }

  // ── 2. Une collaboration en cours ──
  const { data: enCours } = await admin
    .from("deals")
    .select("id, title, status")
    .or(`brand_id.eq.${userId},creator_id.eq.${userId}`)
    .in("status", ["negotiation", "active"]);

  if (enCours && enCours.length > 0) {
    blocages.push({
      quoi:
        enCours.length === 1
          ? `Une collaboration est en cours : « ${enCours[0].title ?? "sans titre"} ».`
          : `${enCours.length} collaborations sont en cours.`,
      issue:
        "Termine-les ou annule-les depuis l'onglet Collaborations. L'autre partie sera prévenue — ce qui n'est pas le cas si le compte disparaît.",
    });
  }

  // ── 3. Des commissions gagnées et pas encore versées ──
  // `validated` = la vente a passé sa période de confirmation, la commission
  // est due. `pending` = elle peut encore l'être. Partir maintenant, c'est
  // renoncer sans le savoir — ou, côté marque, priver un créateur de son dû.
  const { data: liens } = await admin
    .from("affiliate_links")
    .select("id")
    .eq("creator_id", userId);
  const idsLiens = (liens ?? []).map((l) => l.id);

  if (idsLiens.length > 0) {
    const { data: commissions } = await admin
      .from("affiliate_events")
      .select("id, commission_amount, status")
      .in("link_id", idsLiens)
      .in("status", ["pending", "validated"]);

    if (commissions && commissions.length > 0) {
      const total = commissions.reduce((s, c) => s + Number(c.commission_amount ?? 0), 0);
      blocages.push({
        quoi: `${commissions.length} commission${commissions.length > 1 ? "s" : ""} d'affiliation ${commissions.length > 1 ? "sont" : "est"} en attente de versement, pour ${eurExact(total)}.`,
        issue:
          "Elles sont versées le 1er de chaque mois. Attends le prochain versement — sinon cet argent est perdu pour toi.",
      });
    }
  }

  return blocages;
}

/**
 * Met à l'abri les contrats signés, pour la partie qui reste.
 *
 * On n'archive que ce qui a été SIGNÉ : un brouillon n'engage personne et n'a
 * rien à conserver. Le texte n'est pas résumé, il est recopié tel quel —
 * `terms_snapshot` est figé depuis la signature, c'est le document lui-même.
 *
 * Le nom de la contrepartie est recopié en clair : sa fiche, elle, va bel et
 * bien disparaître, et « Partenaire » sur un contrat ne vaut rien.
 *
 * Renvoie le nombre de contrats mis à l'abri.
 */
export async function archiverContratsDe(userId: string): Promise<number> {
  const admin = createAdminClient();

  // Les contrats de collaboration passent par le deal ; les contrats-cadres
  // d'affiliation portent directement les deux parties.
  const [parDeal, cadres] = await Promise.all([
    admin
      .from("contracts")
      .select(
        "reference, status, terms_snapshot, brand_signed_at, creator_signed_at, terminated_at, deals!inner(brand_id, creator_id, title, amount)",
      )
      .not("brand_signed_at", "is", null)
      .not("creator_signed_at", "is", null)
      .or(`brand_id.eq.${userId},creator_id.eq.${userId}`, { referencedTable: "deals" }),
    admin
      .from("contracts")
      .select(
        "reference, status, terms_snapshot, brand_signed_at, creator_signed_at, terminated_at, brand_id, creator_id, period_year",
      )
      .eq("kind", "affiliate")
      .not("brand_signed_at", "is", null)
      .not("creator_signed_at", "is", null)
      .or(`brand_id.eq.${userId},creator_id.eq.${userId}`),
  ]);

  type Ligne = {
    partie_id: string;
    partie_role: "brand" | "creator";
    reference: string;
    genre: "deal" | "affiliate";
    intitule: string | null;
    montant: number | null;
    terms_snapshot: Json | null;
    statut: string | null;
    brand_signed_at: string | null;
    creator_signed_at: string | null;
    terminated_at: string | null;
  };

  const lignes: Ligne[] = [];
  const aNommer = new Set<string>();

  for (const c of parDeal.data ?? []) {
    const d = c.deals as unknown as {
      brand_id: string;
      creator_id: string;
      title: string | null;
      amount: number | null;
    };
    const reste = d.brand_id === userId ? d.creator_id : d.brand_id;
    if (!reste) continue;
    aNommer.add(reste);
    lignes.push({
      partie_id: reste,
      partie_role: d.brand_id === userId ? "creator" : "brand",
      reference: c.reference,
      genre: "deal",
      intitule: d.title,
      montant: d.amount,
      terms_snapshot: c.terms_snapshot as Json | null,
      statut: c.status,
      brand_signed_at: c.brand_signed_at,
      creator_signed_at: c.creator_signed_at,
      terminated_at: c.terminated_at,
    });
  }

  for (const c of cadres.data ?? []) {
    const reste = c.brand_id === userId ? c.creator_id : c.brand_id;
    if (!reste) continue;
    aNommer.add(reste);
    lignes.push({
      partie_id: reste,
      partie_role: c.brand_id === userId ? "creator" : "brand",
      reference: c.reference,
      genre: "affiliate",
      intitule: `Affiliation ${c.period_year ?? ""}`.trim(),
      montant: null,
      terms_snapshot: c.terms_snapshot as Json | null,
      statut: c.status,
      brand_signed_at: c.brand_signed_at,
      creator_signed_at: c.creator_signed_at,
      terminated_at: c.terminated_at,
    });
  }

  if (lignes.length === 0) return 0;

  // Le nom du partant, figé. On le lit AVANT la suppression — après, il n'y a
  // plus rien à lire, et c'est tout l'objet de cette fonction.
  const [marque, createur] = await Promise.all([
    admin.from("brands").select("name").eq("id", userId).maybeSingle(),
    admin.from("creators").select("handle").eq("id", userId).maybeSingle(),
  ]);
  const nomDuPartant =
    marque.data?.name ??
    (createur.data?.handle ? `@${createur.data.handle}` : "Compte supprimé");

  const { error } = await admin.from("contrats_archives").upsert(
    lignes.map((l) => ({ ...l, contrepartie_nom: nomDuPartant })),
    { onConflict: "partie_id,reference", ignoreDuplicates: true },
  );
  if (error) throw new Error(`archivage des contrats : ${error.message}`);

  return lignes.length;
}
