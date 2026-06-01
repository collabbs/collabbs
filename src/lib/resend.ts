/**
 * Resend client — SERVER ONLY.
 *
 * The Resend API key gives full permission to send emails from our domain.
 * Importing this module into a Client Component would expose the key to the
 * browser bundle. The `server-only` import causes a build-time error if that
 * ever happens, instead of a silent leak.
 */

import "server-only";
import { Resend } from "resend";

// Init paresseux : on évite de throw au chargement du module, sinon `next build`
// sur Vercel échoue à la phase "Collecting page data" si la clé n'est pas
// posée. On throw au premier appel runtime, où l'erreur sera bien plus parlante.
let _resendInstance: Resend | null = null;
function getResendInstance(): Resend {
  if (_resendInstance) return _resendInstance;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY env var. Set it in .env.local for dev and in Vercel for prod.",
    );
  }
  _resendInstance = new Resend(apiKey);
  return _resendInstance;
}

export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const instance = getResendInstance();
    const value = (instance as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/**
 * Sender address used by default for all outgoing emails.
 * Si l'env est absente, on renvoie une chaîne vide — Resend remontera son
 * propre message d'erreur au moment du `resend.emails.send()`.
 */
export const RESEND_FROM = process.env.RESEND_FROM ?? "";
