/**
 * Les articles du blog.
 *
 * ─── Pourquoi des données et pas des fichiers Markdown ───
 * Un blog en Markdown demande un moteur de rendu, une gestion d'images, un
 * jeu de plugins. Ici chaque article est une donnée typée : le compilateur
 * refuse un article sans titre, sans description ou sans appel à l'action, et
 * ajouter un article se réduit à ajouter un objet. Le jour où il y en aura
 * cinquante, on changera — pas avant.
 *
 * ─── À quoi sert ce blog ───
 * Pas à faire de l'audience. À capter une intention : quelqu'un qui tape
 * « contrat influenceur obligatoire » dans Google a un problème précis, et
 * Collabbs est la réponse. Chaque article vise UNE recherche et renvoie vers
 * UN endroit — un article qui ne renvoie nulle part fait de l'audience, un
 * article qui renvoie au bon endroit fait des inscriptions.
 *
 * ⚠️ RÈGLE DE FOND : on n'écrit ici que ce qu'on peut sourcer. Un blog qui
 * amène des marques est un blog de confiance ; une affirmation fausse sur un
 * concurrent ou sur la loi coûte plus cher que le trafic qu'elle rapporte.
 */

export type Bloc =
  | { type: "p"; texte: string }
  | { type: "h2"; texte: string }
  | { type: "h3"; texte: string }
  | { type: "liste"; items: string[] }
  | { type: "encadre"; ton: "alerte" | "info"; titre: string; texte: string }
  | { type: "tableau"; entetes: string[]; lignes: string[][] }
  | { type: "cta"; titre: string; texte: string; libelle: string; href: string };

export type Article = {
  /** Le morceau d'URL. Il ne change JAMAIS une fois publié : Google l'a indexé. */
  slug: string;
  /** Le titre affiché, et celui de l'onglet. */
  titre: string;
  /** La phrase que Google affiche sous le titre dans ses résultats. */
  description: string;
  /** Recherche visée. Sert à se relire : si l'article n'y répond pas, il est raté. */
  intention: string;
  categorie: string;
  publieLe: string;
  misAJourLe?: string;
  /** Temps de lecture annoncé, en minutes. */
  lecture: number;
  contenu: Bloc[];
  /** Les sources, affichées en bas. Un article de droit sans sources ne vaut rien. */
  sources: { titre: string; url: string }[];
};

