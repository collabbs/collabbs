import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_STATUSES } from "@/app/(app)/profile/legal-utils";

/**
 * Snapshot d'un contrat — gelé au moment de la signature.
 * Stocké dans `contracts.terms_snapshot` (jsonb). Une fois figé, ne change
 * plus, même si une partie modifie ses infos légales ensuite. C'est le
 * principe d'un contrat : la photographie des engagements au moment T.
 */
export type ContractSnapshot = {
  version: 1;
  generated_at: string;
  /**
   * Régime au moment de la signature — figé lui aussi. Un contrat signé sous
   * le seuil reste simplifié même si le cumul annuel monte ensuite : ce qui
   * compte, c'est l'état du droit applicable au jour de l'engagement.
   */
  regime?: "simplified" | "complete";
  /** Coordonnées légales gelées des 2 parties. */
  brand: PartySnapshot;
  creator: PartySnapshot;
  /** Termes du deal au moment de la signature. */
  deal: {
    title: string | null;
    amount: number;
    format: string;
    platform_id: number | null;
    quantity: number;
    deadline: string | null;
    brand_notes: string | null;
    exclusivity: boolean;
    exclusivity_days: number | null;
    usage_rights_months: number | null;
    usage_rights_scope: "organic" | "paid" | null;
    usage_rights_fee: number | null;
  };
};

export type PartySnapshot = {
  user_id: string;
  display_name: string;
  /** Libellé lisible du statut juridique (résolu depuis LEGAL_STATUSES). */
  legal_status_label: string | null;
  legal_name: string | null;
  rep_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  siret: string | null;
  vat: string | null;
  contact_email: string | null;
};

/**
 * Résultat de la construction :
 * - `ok: true` → snapshot complet, on peut signer.
 * - `ok: false` + `missing` → l'une des parties n'a pas ses infos minimum.
 *   Le call-site décide quoi faire (message d'erreur, blocage).
 */
export type BuildResult =
  | {
      ok: true;
      snapshot: ContractSnapshot;
      /**
       * Renseigné en régime simplifié : ce qui manque encore, sans bloquer.
       * Permet d'avertir sans empêcher la signature sous le seuil légal.
       */
      incomplete?: { who: "brand" | "creator"; fields: string[] }[];
    }
  | {
      ok: false;
      reason: "deal_not_found" | "incomplete_legal_info";
      missing?: { who: "brand" | "creator"; fields: string[] };
    };

const REQUIRED_FIELDS = ["status", "legal_name", "address", "city", "zip"] as const;

type LegalRow = {
  status: string | null;
  legal_name: string | null;
  rep_name: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  country: string | null;
  siret: string | null;
  vat: string | null;
  contact_email: string | null;
};

function missingFields(row: LegalRow | null): string[] {
  if (!row) return [...REQUIRED_FIELDS];
  return REQUIRED_FIELDS.filter((k) => !row[k]);
}

function statusLabel(id: string | null): string | null {
  if (!id) return null;
  return LEGAL_STATUSES.find((s) => s.id === id)?.label ?? id;
}

/**
 * Construit l'identité gelée d'une partie, indépendamment de toute
 * collaboration.
 *
 * Extraite pour le contrat-cadre d'affiliation, qui n'a pas de deal d'où
 * déduire les parties. Une seule définition de « qui est cette partie » —
 * la dupliquer dans du code juridique serait l'assurance qu'elles divergent.
 */
