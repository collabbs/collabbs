import "server-only";
import { createAdminClient } from "./supabase/admin";
import { demoVisible } from "./demo-data";

/**
 * Le paquet du défilé, côté créateur : des briefs, pas des marques.
 *
 * ─── Pourquoi des briefs ───
 * Si la marque défile sur des créateurs et le créateur sur des marques, le
 * créateur ouvre le défilé et voit UNE marque — il ferme et ne revient pas. Un
 * brief, lui, se renouvelle : une marque en publie plusieurs, ils ont une date,
 * et on se prononce sur du concret plutôt que sur un logo.
 *
 * ─── Pourquoi la clé de service ───
 * Le défilé est public, sans compte : c'est la condition pour qu'il fasse
 * venir du monde. Les campagnes ne sont pas lisibles par un client anonyme via
 * RLS, et il n'est pas question d'ouvrir la table. On lit donc côté serveur et
 * on ne renvoie au navigateur QUE ce qui s'affiche sur une carte — jamais
 * l'identifiant de la marque, ses coordonnées ou ses réglages.
 */

export type BriefDefile = {
  id: string;
  marque: string;
  produit: string | null;
  type: string;
  /** Montant fixe en euros, si la campagne en propose un. */
  montant: number | null;
  /**
   * Commission en pourcentage. `min`/`max` diffèrent quand la campagne paie
   * par paliers selon la taille du créateur.
   */
  commission: { min: number; max: number } | null;
  spots: number | null;
  niches: number[];
};

/**
 * Les campagnes ouvertes, telles qu'un visiteur non connecté peut les voir.
 *
 * Même filtre que `/opportunities` : les marques de démonstration restent
 * masquées en production. Une carte qui ne peut jamais répondre est pire
 * qu'une carte absente — le visiteur investit un geste dans le vide.
 */
export async function briefsDuDefile(): Promise<BriefDefile[]> {
  const admin = createAdminClient();

  const requete = admin
    .from("campaigns")
    .select(
      "id, name, description, type, fixed_amount, commission_value, commission_nano, commission_macro, spots, brands!inner(name, is_demo), campaign_niches(niche_id)",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data, error } = demoVisible()
    ? await requete
    : await requete.neq("brands.is_demo", true);

  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    marque: c.brands?.name ?? "Une marque",
    // La description sert de sous-titre. Tronquée ici et pas à l'affichage :
    // on ne fait pas voyager trois paragraphes jusqu'au navigateur pour en
    // montrer deux lignes.
    produit: c.description ? c.description.slice(0, 140) : null,
    type: c.type ?? "video",
    montant: c.fixed_amount != null ? Number(c.fixed_amount) : null,
    // Une campagne à paliers n'a pas de `commission_value` : elle porte un taux
    // par tranche d'audience. Sans ce repli, sa carte s'affichait SANS AUCUN
    // montant — et une carte sans rémunération est une carte qu'on passe.
    commission: (() => {
      const bornes = [c.commission_value, c.commission_nano, c.commission_macro]
        .filter((v): v is number => v != null)
        .map(Number);
      if (bornes.length === 0) return null;
      return { min: Math.min(...bornes), max: Math.max(...bornes) };
    })(),
    spots: c.spots ?? null,
    niches: (c.campaign_niches ?? []).map((n) => n.niche_id),
  }));
}
