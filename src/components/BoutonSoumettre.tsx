"use client";

import { useFormStatus } from "react-dom";

/**
 * Le bouton d'un formulaire qui dit qu'il travaille.
 *
 * ─── Le manque qu'il comble ───
 * Un clic sur « Publier » partait au serveur et l'écran ne bougeait pas : ni
 * curseur, ni grisé, ni rien. Pendant deux à quatre secondes, la seule
 * interprétation disponible est « ça n'a pas marché » — alors on reclique. Et
 * recliquer sur un bouton d'action n'est pas neutre : c'est une deuxième
 * campagne, un deuxième versement, un deuxième message.
 *
 * ─── Pourquoi ce composant et pas un état local par écran ───
 * `useFormStatus` lit l'état du formulaire PARENT : le bouton se met à jour
 * tout seul, sans que l'écran ait à gérer quoi que ce soit. C'est ce qui rend
 * la correction applicable aux cinquante-six boutons du produit sans en
 * réécrire aucun.
 *
 * Hors d'un formulaire, `pending` reste faux : le composant se comporte alors
 * exactement comme un `<button>` ordinaire.
 */

export default function BoutonSoumettre({
  children,
  pendant,
  className = "",
  disabled,
  ...props
}: React.ComponentProps<"button"> & {
  /** Texte affiché pendant l'envoi. Par défaut, on garde le libellé. */
  pendant?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      // `disabled` pendant l'envoi : c'est la protection contre le double clic,
      // et elle vaut plus que l'indication visuelle.
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`.trim()}
      {...props}
    >
      <span className="inline-flex items-center gap-2">
        {pending && (
          <span
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-70"
          />
        )}
        {pending && pendant ? pendant : children}
      </span>
    </button>
  );
}
