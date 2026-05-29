import "server-only";
import Stripe from "stripe";

// Client Stripe côté serveur uniquement (compte Collabbs, mode test pour l'instant).
// La clé secrète ne doit JAMAIS être exposée au navigateur.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
