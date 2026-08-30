import { z } from "zod";
import { TEXTE_COURT_MAX } from "@/lib/validation";
import { LEGAL_STATUSES } from "@/app/(app)/profile/legal-utils";

/**
 * Contrôles des coordonnées légales.
 *
 * Ces valeurs finissent **gelées dans un contrat signé** : une fois la
 * signature posée, l'instantané ne bouge plus. Un SIRET erroné y devient donc
 * définitif, dans un document qu'une des parties pourrait produire en justice.
 *
 * ⚠️ RÈGLE CENTRALE : **on ne rend RIEN obligatoire ici.** Sous le seuil légal
 * de 1 000 € par an, la loi n'exige pas ces mentions, et un créateur qui fait
 * sa première collaboration à 80 € n'a souvent aucun statut juridique. Le
 * blocage, quand il doit exister, se fait au moment d'accepter une
 * collaboration qui franchit le seuil — pas ici, où on l'empêcherait
 * simplement d'enregistrer son profil.
 *
 * On vérifie donc uniquement le FORMAT de ce qui est fourni. Une chaîne vide
 * est toujours acceptée : elle veut dire « pas encore renseigné ».
 */

const IDENTIFIANTS_STATUTS = LEGAL_STATUSES.map((s) => s.id) as [string, ...string[]];

/**
 * Accepte le vide ; applique le contrôle seulement s'il y a quelque chose.
 *
 * Le message est passé explicitement plutôt que repris du schéma interne :
 * c'est la phrase que lira l'utilisateur, elle mérite d'être écrite là où on
 * la voit.
 */
function siRenseigne(verifie: (valeur: string) => boolean, message: string) {
  return z.string().refine((v) => v.trim() === "" || verifie(v.trim()), {
    error: message,
  });
}

/**
 * Clé de Luhn du SIRET (14 chiffres) ou du SIREN (9 chiffres).
 *
 * Ni l'un ni l'autre n'est une suite de chiffres quelconque : tous deux portent
 * leur propre clé de contrôle. La vérifier attrape la faute de frappe — un
 * chiffre inversé, un chiffre en trop — c'est-à-dire l'erreur qu'on commet
 * réellement en recopiant un extrait Kbis.
 *
 * Le formulaire propose explicitement « 14 chiffres (SIRET) ou 9 (SIREN) » :
 * refuser le SIREN reviendrait à refuser ce qu'on vient de demander.
 *
 * Le doublement se fait de DROITE à gauche, comme le veut Luhn. Sur 14 chiffres
 * cela revient à doubler les positions paires, sur 9 les impaires : compter
 * depuis la gauche marcherait pour le SIRET et échouerait pour le SIREN.
 *
 * Exception connue : La Poste (SIREN 356 000 000) ne satisfait pas Luhn, par
 * héritage historique. La refuser serait refuser un établissement parfaitement
 * réel.
 */
export function siretValide(valeur: string): boolean {
  const chiffres = valeur.replace(/\s/g, "");
  if (!/^\d{9}$/.test(chiffres) && !/^\d{14}$/.test(chiffres)) return false;
  if (chiffres.startsWith("356000000")) return true;

  let somme = 0;
  for (let i = 0; i < chiffres.length; i++) {
    const depuisLaDroite = chiffres.length - 1 - i;
    let n = Number(chiffres[i]);
    if (depuisLaDroite % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

const MESSAGE_SIRET =
  "Ce numéro ne semble pas valide. Un SIRET compte 14 chiffres, un SIREN 9, et tous deux portent une clé de contrôle — vérifie la saisie sur ton extrait Kbis.";

/**
 * Numéro de TVA intracommunautaire français : FR, deux caractères de clé, puis
 * les neuf chiffres du SIREN. On accepte aussi les autres pays de l'Union sans
 * en vérifier la structure : on ne connaît pas les vingt-six formats, et
 * refuser à tort un numéro belge valide serait pire que de le laisser passer.
 */
export function tvaValide(valeur: string): boolean {
  const propre = valeur.replace(/\s/g, "").toUpperCase();
  // Le numéro français, on le connaît : on l'applique STRICTEMENT. Sans ce
  // retour anticipé, un « FR409 » tronqué retomberait sur la règle permissive
  // des autres pays et passerait — alors qu'on sait qu'il est faux.
  if (propre.startsWith("FR")) return /^FR[0-9A-Z]{2}\d{9}$/.test(propre);
  // Autre pays de l'Union : deux lettres puis 2 à 12 caractères.
  return /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(propre);
}

const MESSAGE_TVA =
  "Ce numéro de TVA ne semble pas valide. Un numéro français s'écrit FR suivi de 11 caractères, par exemple FR40912345678.";

/** Code postal français, quand le pays l'est. */
function codePostalValide(v: string): boolean {
  return /^\d{5}$/.test(v.replace(/\s/g, ""));
}

export const coordonneesLegalesSchema = z
  .object({
    status: z
      .string()
      .refine((v) => v === "" || IDENTIFIANTS_STATUTS.includes(v), {
        error: "Ce statut juridique n'est pas reconnu. Choisis-en un dans la liste.",
      }),
    legalName: z.string().max(TEXTE_COURT_MAX, {
      error: `La raison sociale est trop longue (${TEXTE_COURT_MAX} caractères maximum).`,
    }),
    repName: z.string().max(TEXTE_COURT_MAX, {
      error: `Le nom du représentant est trop long (${TEXTE_COURT_MAX} caractères maximum).`,
    }),
    address: z.string().max(TEXTE_COURT_MAX, {
      error: `L'adresse est trop longue (${TEXTE_COURT_MAX} caractères maximum).`,
    }),
    city: z.string().max(TEXTE_COURT_MAX, {
      error: `La ville est trop longue (${TEXTE_COURT_MAX} caractères maximum).`,
    }),
    zip: z.string(),
    country: z.string().max(TEXTE_COURT_MAX, {
      error: `Le pays est trop long (${TEXTE_COURT_MAX} caractères maximum).`,
    }),
    siret: siRenseigne(siretValide, MESSAGE_SIRET),
    vat: siRenseigne(tvaValide, MESSAGE_TVA),
    contactEmail: siRenseigne(
      (v) => z.email().safeParse(v).success,
      "Cette adresse électronique ne semble pas valide. C'est celle à laquelle les contrats et factures seront envoyés.",
    ),
  })
  // Le code postal ne se contrôle que pour la France : les autres pays ont
  // leurs propres formats, et en imposer un ferait échouer une saisie correcte.
  .refine(
    (d) => {
      const fr = d.country.trim() === "" || /^(france|fr)$/i.test(d.country.trim());
      return !fr || d.zip.trim() === "" || codePostalValide(d.zip);
    },
    {
      error: "Le code postal s'écrit avec 5 chiffres, par exemple 69003.",
      path: ["zip"],
    },
  );
