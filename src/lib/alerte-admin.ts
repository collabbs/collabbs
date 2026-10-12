import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

/**
 * Prévient les administrateurs de Collabbs qu'une chaîne d'argent est cassée.
 *
 * ─── Pourquoi ça n'existait pas, et pourquoi il le fallait ───
 * Le 07/10/2026, le webhook Stripe a refusé toutes les signatures pendant
 * CINQ JOURS. Personne ne l'a su. La provision de la marque était quand même
 * créditée — par la route de retour, celle qui ramène le navigateur sur le
 * site après paiement — donc tout avait l'air normal. Un client qui ferme son
 * onglet avant la redirection, lui, aurait payé sans rien recevoir, et le
 * défaut serait resté invisible jusqu'à ce qu'il se plaigne.
 *
 * `reportError` existait déjà, mais elle écrit dans une table qu'on CONSULTE.
 * Une alerte qu'il faut aller chercher n'est pas une alerte. Ici on pousse :
 * notification dans le produit, et e-mail.
 *
 * ─── La fenêtre ───
 * Stripe et Shopify réessaient un webhook en échec pendant des jours. Sans
 * limite, cinq jours de tentatives horaires feraient cent vingt alertes, et la
 * centième serait ignorée comme la première. Une par fenêtre suffit à savoir.
 * La fenêtre couvre aussi la LIGNE, pas seulement l'e-mail : `notify` avec son
 * `throttleMinutes` n'évite que le second envoi, pas la pile de notifications.
 *
 * Ne lève jamais : prévenir d'une panne ne doit pas en provoquer une seconde,
 * ni faire échouer l'appelant — qui est en train de répondre à Stripe.
 */
export async function alerterAdmins(args: {
  /** Identifiant stable de l'incident : sert à la déduplication. */
  type: string;
  title: string;
  body: string;
  link?: string;
  /** Défaut : 6 h. Assez pour ne pas noyer, assez court pour ne pas dormir. */
  fenetreMinutes?: number;
}): Promise<void> {
  const fenetre = args.fenetreMinutes ?? 360;
  try {
    const admin = createAdminClient();

    const depuis = new Date(Date.now() - fenetre * 60_000).toISOString();
    const { data: recente } = await admin
      .from("notifications")
      .select("id")
      .eq("type", args.type)
      .gte("created_at", depuis)
      .limit(1);
    if (recente && recente.length > 0) return;

    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .eq("is_admin", true);
    if (!admins?.length) return;

    for (const a of admins) {
      await notify({
        userId: a.id as string,
        type: args.type,
        title: args.title,
        body: args.body,
        link: args.link,
      });
    }
  } catch {
    /* Silence volontaire : voir l'en-tête. L'appelant doit répondre à Stripe. */
  }
}
