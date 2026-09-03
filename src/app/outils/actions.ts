"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, RATE_POLICIES, clientIp } from "@/lib/rate-limit";
import { resend, RESEND_FROM } from "@/lib/resend";
import { SITE } from "@/lib/legal-entity";
import { emailPlausible, normaliserEmail } from "@/lib/email-valide";

export type ResultatCapture = { ok: boolean; error?: string };

/**
 * Enregistre une adresse laissée sur un outil public, et envoie la contrepartie.
 *
 * ─── Ce que cette action n'est PAS ───
 * Ce n'est pas un mur. Les outils restent entièrement gratuits et utilisables
 * sans rien donner ; le formulaire n'apparaît qu'au moment où la personne a
 * découvert une obligation légale et où le modèle de contrat lui sert
 * réellement. Une capture qui précède la valeur n'est pas une capture, c'est
 * un péage — et sur un outil que personne n'est obligé d'utiliser, un péage
 * ne collecte rien.
 *
 * ─── Pourquoi la clé de service ───
 * `tool_leads` n'a aucune politique RLS et est explicitement retirée à `anon`
 * et `authenticated` : une adresse e-mail laissée sur une page publique n'a
 * pas à être lisible depuis un navigateur. L'écriture passe donc par le
 * serveur, jamais par le client.
 */
export async function capturerProspect(params: {
  email: string;
  source: string;
  /**
   * Contexte au moment de la capture. Volontairement limité à des valeurs
   * simples : ce champ décrit une SITUATION (« trois marques au-dessus du
   * seuil »), il n'est pas un fourre-tout où finirait par atterrir, un jour,
   * la liste des collaborations de quelqu'un.
   */
  contexte?: Record<string, string | number | boolean | null>;
}): Promise<ResultatCapture> {
  const email = normaliserEmail(params.email);
  if (!emailPlausible(email)) {
    return { ok: false, error: "Cette adresse ne semble pas valide." };
  }

  // Sans plafond, ce formulaire public devient un moyen d'envoyer des e-mails
  // au nom de Collabbs à des adresses arbitraires — et notre domaine finit
  // signalé. On borne sur l'IP, comme l'inscription.
  const ip = clientIp(await headers());
  const verdict = await checkRateLimit(ip ? `outils:capture:${ip}` : null, RATE_POLICIES.auth);
  if (!verdict.allowed) {
    return { ok: false, error: "Trop de demandes depuis cette connexion. Réessaie dans quelques minutes." };
  }

  const admin = createAdminClient();

  // `upsert` sur (lower(email), source) : quelqu'un qui revient recalculer et
  // redemande le modèle ne doit pas créer de doublon — mais il doit quand même
  // recevoir son e-mail, sinon il croit que ça n'a pas marché.
  const { error } = await admin
    .from("tool_leads")
    .upsert(
      {
        email,
        source: params.source,
        contexte: params.contexte ?? {},
      },
      { onConflict: "email,source", ignoreDuplicates: false },
    );

  // Une adresse déjà connue n'est pas un échec pour la personne en face : elle
  // veut son document. On journalise et on continue.
  if (error) {
    console.error("[outils] enregistrement du prospect impossible", error.message);
  }

  const lien = `${SITE.url}/outils/modele-contrat`;
  try {
    const { error: erreurEnvoi } = await resend.emails.send({
      from: RESEND_FROM,
      to: email,
      subject: "Ton modèle de contrat conforme au décret",
      html: courrielModele(lien),
    });
    // Resend NE LÈVE PAS sur un refus : il renvoie l'erreur dans la réponse.
    if (erreurEnvoi) throw new Error(erreurEnvoi.message ?? "Resend a refusé l'envoi");
  } catch (e) {
    console.error("[outils] envoi du modèle impossible", e);
    // Le document est une page publique : si l'e-mail échoue, la personne
    // peut quand même l'obtenir. On le dit plutôt que d'afficher un succès
    // qui laisserait quelqu'un attendre un courrier qui n'arrivera pas.
    return {
      ok: false,
      error: `L'e-mail n'a pas pu partir. Le modèle reste accessible ici : ${lien}`,
    };
  }

  return { ok: true };
}

/** Corps du courriel. Volontairement court : le document est au bout du lien. */
function courrielModele(lien: string): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:28px">
    <p style="margin:0 0 16px;font-size:18px;font-weight:700">Voici ton modèle de contrat</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">
      Il reprend les mentions rendues obligatoires par le décret n°&nbsp;2025-1137,
      celui qui impose le contrat écrit dès 1&nbsp;000&nbsp;€ HT cumulés sur l'année
      avec une même marque, avantages en nature compris.
    </p>
    <p style="margin:0 0 24px">
      <a href="${lien}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">Ouvrir le modèle</a>
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#52525b">
      Les passages entre crochets sont à compléter. Ce modèle n'a pas été rédigé
      par un professionnel du droit et ne remplace pas son avis.
    </p>
    <p style="margin:0;padding-top:16px;border-top:1px solid #e4e4e7;font-size:13px;line-height:1.6;color:#71717a">
      Tu reçois ce message parce que tu l'as demandé sur ${SITE.url}. On ne
      t'écrira pas pour autre chose sans que tu le demandes.
    </p>
  </div>
</body></html>`;
}
