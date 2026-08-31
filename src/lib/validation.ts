/**
 * La barrière d'entrée des actions serveur.
 *
 * POURQUOI ce fichier existe. Les actions qui touchent à l'argent et aux
 * mentions d'un contrat vérifiaient leurs entrées à la main, donc inégalement :
 * certaines tout, d'autres presque rien. Or une entrée non vérifiée ne
 * provoque pas une erreur propre. Elle écrit une valeur absurde dans la base —
 * un montant négatif, un pourcentage à 4 000, un identifiant qui n'en est pas
 * un — et personne ne s'en aperçoit avant que quelqu'un soit payé de travers.
 * Une action serveur est appelable directement : ce qui est vérifié dans le
 * formulaire ne l'est pas du tout côté serveur.
 *
 * Deux règles de forme, aussi importantes que les contrôles eux-mêmes :
 *
 *  1. **Aucun message zod ne sort à l'écran.** « Expected number, received nan »
 *     ne veut rien dire pour un créateur qui fait sa première collaboration.
 *     Chaque contrôle porte sa propre phrase, en français, qui dit ce qui ne va
 *     pas ET ce qu'il faut faire pour que ça passe.
 *
 *  2. **Un montant reste un nombre.** On le borne et on refuse plus de deux
 *     décimales, mais on ne le convertit jamais en entier : une action peut
 *     valoir 0,50 €, et arrondir à l'euro c'est se tromper de la moitié d'une
 *     rémunération, dans un sens ou dans l'autre.
 */

import { z } from "zod";

/**
 * Plafond commun à tous les montants saisis à la main, en euros.
 *
 * Un million n'est pas une limite produit, c'est un garde-fou contre la faute
 * de frappe : personne ne règle une collaboration à 9 999 999 € par accident
 * volontaire. Au-delà, on préfère demander confirmation plutôt que d'ouvrir un
 * paiement Stripe de ce montant.
 */
export const MONTANT_MAX_EUROS = 1_000_000;

/** Textes libres courts : titre, libellé de palier, référence de commande. */
export const TEXTE_COURT_MAX = 200;

/** Textes libres longs : brief, notes de négociation, commentaire d'avis. */
export const TEXTE_LONG_MAX = 5_000;

/** Un lien reste un lien : au-delà, c'est autre chose qu'on essaie de stocker. */
export const LIEN_MAX = 2_000;

/**
 * Formate un montant pour l'afficher DANS UN MESSAGE D'ERREUR.
 *
 * Volontairement fait à la main plutôt qu'avec `toLocaleString` : le résultat
 * de ce dernier dépend des données de langue disponibles dans l'environnement
 * (espace fine insécable ici, espace normale là), et un message d'erreur qu'on
 * teste ne doit pas changer selon la machine qui l'exécute.
 */
export function euros(n: number): string {
  const [entier, decimales] = Math.abs(n).toFixed(2).split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const signe = n < 0 ? "-" : "";
  return decimales === "00" ? `${signe}${groupe} €` : `${signe}${groupe},${decimales} €`;
}

/**
 * Vrai si le nombre s'arrête au centime.
 *
 * La comparaison passe par une tolérance parce qu'un flottant ne vaut jamais
 * exactement ce qu'on croit : 0,1 + 0,2 donne 0,30000000000000004, qui EST un
 * montant en centimes et doit passer. La tolérance est assez large pour
 * absorber cette poussière binaire (de l'ordre de 10⁻⁸ au plafond du million)
 * et bien trop étroite pour laisser filer un vrai millième d'euro.
 */
export function estAuCentime(n: number): boolean {
  const centimes = n * 100;
  return Math.abs(centimes - Math.round(centimes)) < 1e-6;
}

/**
 * Un identifiant de la base : toujours un UUID.
 *
 * Ce contrôle ne protège pas d'un utilisateur malveillant — les vérifications
 * de propriété qui suivent s'en chargent — mais d'un appel bancal. Sans lui, un
 * identifiant tordu part jusqu'à Postgres, qui répond une erreur de syntaxe
 * que le code lit comme « ligne introuvable » : l'utilisateur voit alors
 * « action non autorisée » là où il fallait dire « recharge la page ».
 */
export function identifiant(quoi: string) {
  const message = `${quoi} n'a pas été reconnu. Recharge la page, puis réessaie.`;
  return z.uuid({ error: message });
}

/**
 * Un montant en euros.
 *
 * Trois contrôles, dans cet ordre : c'est bien un nombre, il tient dans les
 * bornes, il s'arrête au centime. Le premier attrape le cas le plus fréquent en
 * pratique — un champ vide converti en `NaN`, ou un texte que personne n'a pu
 * relire.
 */
