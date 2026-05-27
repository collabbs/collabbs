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

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;

if (!apiKey) {
  throw new Error(
    "Missing RESEND_API_KEY env var. Set it in .env.local for dev and in Vercel for prod.",
  );
}

if (!from) {
  throw new Error(
    'Missing RESEND_FROM env var. Format: "Collabbs <hello@send.collabbs.com>" — display name + verified email address.',
  );
}

export const resend = new Resend(apiKey);

/** Sender address used by default for all outgoing emails. */
export const RESEND_FROM = from;