export async function partySnapshotFor(
  userId: string,
  role: "brand" | "creator",
): Promise<{ party: PartySnapshot; missing: string[] }> {
  const admin = createAdminClient();

  const [legal, profile, row] = await Promise.all([
    admin
      .from("legal_info")
      .select(
        "status, legal_name, rep_name, address, city, zip, country, siret, vat, contact_email",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    role === "brand"
      ? admin.from("brands").select("name").eq("id", userId).maybeSingle()
      : admin.from("creators").select("handle").eq("id", userId).maybeSingle(),
  ]);

  const l = legal.data;
  const nom =
    role === "brand"
      ? ((row.data as { name?: string } | null)?.name ??
        profile.data?.display_name ??
        "Marque")
      : (profile.data?.display_name ??
        ((row.data as { handle?: string } | null)?.handle
          ? `@${(row.data as { handle?: string }).handle}`
          : "Créateur"));

  return {
    party: {
      user_id: userId,
      display_name: nom,
      legal_status_label: statusLabel(l?.status ?? null),
      legal_name: l?.legal_name ?? null,
      rep_name: l?.rep_name ?? null,
      address: l?.address ?? null,
      city: l?.city ?? null,
      zip: l?.zip ?? null,
      country: l?.country ?? null,
      siret: l?.siret ?? null,
      vat: l?.vat ?? null,
      contact_email: l?.contact_email ?? null,
    },
    missing: missingFields(l ?? null),
  };
}

/**
 * Construit le snapshot complet d'un deal en lisant via admin client.
 * Bypass RLS volontairement : c'est un appel server-side au moment de la
 * signature, on a besoin des coordonnées légales des 2 parties qui ne se
 * sont pas mutuellement autorisées à se lire.
 */
export async function buildContractSnapshot(
  dealId: string,
  opts: { allowIncomplete?: boolean } = {},
): Promise<BuildResult> {
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select(
      "brand_id, creator_id, title, amount, format, platform_id, quantity, deadline, brand_notes, exclusivity, exclusivity_days, usage_rights_months, usage_rights_scope, usage_rights_fee",
    )
    .eq("id", dealId)
    .single();
  if (!deal) return { ok: false, reason: "deal_not_found" };

  const [brandLegal, creatorLegal, brandProfile, creatorProfile, brandRow, creatorRow] =
    await Promise.all([
      admin
        .from("legal_info")
        .select(
          "status, legal_name, rep_name, address, city, zip, country, siret, vat, contact_email",
        )
        .eq("user_id", deal.brand_id)
        .maybeSingle(),
      admin
        .from("legal_info")
        .select(
          "status, legal_name, rep_name, address, city, zip, country, siret, vat, contact_email",
        )
        .eq("user_id", deal.creator_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", deal.brand_id)
        .single(),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", deal.creator_id)
        .single(),
      admin.from("brands").select("name").eq("id", deal.brand_id).maybeSingle(),
      admin.from("creators").select("handle").eq("id", deal.creator_id).maybeSingle(),
    ]);

  // Validation : les 2 parties doivent avoir le minimum.
  // En régime simplifié (sous le seuil légal de 1 000 €/an), on laisse passer
  // et on se contente de signaler ce qui manque.
  const bMissing = missingFields(brandLegal.data);
  const cMissing = missingFields(creatorLegal.data);
  const incomplete: { who: "brand" | "creator"; fields: string[] }[] = [];
  if (bMissing.length > 0) incomplete.push({ who: "brand", fields: bMissing });
  if (cMissing.length > 0) incomplete.push({ who: "creator", fields: cMissing });

  if (!opts.allowIncomplete) {
    if (bMissing.length > 0) {
      return {
        ok: false,
        reason: "incomplete_legal_info",
        missing: { who: "brand", fields: bMissing },
      };
    }
    if (cMissing.length > 0) {
      return {
        ok: false,
        reason: "incomplete_legal_info",
        missing: { who: "creator", fields: cMissing },
      };
    }
  }

  const brand: PartySnapshot = {
    user_id: deal.brand_id,
    display_name: brandRow.data?.name ?? brandProfile.data?.display_name ?? "Marque",
    legal_status_label: statusLabel(brandLegal.data?.status ?? null),
    legal_name: brandLegal.data?.legal_name ?? null,
    rep_name: brandLegal.data?.rep_name ?? null,
    address: brandLegal.data?.address ?? null,
    city: brandLegal.data?.city ?? null,
    zip: brandLegal.data?.zip ?? null,
    country: brandLegal.data?.country ?? null,
    siret: brandLegal.data?.siret ?? null,
    vat: brandLegal.data?.vat ?? null,
    contact_email: brandLegal.data?.contact_email ?? null,
  };

  const creator: PartySnapshot = {
    user_id: deal.creator_id,
    display_name:
      creatorProfile.data?.display_name ??
      (creatorRow.data?.handle ? `@${creatorRow.data.handle}` : "Créateur"),
    legal_status_label: statusLabel(creatorLegal.data?.status ?? null),
    legal_name: creatorLegal.data?.legal_name ?? null,
    rep_name: creatorLegal.data?.rep_name ?? null,
    address: creatorLegal.data?.address ?? null,
    city: creatorLegal.data?.city ?? null,
    zip: creatorLegal.data?.zip ?? null,
    country: creatorLegal.data?.country ?? null,
    siret: creatorLegal.data?.siret ?? null,
    vat: creatorLegal.data?.vat ?? null,
    contact_email: creatorLegal.data?.contact_email ?? null,
  };

  return {
    ok: true,
    snapshot: {
      version: 1,
      generated_at: new Date().toISOString(),
      brand,
      creator,
      deal: {
        title: deal.title ?? null,
        amount: deal.amount,
        format: deal.format,
        platform_id: deal.platform_id ?? null,
        quantity: deal.quantity,
        deadline: deal.deadline ?? null,
        brand_notes: deal.brand_notes ?? null,
        exclusivity: deal.exclusivity,
        exclusivity_days: deal.exclusivity_days ?? null,
        usage_rights_months: deal.usage_rights_months ?? null,
        usage_rights_scope: deal.usage_rights_scope ?? null,
        usage_rights_fee: deal.usage_rights_fee ?? null,
      },
    },
    ...(incomplete.length > 0 ? { incomplete } : {}),
  };
}

/** Labels lisibles pour les champs manquants (à utiliser dans les messages d'erreur). */
export const LEGAL_FIELD_LABELS: Record<string, string> = {
  status: "statut juridique",
  legal_name: "nom légal",
  address: "adresse",
  city: "ville",
  zip: "code postal",
};
