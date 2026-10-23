import { unstable_isUnrecognizedActionError, unstable_rethrow } from "next/navigation";

/**
 * Appeler une action serveur depuis le navigateur sans pouvoir rester coincé.
 *
 * ─── L'écran qui se verrouillait en silence ───
 * Vingt écrans du produit suivaient exactement la même forme :
 *
 *     setBusy(true);
 *     setError(null);
 *     const res = await uneAction(...);   // ← rien n'entoure cette ligne
 *     setBusy(false);
 *     if (res.ok) router.refresh(); else setError(res.error);
 *
 * Tant que l'action RÉPOND, tout va bien : elle renvoie `{ ok: false, error }`
 * quand elle refuse, et le message s'affiche. Mais si l'appel lui-même
 * échoue — connexion coupée, onglet réveillé après une mise en veille,
 * exception serveur, déploiement en cours — la promesse est rejetée, et les
 * quatre lignes suivantes ne sont jamais exécutées. `busy` reste vrai : tous
 * les boutons de l'écran restent grisés, aucun message n'apparaît, et il n'y
 * a plus rien à faire que recharger la page — ce que personne ne devine.
 *
 * Les écrans concernés sont ceux où ça coûte le plus cher : encaisser un
 * paiement, rembourser une marque, clôturer une collaboration, publier une
 * campagne, répondre à une invitation.
 *
 * ─── Le cas du déploiement, qui arrivera à chaque mise en ligne ───
 * Quand une nouvelle version part sur Vercel, les pages déjà ouvertes dans un
 * navigateur portent des identifiants d'action qui n'existent plus côté
 * serveur. Next le signale avec une erreur reconnaissable
 * (`unstable_isUnrecognizedActionError`), et la seule issue est de recharger.
 * Sans ce traitement, chaque déploiement grise en silence les boutons de tous
 * les visiteurs en cours — et plus le produit a de monde, plus ça se produit.
 *
 * ─── Pourquoi un enrobage et pas un `try` dans chaque écran ───
 * Vingt `try/catch/finally` écrits à la main, ce sont vingt occasions
 * d'oublier le `finally`. Ici l'échec devient ce que l'appelant sait déjà
 * traiter — un `{ ok: false, error }` — donc la ligne qui affiche l'erreur
 * existe déjà dans chaque écran, et `setBusy(false)` est toujours atteint.
 */

/** Ce que renvoient les actions du produit. */
type Resultat = { ok: boolean; error?: string };

/**
 * Le message quand l'appel n'a pas abouti.
 *
 * Il dit trois choses : ce qui n'a pas eu lieu, la cause la plus probable, et
 * quoi faire. « Une erreur est survenue » n'en dit aucune.
 *
 * Il affirme aussi que rien n'a été enregistré. C'est vrai dans le cas qui
 * domine — l'appel n'est pas parti — et dans l'autre, où c'est la réponse qui
 * s'est perdue, réessayer ne double rien : les actions d'argent du produit
 * sont écrites pour supporter d'être rappelées (clé d'idempotence côté
 * Stripe, `payout_id` qui réserve une vente, statut vérifié avant d'agir).
 */
const MESSAGE_ECHEC =
  "L'action n'a pas abouti — la connexion a peut-être coupé. " +
  "Rien n'a été enregistré : tu peux réessayer.";

/** Le message quand la page est plus vieille que le serveur. */
const MESSAGE_VERSION =
  "Le site vient d'être mis à jour. Recharge la page, puis recommence : " +
  "cette page-ci parle à une version qui n'existe plus.";

export async function tenter<T extends Resultat>(
  action: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    const res = await action();
    // Une action qui renvoie `undefined` — redirection, ou `return` oublié —
    // ne doit pas faire lever la lecture de `res.ok` chez l'appelant.
    return res ?? { ok: false as const, error: MESSAGE_ECHEC };
  } catch (err) {
    /* `redirect()`, `notFound()`, `forbidden()` et `unauthorized()` passent
       par une exception interne : interceptée, la navigation n'a pas lieu et
       l'écran affiche une erreur à la place. `unstable_rethrow` la relance et
       ne revient pas ; pour tout le reste, il rend la main. */
    unstable_rethrow(err);

    if (unstable_isUnrecognizedActionError(err)) {
      return { ok: false as const, error: MESSAGE_VERSION };
    }
    // Visible dans la console du navigateur : la cause reste trouvable, même
    // si l'écran n'en montre qu'une phrase.
    console.error("action serveur en échec", err);
    return { ok: false as const, error: MESSAGE_ECHEC };
  }
}
