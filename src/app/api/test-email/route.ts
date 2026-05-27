/**
 * Temporary email-sending probe.
 *
 * POST /api/test-email
 *   Body (optional): { "to": "someone@example.com" }
 *
 * Sends a single test email via Resend and returns the result. Useful to:
 *   - Verify Resend is wired up (env vars set, SDK installed)
 *   - Confirm DNS (DKIM/SPF/MX) is valid for the sender domain
 *   - Sanity-check that the recipient inbox receives the message
 *
 * Delete this route once email sending is covered by real product code
 * (signup confirmation, password reset, notifications, etc.).
 */

import { resend, RESEND_FROM } from "@/lib/resend";

// Default recipient when no body is provided — easy to test from a browser.
const DEFAULT_TO = "julien.vinted37@gmail.com";

export async function POST(request: Request) {
  let to = DEFAULT_TO;

  // Parse body if any. Tolerate empty/invalid bodies (browser-friendly).
  try {
    const body = (await request.json()) as { to?: unknown } | null;
    if (body && typeof body.to === "string" && body.to.includes("@")) {
      to = body.to;
    }
  } catch {
    // No body or invalid JSON — fall back to DEFAULT_TO.
  }

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject: "Collabbs — Test email",
    html: `
      <h1>Hello from Collabbs 👋</h1>
      <p>Si tu lis ça, c'est que Resend est correctement configuré :</p>
      <ul>
        <li>API key OK</li>
        <li>Domaine <code>send.collabbs.com</code> vérifié</li>
        <li>DNS (DKIM, SPF, MX) propagés chez Hostinger</li>
      </ul>
      <p>Envoyé depuis <code>${RESEND_FROM}</code> à <code>${to}</code>.</p>
      <hr>
      <p style="color:#888;font-size:12px">Cette route est temporaire — sera supprimée quand Resend sera utilisé par du vrai code produit.</p>
    `,
  });

  if (error) {
    return Response.json(
      { ok: false, error: { name: error.name, message: error.message } },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, id: data?.id, to, from: RESEND_FROM });
}
