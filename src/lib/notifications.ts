import "server-only";
import { headers } from "next/headers";
import { resend, RESEND_FROM } from "./resend";
import { reportError } from "./report-error";
import { createAdminClient } from "./supabase/admin";

/**
 * Notifie un user :
 *   1) Insère une ligne dans `notifications`, pour le centre in-app.
 *   2) Envoie un e-mail transactionnel via Resend.
 *
 * `throttleMinutes` couvre LES DEUX. Il ne couvrait que l'e-mail, et la ligne
 * s'ajoutait quand même : un cron quotidien portant un plafond hebdomadaire
 * envoyait un e-mail par semaine et SEPT lignes identiques. Mesuré le
 * 23/10/2026 sur le projet de développement — trois passages du cron de
 * versement avaient créé 276 rappels « relie ton compte » pour 92 créateurs.
 *
 * Un créateur sans compte de paiement voyait donc sa pastille monter d'un par
 * jour, indéfiniment, avec le même message — ce qui finit par dévaluer toutes
 * les autres notifications. Personne n'écrit un plafond en souhaitant sept
 * lignes identiques : l'intention porte sur l'information, pas sur le canal.
 *
 * `alerterAdmins` avait dû se construire son propre garde-fou pour cette
 * raison. Le sien reste utile — il déduplique par TYPE, tous administrateurs
 * confondus, là où celui-ci déduplique par destinataire.
 *
 * Échoue silencieusement : une notif ratée ne doit JAMAIS casser l'action
 * métier qui l'a déclenchée (paiement, deal, etc.).
 */
export async function notify(args: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  /** Chemin relatif (ex. "/deals/xxx") — on construit l'URL complète à partir de la requête. */
  link?: string;
  /**
   * Fenêtre de silence, en minutes. Si une notification de même type et même
   * lien existe déjà pour ce destinataire dans la fenêtre, on ne crée NI la
   * ligne NI l'e-mail. Sans `link`, la fenêtre ne s'applique pas — il n'y a
   * pas de quoi reconnaître « la même » notification.
   */
  throttleMinutes?: number;
}) {
  const admin = createAdminClient();

  let throttled = false;
  try {
    if (args.throttleMinutes && args.link) {
      const since = new Date(Date.now() - args.throttleMinutes * 60 * 1000).toISOString();
      const { data: recent } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", args.userId)
        .eq("type", args.type)
        .eq("link", args.link)
        .gte("created_at", since)
        .limit(1);
      throttled = Boolean(recent && recent.length > 0);
    }

    // Rien à ajouter : la personne a déjà cette information sous les yeux.
    if (throttled) return;

    await admin.from("notifications").insert({
      user_id: args.userId,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
    });
  } catch {
    /* noop — l'action métier doit continuer */
  }

  try {
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(args.userId);
    if (userErr || !userData.user?.email) return;
    const to = userData.user.email;

    /* ═══ LE SEUL ENDROIT OÙ CE CONTRÔLE A SA PLACE ═══

       Les comptes de démonstration portent des adresses en `@collabbs.test`
       (un domaine RÉSERVÉ par la RFC 2606 : il ne résout jamais) et
       `@collabbs.dev` (aucun enregistrement MX). Écrire là-bas ne produit que
       des rebonds durs, et un domaine d'expédition neuf n'en supporte pas
       beaucoup avant d'être classé indésirable partout.

       Ce garde-fou existait dans UN cron sur huit. Le résultat était mesurable :
       le 10 septembre à 9h30, `profile-incomplete` a tenté 28 envois vers
       `.test` — et il tourne tous les jours. Protéger chaque appelant, c'est
       oublier le neuvième.

       On le pose donc là où l'email part réellement. La notification EN BASE,
       elle, reste écrite : elle est visible dans le produit, elle ne coûte
       rien, et elle garde la trace de ce qui aurait été dit. */
    const DOMAINES_SANS_COURRIER = ["@collabbs.test", "@collabbs.dev", "@example.com", "@example.org"];
    if (DOMAINES_SANS_COURRIER.some((d) => to.toLowerCase().endsWith(d))) return;

    let origin = "https://collabbs.com";
    try {
      const h = await headers();
      const host = h.get("host");
      if (host) {
        const proto = host.startsWith("localhost") ? "http" : "https";
        origin = `${proto}://${host}`;
      }
    } catch {
      /* headers() pas dispo (cron, etc.) → fallback prod */
    }
    const fullLink = args.link ? `${origin}${args.link}` : origin;

    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: args.title,
      html: renderEmail({ title: args.title, body: args.body, link: fullLink }),
    });
    // Resend ne LÈVE PAS sur un refus : il renvoie une erreur dans la réponse.
    // Le `catch` ci-dessous ne la voyait donc jamais.
    if (error) throw new Error(error.message ?? "Resend a refusé l'envoi");
  } catch (e) {
    // Ne JAMAIS bloquer : la notification dans l'app est déjà créée, et un
    // e-mail raté ne doit pas faire échouer l'action de l'utilisateur.
    //
    // Mais ne plus se taire non plus. Ce `catch` était un noop complet : le
    // jour où la clé Resend expire, plus aucun e-mail ne part — ni relance de
    // deadline, ni « tu as reçu 270 € », ni « une marque te propose une
    // collaboration » — et personne ne l'apprend. Les deux côtés attendent un
    // message qui n'existe pas.
    //
    // Le registre d'erreurs groupe par contexte et compte les occurrences :
    // une clé morte y apparaîtra comme une seule ligne à 4 000 fois, ce qui se
    // remarque immédiatement.
    await reportError("notifications/email", e, {
      userId: args.userId,
      detail: `Envoi échoué pour « ${args.title} ».`,
    });
  }
}

/**
 * Variante "une seule fois dans la vie" : ne notifie que si AUCUNE notification
 * du même type n'existe déjà pour ce user. Pratique pour les events « 1ʳᵉ fois ».
 */
export async function notifyOnce(args: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  try {
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", args.userId)
      .eq("type", args.type)
      .limit(1);
    if (existing && existing.length > 0) return false;
  } catch {
    return false;
  }
  await notify(args);
  return true;
}

// ===== Template HTML transactionnel ===== //

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function renderEmail({
  title,
  body,
  link,
}: {
  title: string;
  body?: string;
  link: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeBody = body ? escapeHtml(body) : "";
  const safeLink = escapeHtml(link);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);overflow:hidden;">
        <tr><td style="padding:32px;">
          <div style="font-weight:900;font-size:24px;letter-spacing:-0.02em;">
            <span style="color:#18181b;">colla</span><span style="color:#9333ea;">bb</span><span style="color:#18181b;">s</span>
          </div>
          <h1 style="margin:24px 0 12px;font-size:22px;line-height:1.3;color:#111;">${safeTitle}</h1>
          ${safeBody ? `<p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">${safeBody}</p>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
            <tr><td>
              <a href="${safeLink}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#9333ea,#ec4899);color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">Ouvrir sur Collabbs</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 24px;border-top:1px solid #f3f4f6;">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">
            Tu reçois cet email parce que tu as un compte Collabbs.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
