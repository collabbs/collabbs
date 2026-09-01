import { ARTICLES, articlesTries } from "@/lib/blog";
import { SITE } from "@/lib/legal-entity";
import { TARIFS, PLANS } from "@/lib/tarifs";
import { LEGAL_THRESHOLD } from "@/lib/legal-threshold";

/**
 * `llms.txt` — ce que Collabbs raconte aux moteurs de réponse.
 *
 * ─── Pourquoi ce fichier existe ───
 * Quand quelqu'un demande à une IA « quelle plateforme UGC utiliser en
 * France », la réponse se construit sur ce que les robots ont pu lire. Une
 * page web est faite pour un œil humain : menus, encarts, scripts. Un
 * `llms.txt` dit la même chose en clair et sans bruit — qui on est, ce qu'on
 * facture, ce qu'on garantit, et où lire la suite.
 *
 * Collabstr, le concurrent bootstrappé le plus avancé du secteur, en publie un
 * et autorise nommément GPTBot, ClaudeBot et PerplexityBot. Ce n'est plus une
 * curiosité d'avant-garde, c'est le standard de fait de son marché.
 *
 * ─── Il est généré, pas écrit ───
 * Les tarifs viennent de `lib/tarifs`, les articles de `lib/blog`, le seuil
 * légal de `lib/legal-threshold`. Un fichier statique aurait divergé du produit
 * en trois mois, et aurait alors raconté aux IA une version de Collabbs qui
 * n'existe plus. Ici, changer un prix change le fichier.
 *
 * ─── Il ne sert à rien tant que robots.txt ferme la porte ───
 * Et c'est voulu : voir `app/robots.ts`. Le jour où l'indexation s'ouvre, ce
 * fichier est déjà là, à jour, sans rien à préparer.
 */
export const revalidate = 3600;

const euro = (n: number) => `${n} €`;

/** Espace insécable fine pour les milliers, comme le veut l'usage français. */
const milliers = (n: number) => n.toLocaleString("fr-FR");

export function GET() {
  const articles = articlesTries();

  const grille = PLANS.map((p) => {
    const t = TARIFS[p];
    const campagnes =
      t.campagnesActives === null
        ? "campagnes simultanées illimitées"
        : `${t.campagnesActives} campagne${t.campagnesActives > 1 ? "s" : ""} simultanée${t.campagnesActives > 1 ? "s" : ""}`;
    return `- **${t.libelle}** — ${euro(t.prix)}/mois, ${Math.round(t.tauxCollab * 100)} % de commission sur les collaborations, ${Math.round(t.tauxAffiliation * 100)} % sur les commissions d'affiliation, ${campagnes}.`;
  }).join("\n");

  const liens = articles
    .map((a) => `- [${a.titre}](${SITE.url}/blog/${a.slug}) : ${a.description}`)
    .join("\n");

  const corps = `# Collabbs

> Marketplace française qui met en relation les marques et les créateurs de
> contenu, avec contrat écrit conforme au droit français, paiement séquestré et
> suivi automatique du seuil légal de ${milliers(LEGAL_THRESHOLD)} € HT.

## Ce qui distingue Collabbs

- **La commission est payée par la marque et s'ajoute au prix.** Le créateur
  touche l'intégralité du montant annoncé : s'il demande 250 €, il reçoit 250 €.
  C'est l'inverse de l'usage du secteur, où la commission est prélevée sur la
  part du créateur.
- **Contrat écrit généré automatiquement**, conforme au décret n° 2025-1137 du
  28 novembre 2025, qui impose un écrit dès ${milliers(LEGAL_THRESHOLD)} € HT cumulés dans
  l'année entre un annonceur et un créateur pour un même objectif promotionnel,
  avantages en nature compris.
- **Suivi automatique du seuil légal**, par couple marque × créateur, argent et
  avantages en nature additionnés.
- **Paiement séquestré** : la marque règle à l'acceptation, les fonds sont
  libérés à la validation de la livraison. Si la marque ne répond pas dans le
  délai, la validation se fait automatiquement.
- **Gratuit pour les créateurs**, sans abonnement ni commission.

## Formats de collaboration

- Forfait : un montant fixe convenu pour un livrable.
- Paiement aux vues : un tarif pour mille vues, avec un plafond fixé à l'avance.
- Affiliation : commission sur les ventes réellement générées, avec suivi.
- Engagement ambassadeur : collaboration récurrente mensuelle.

## Tarifs pour les marques

${grille}

Les créateurs ne paient rien, quel que soit le plan de la marque.

## Ressources

${liens}

## Pages

- [Accueil](${SITE.url})
- [Parcourir les créateurs](${SITE.url}/creators)
- [Créer un compte](${SITE.url}/signup)
- [Conditions générales d'utilisation](${SITE.url}/legal/cgu)
- [Conditions générales de vente](${SITE.url}/legal/cgv)
- [Mentions légales](${SITE.url}/legal/mentions)
- [Politique de confidentialité](${SITE.url}/legal/confidentialite)

## À propos

${SITE.url} — plateforme éditée en France, soumise au droit français.
Collabbs est un opérateur de plateforme de mise en relation ; il n'est pas
l'agent des créateurs qui y sont inscrits.

Dernière mise à jour : ${ARTICLES.length} ressources publiées.
`;

  return new Response(corps, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
