import "server-only";
import { reportError } from "@/lib/report-error";

/**
 * Une écriture en base a échoué. Que dit-on, et à qui ?
 *
 * ─── Ce que faisaient les quarante appelants ───
 * `return { ok: false, error: error.message }`. Deux conséquences, et la
 * seconde est la pire.
 *
 * D'abord l'utilisateur lisait le texte de Postgres : en anglais, technique, et
 * nommant nos tables — « new row violates row-level security policy for table
 * "messages" » dans un fil de discussion, « invalid input value for enum
 * campaign_status » sur un bouton de mise en pause. Les deux ont été constatés
 * les 22 et 23/10/2026 en appelant les actions concernées.
 *
 * Ensuite, et surtout : l'erreur réelle n'allait NULLE PART. Quarante façons
 * d'échouer à écrire, et pas une ligne dans `error_reports`. Une panne de base
 * qui touche tout le monde se serait manifestée par des utilisateurs qui
 * racontent des choses incompréhensibles, et par rien du côté de
 * l'administration.
 *
 * ─── Ce que fait cette fonction ───
 * Elle signale l'erreur vraie, et rend la phrase que l'appelant a écrite pour
 * SA situation. Pas de message générique : « Ta candidature n'a pas pu être
 * envoyée » et « Le contenu n'a pas pu être déposé » ne se remplacent pas.
 *
 * Elle rend une chaîne plutôt que de lever : un échec d'écriture est une
 * réponse normale de l'action, pas un accident.
 */
export async function echecEcriture(
  contexte: string,
  error: unknown,
  message: string,
  meta?: { userId?: string; detail?: string },
): Promise<string> {
  await reportError(contexte, error, meta);
  return message;
}