export function montantEuros(opts: {
  /** Sujet de la phrase d'erreur, avec son article : « Le montant du deal ». */
  quoi: string;
  /** Borne basse incluse. 0 par défaut : un montant n'est jamais négatif. */
  min?: number;
  /** Borne haute incluse. */
  max?: number;
  /** Phrase sur mesure quand la borne basse a une raison d'être expliquée. */
  messageMin?: string;
}) {
  const min = opts.min ?? 0;
  const max = opts.max ?? MONTANT_MAX_EUROS;
  const pasUnNombre = `${opts.quoi} doit être un nombre. Saisis-le en euros, par exemple 250 ou 49,90.`;

  return z
    .number({ error: pasUnNombre })
    .refine((n) => n >= min, {
      error:
        opts.messageMin ??
        (min === 0
          ? `${opts.quoi} ne peut pas être négatif. Saisis 0 ou plus.`
          : `${opts.quoi} doit être d'au moins ${euros(min)}.`),
    })
    .refine((n) => n <= max, {
      error: `${opts.quoi} ne peut pas dépasser ${euros(max)}. Vérifie la virgule ; si le montant est bien celui-là, écris-nous et on l'ouvre.`,
    })
    .refine(estAuCentime, {
      error: `${opts.quoi} s'arrête au centime : deux chiffres après la virgule au maximum (49,90 et non 49,9012).`,
    });
}

/**
 * Un pourcentage, de 0 à 100.
 *
 * On refuse au-delà de 100 : une commission de 250 % sur une vente ferait
 * perdre de l'argent à la marque à chaque commande, et le formulaire ne
 * l'empêche pas.
 */
export function pourcentage(quoi: string) {
  return z
    .number({ error: `${quoi} doit être un nombre, exprimé en pourcentage (10 pour 10 %).` })
    .refine((n) => n >= 0, { error: `${quoi} ne peut pas être négatif. Saisis 0 ou plus.` })
    .refine((n) => n <= 100, {
      error: `${quoi} ne peut pas dépasser 100 %. Si tu voulais dire « 10 % », saisis 10, pas 1000.`,
    });
}

/**
 * Un compte : nombre entier positif (abonnés, places, actions, gagnants).
 * Ici l'entier est légitime — on ne compte pas une demi-inscription.
 */
export function nombreEntier(opts: { quoi: string; min?: number; max?: number }) {
  const min = opts.min ?? 0;
  const max = opts.max ?? 1_000_000_000;
  return z
    .number({ error: `${opts.quoi} doit être un nombre entier.` })
    .refine(Number.isInteger, {
      error: `${opts.quoi} doit être un nombre entier, sans virgule.`,
    })
    .refine((n) => n >= min, { error: `${opts.quoi} doit être d'au moins ${min}.` })
    .refine((n) => n <= max, {
      error: `${opts.quoi} est bien trop grand. Vérifie ce que tu as saisi.`,
    });
}

/** Texte libre obligatoire, borné des deux côtés. */
export function texteRequis(opts: {
  quoi: string;
  max: number;
  min?: number;
  messageVide?: string;
  messageMin?: string;
}) {
  const min = opts.min ?? 1;
  return z
    .string({ error: `${opts.quoi} est obligatoire.` })
    .refine((s) => s.trim().length > 0, {
      error: opts.messageVide ?? `${opts.quoi} est obligatoire : ce champ ne peut pas rester vide.`,
    })
    .refine((s) => s.trim().length >= min, {
      error:
        opts.messageMin ??
        `${opts.quoi} est trop court : il faut au moins ${min} caractères pour que ce soit compréhensible.`,
    })
    .refine((s) => s.trim().length <= opts.max, {
      error: `${opts.quoi} est trop long (${opts.max} caractères maximum). Va à l'essentiel, tu pourras détailler dans la messagerie.`,
    });
}

/**
 * Texte libre facultatif : le vide est une réponse valable.
 *
 * On ne transforme pas la valeur (pas de `trim` ici) : les actions font déjà
 * leur propre nettoyage avant d'écrire, et on ne veut pas deux endroits qui
 * décident de la forme finale d'un même champ.
 */
/**
 * Un texte qu'on exige vraiment.
 *
 * `texteFacultatif` acceptait la chaîne vide, ce qui convient à un champ qu'on
 * peut laisser blanc. Pour une adresse de livraison, le vide n'est pas une
 * réponse : c'est un colis qui revient. Le message nomme le champ, parce que
 * « ce champ est requis » sur un formulaire de huit lignes n'aide personne.
 */
