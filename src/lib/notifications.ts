import "server-only";
import { headers } from "next/headers";
import { resend, RESEND_FROM } from "./resend";
import { createAdminClient } from "./supabase/admin";

/**
 * Notifie un user :
 *   1) Insère un row dans `notifications` (toujours, pour le centre in-app).
 *   2) Envoie un email transactionnel via Resend (peut être throttled).
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
  /** Si défini, on ne ré-envoie pas d'email si une notif identique a été créée dans cette fenêtre (minutes). */
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

  if (throttled) return;

  try {
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(args.userId);
    if (userErr || !userData.user?.email) return;
    const to = userData.user.email;

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

    await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject: args.title,
      html: renderEmail({ title: args.title, body: args.body, link: fullLink }),
    });
  } catch {
    /* noop — l'email peut échouer (quota Resend, etc.) sans bloquer */
  }
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
