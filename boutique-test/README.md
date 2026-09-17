# Boutique de test — le chemin du pixel

Une vraie boutique, en tout petit, pour répondre à **la dernière question
ouverte de Collabbs** : est-ce qu'une vente remonte depuis un site réel ?

Tout le reste de la chaîne d'affiliation a été éprouvé sur de l'argent réel —
clic, attribution, commission, réservation sur la provision, versement. Mais
le maillon qui déclenche tout, le pixel posé sur une boutique, n'a jamais
tourné ailleurs que chez nous.

C'est ce que teste ce dossier. Deux pages, aucun framework, rien à installer.

## Ce qu'il faut faire, une fois

1. **Déployer ce dossier.** Sur [vercel.com/new](https://vercel.com/new), onglet
   « Deploy », on fait glisser le dossier. Deux minutes, aucun compte à créer :
   c'est le tien.

2. **Noter l'adresse obtenue** (du genre `boutique-test-xyz.vercel.app`).

3. **Dans Collabbs, côté marque** : Mon profil → le site de la marque →
   coller cette adresse.

   C'est indispensable : le pixel vérifie que la vente vient bien du site
   déclaré par la marque. Sans ça, n'importe qui pourrait fabriquer des ventes
   depuis n'importe quelle page.

4. **Ouvrir le lien d'un créateur** — `collabbs.com/r/<code>` — et suivre le
   parcours jusqu'à la page de confirmation.

## Ce qu'on regarde

La boutique affiche, en bas de chaque page, ce que Collabbs a réellement
mémorisé. C'est le seul endroit du test où l'on voit le mécanisme à nu :

- à l'arrivée depuis un lien créateur, le code doit apparaître ;
- il doit **survivre au changement de page** — c'est le cookie qui travaille ;
- à la confirmation, la vente part et le code reste (30 jours).

Si le code n'apparaît pas, rien ne remontera — et c'est exactement ce qu'on
cherche à savoir avant qu'une vraie marque le découvre à nos dépens.