export function texteObligatoire(opts: { quoi: string; max: number }) {
  return z
    .string({ error: `${opts.quoi} doit être du texte.` })
    .refine((s) => s.trim().length > 0, { error: `${opts.quoi} est obligatoire.` })
    .refine((s) => s.trim().length <= opts.max, {
      error: `${opts.quoi} est trop long (${opts.max} caractères maximum).`,
    })
    .transform((s) => s.trim());
}

export function texteFacultatif(opts: { quoi: string; max: number }) {
  return z
    .string({ error: `${opts.quoi} doit être du texte.` })
    .refine((s) => s.trim().length <= opts.max, {
      error: `${opts.quoi} est trop long (${opts.max} caractères maximum).`,
    });
}

/**
 * Un lien public, en http ou https.
 *
 * `new URL` accepte `javascript:` et `mailto:` sans broncher ; on impose donc
 * explicitement le protocole. Ces liens finissent affichés à la marque et
 * cliqués par elle.
 */
export function lienHttp(opts: { quoi: string; messageVide?: string }) {
  return z
    .string({ error: `${opts.quoi} doit être un lien.` })
    .refine((s) => s.trim().length > 0, {
      error: opts.messageVide ?? `${opts.quoi} est obligatoire.`,
    })
    .refine((s) => s.trim().length <= LIEN_MAX, {
      error: `${opts.quoi} est anormalement long. Colle l'adresse de la page, pas la page elle-même.`,
    })
    .refine(
      (s) => {
        try {
          const u = new URL(s.trim());
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      },
      {
        error: `${opts.quoi} n'est pas une adresse valide. Copie-la depuis ta barre d'adresse : elle doit commencer par https://`,
      },
    );
}

/**
 * Une date au format d'un champ « date » de formulaire : AAAA-MM-JJ.
 *
 * On vérifie que la date EXISTE vraiment, et pas seulement qu'elle a la bonne
 * forme : `2026-02-31` passe une simple expression régulière, mais Postgres la
 * refuse et l'action échoue plus loin avec un message incompréhensible.
 */
export function dateISO(quoi: string) {
  const message = `${quoi} n'est pas une date valide. Choisis-la dans le calendrier (format AAAA-MM-JJ).`;
  return z
    .string({ error: message })
    .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), { error: message })
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    }, { error: message });
}

/**
 * Résultat d'une validation, dans la forme que les actions utilisent déjà
 * (`{ ok, error }`) pour ne rien changer à leur façon de répondre.
 */
export type Validation<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Valide une valeur et renvoie UNE phrase, celle du premier problème trouvé.
 *
 * Une seule, délibérément : une liste de sept reproches devant un formulaire
 * fait abandonner. On dit ce qui bloque maintenant ; s'il reste autre chose,
 * on le dira à la tentative suivante.
 */
export function valider<T extends z.ZodType>(
  schema: T,
  valeur: unknown,
): Validation<z.output<T>> {
  const res = schema.safeParse(valeur);
  if (res.success) return { ok: true, data: res.data };
  const premier = res.error.issues[0]?.message;
  return {
    ok: false,
    // Filet : si un contrôle oubliait sa phrase française, on n'affiche
    // surtout pas le message technique de zod à sa place.
    error: premier && !/^(Invalid|Expected|Too|Unrecognized)\b/.test(premier)
      ? premier
      : "Une des informations saisies n'est pas valide. Vérifie le formulaire et réessaie.",
  };
}

/**
 * Lit un champ numérique d'un `FormData`.
 *
 * `Number(null)` vaut 0 et `Number("")` aussi : sans cette fonction, un champ
 * absent ou vidé arrive au schéma déguisé en « zéro », c'est-à-dire en montant
 * parfaitement valide. On renvoie `NaN` pour que le contrôle voie qu'il n'y a
 * rien plutôt que zéro.
 */
export function nombreDuFormulaire(valeur: FormDataEntryValue | null): number {
  if (valeur === null) return Number.NaN;
  const brut = String(valeur).trim();
  if (brut === "") return Number.NaN;

  // Un francophone écrit « 49,90 », pas « 49.90 » — et `Number("49,90")` vaut
  // NaN. Sans cette conversion, un montant parfaitement valide était rejeté
  // avec le message « doit être un nombre », en français, à quelqu'un qui
  // venait justement d'écrire un nombre en français.
  //
  // On retire aussi les espaces de milliers (ordinaire, insécable, fine) que
  // produisent le collage depuis un tableur et les claviers qui les insèrent.
  const normalise = brut
    .replace(/[\s\u00A0\u202F]/g, "")
    .replace(",", ".");
  return Number(normalise);
}