export const ARTICLES: Article[] = [
  {
    slug: "contrat-influenceur-obligatoire-2026",
    titre: "Contrat influenceur : ce que la loi impose depuis janvier 2026",
    description:
      "Depuis le 1er janvier 2026, un contrat écrit est obligatoire dès 1 000 € HT cumulés sur l'année entre une marque et un créateur. Marque, agence et créateur sont solidairement responsables. Ce qu'il faut savoir, et comment suivre le seuil.",
    intention: "contrat influenceur obligatoire 2026",
    categorie: "Réglementation",
    publieLe: "2026-08-31",
    lecture: 6,
    contenu: [
      {
        type: "p",
        texte:
          "Depuis le **1er janvier 2026**, toute collaboration commerciale entre une marque et un créateur doit faire l'objet d'un **contrat écrit** dès que sa valeur dépasse **1 000 € hors taxes**. Ce n'est plus une bonne pratique : c'est une obligation, et elle engage les deux parties.",
      },
      {
        type: "p",
        texte:
          "La règle vient de la **loi n° 2023-451 du 9 juin 2023** sur l'influence commerciale, dont le **décret n° 2025-1137 du 28 novembre 2025** a fixé le seuil. Beaucoup de marques et de créateurs travaillent aujourd'hui sans contrat écrit, en pensant être en dessous — parce qu'ils comptent mal.",
      },
      { type: "h2", texte: "Le seuil de 1 000 € ne s'apprécie pas par collaboration" },
      {
        type: "p",
        texte:
          "C'est le point que presque tout le monde comprend de travers, et c'est celui qui met en infraction sans qu'on s'en rende compte.",
      },
      {
        type: "p",
        texte:
          "Le seuil s'apprécie **par couple marque × créateur** et **par année civile**. Deux collaborations à 600 € avec le même créateur dans la même année déclenchent l'obligation, même si aucune ne l'atteint seule.",
      },
      {
        type: "encadre",
        ton: "alerte",
        titre: "Les avantages en nature comptent aussi",
        texte:
          "La valeur des produits offerts, dotations et services gratuits entre dans le cumul, au même titre que l'argent versé. Une paire de sneakers à 400 € envoyée en gifting rapproche du seuil autant que 400 € virés. C'est ce qui fait basculer les marques qui pratiquent l'envoi de produits sans jamais payer un euro.",
      },
      { type: "h2", texte: "Ce que le contrat doit contenir" },
      {
        type: "p",
        texte:
          "Le contrat doit préciser au minimum l'identité des parties, la nature des missions confiées, la rémunération, ainsi que les droits et obligations de chacun.",
      },
      {
        type: "p",
        texte:
          "En pratique, un contrat sérieux couvre aussi les points qui font les litiges : les droits d'utilisation du contenu et leur durée, l'exclusivité éventuelle, le nombre de retouches incluses, et les délais de livraison et de paiement.",
      },
      { type: "h2", texte: "Qui est responsable en cas de manquement" },
      {
        type: "p",
        texte:
          "**La marque, l'agence et le créateur sont solidairement responsables.** Ce n'est pas la marque seule qui porte le risque : un créateur qui accepte une collaboration sans contrat au-delà du seuil est exposé au même titre.",
      },
      {
        type: "p",
        texte:
          "Le risque principal est la **nullité du contrat** — c'est-à-dire, concrètement, une collaboration dont plus personne ne peut se prévaloir : ni la marque sur les droits d'usage du contenu, ni le créateur sur son paiement.",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "La conformité ne se rattrape pas après coup",
        texte:
          "Un contrat écrit après la publication ne régularise rien : il doit exister avant l'exécution de la prestation. C'est pour cette raison que le suivi du cumul annuel compte autant que le contrat lui-même — quand on découvre qu'on a franchi le seuil, il est déjà trop tard.",
      },
      { type: "h2", texte: "Comment suivre le seuil concrètement" },
      {
        type: "p",
        texte:
          "Le calcul est simple sur une collaboration. Il devient impraticable dès qu'une marque travaille avec vingt créateurs et qu'une partie des rémunérations est en nature : il faut tenir, pour chaque couple, un cumul sur l'année civile qui additionne l'argent et la valeur des produits envoyés.",
      },
      {
        type: "tableau",
        entetes: ["Ce qu'il faut suivre", "Pourquoi c'est piégeux"],
        lignes: [
          [
            "Le cumul par couple marque × créateur",
            "Ce n'est ni par collaboration, ni par marque : deux petites collabs suffisent",
          ],
          [
            "L'année civile",
            "Le compteur repart à zéro le 1er janvier, pas à la date anniversaire",
          ],
          [
            "Les avantages en nature",
            "Un produit offert compte pour sa valeur commerciale",
          ],
          [
            "Le moment du franchissement",
            "Le contrat doit exister AVANT la prestation qui fait franchir le seuil",
          ],
        ],
      },
      {
        type: "cta",
        titre: "Collabbs suit ce cumul pour vous",
        texte:
          "Pour chaque créateur avec qui vous travaillez, Collabbs additionne les collaborations, les commissions d'affiliation et les avantages en nature déclarés, sur l'année civile en cours. Le contrat écrit est généré et signé par les deux parties avant la prestation, et le paiement est séquestré jusqu'à la livraison. Les créateurs ne paient rien.",
        libelle: "Créer un compte gratuit",
        href: "/signup?role=brand",
      },
      { type: "h2", texte: "En résumé" },
      {
        type: "liste",
        items: [
          "Contrat écrit obligatoire dès **1 000 € HT cumulés** sur l'année civile, par couple marque × créateur.",
          "Les **avantages en nature** entrent dans le calcul.",
          "**Marque, agence et créateur** sont solidairement responsables.",
          "Le contrat doit exister **avant** la prestation, pas après.",
          "Le risque principal est la **nullité** de la collaboration.",
        ],
      },
      {
        type: "p",
        texte:
          "Cet article a une visée informative et ne constitue pas un conseil juridique. Pour une situation particulière, rapprochez-vous d'un avocat.",
      },
    ],
    sources: [
      {
        titre: "Influence commerciale : de nouvelles obligations contractuelles dès janvier 2026 — TGS France Avocats",
        url: "https://www.tgs-avocats.fr/blog/influence-commerciale-de-nouvelles-obligations-contractuelles-des-janvier-2026",
      },
      {
        titre: "Loi influenceur 2026 : contrat obligatoire, sanctions et conformité — Tanke",
        url: "https://www.tanke.fr/loi-influenceur-2026/",
      },
      {
        titre: "Partenariats marques-influenceurs : les nouvelles règles en vigueur en 2026 — Blog du Modérateur",
        url: "https://www.blogdumoderateur.com/partenariats-marques-influenceurs-nouvelles-regles-2026/",
      },
    ],
  },
];

export function articleParSlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/** Les articles du plus récent au plus ancien. */
export function articlesTries(): Article[] {
  return [...ARTICLES].sort((a, b) => b.publieLe.localeCompare(a.publieLe));
}
