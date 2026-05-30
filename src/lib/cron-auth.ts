/**
 * Vérifie qu'un appel à /api/cron/* vient bien d'un déclencheur autorisé.
 * Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>` automatiquement
 * si la variable est définie sur le projet.
 */
export function isAuthorizedCron(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}
