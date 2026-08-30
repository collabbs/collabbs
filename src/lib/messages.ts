/**
 * Fusion du fil de discussion.
 *
 * Un même message peut arriver TROIS fois dans l'état du navigateur :
 *  1. en optimiste, dès qu'on clique sur « Envoyer » (avant la réponse serveur) ;
 *  2. par Supabase Realtime, quand Postgres diffuse l'insertion ;
 *  3. par le rendu serveur, quand la Server Action revalide la page.
 *
 * Ces trois chemins ne sont pas ordonnés : le temps réel peut devancer la
 * réponse de la Server Action. On ne peut donc pas dédupliquer « au dernier
 * arrivé ». La parade est en amont : le navigateur tire lui-même l'UUID du
 * message et l'impose à l'insertion, si bien que les trois copies portent le
 * MÊME identifiant et que la fusion par `id` suffit.
 */

export type ThreadMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/** Un UUID v4 tel que produit par `crypto.randomUUID()`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Fusionne `incoming` dans `current` et renvoie le fil trié.
 *
 * En cas de doublon d'`id`, la version `incoming` gagne : elle vient de la base
 * (horodatage réel) alors que la copie optimiste porte l'heure du navigateur,
 * qui peut dériver de plusieurs secondes et faire sauter le message de place.
 */
export function mergeMessages(
  current: readonly ThreadMessage[],
  incoming: readonly ThreadMessage[],
): ThreadMessage[] {
  const byId = new Map<string, ThreadMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);

  return [...byId.values()].sort((a, b) => {
    const diff = a.created_at.localeCompare(b.created_at);
    // Deux messages à la même milliseconde existent (import, tests) : on
    // départage par id pour que l'ordre reste stable d'un rendu à l'autre.
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

/** Retire un message du fil — utilisé quand un envoi optimiste a échoué. */
export function removeMessage(
  current: readonly ThreadMessage[],
  id: string,
): ThreadMessage[] {
  return current.filter((m) => m.id !== id);
}
