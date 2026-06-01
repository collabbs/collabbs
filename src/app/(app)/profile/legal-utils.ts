/**
 * Utilitaires légaux (non server-action, peuvent être appelés côté client
 * ou serveur sans contrainte).
 */

/** Statuts juridiques supportés (FR). */
export const LEGAL_STATUSES = [
  { id: "individual", label: "Particulier" },
  { id: "micro", label: "Auto-entrepreneur / Micro-entreprise" },
  { id: "ei", label: "Entreprise individuelle (EI)" },
  { id: "sas", label: "SAS / SASU" },
  { id: "sarl", label: "SARL / EURL" },
  { id: "sa", label: "SA" },
  { id: "other", label: "Autre" },
] as const;

export type LegalStatus = (typeof LEGAL_STATUSES)[number]["id"];

export type LegalInfoData = {
  status: string;
  legalName: string;
  repName: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  siret: string;
  vat: string;
  contactEmail: string;
};

/**
 * Champs requis pour pouvoir générer un contrat propre.
 * Statut, nom légal, adresse complète (rue + ville + cp).
 * (SIRET et TVA sont conditionnels au statut pro, vérifiés côté UI.)
 */
export function isLegalInfoComplete(
  row:
    | {
        status?: string | null;
        legal_name?: string | null;
        address?: string | null;
        city?: string | null;
        zip?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!row) return false;
  return Boolean(
    row.status && row.legal_name && row.address && row.city && row.zip,
  );
}
