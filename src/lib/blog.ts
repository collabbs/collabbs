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

  {
    slug: "combien-coute-une-video-ugc",
    titre: "Combien coûte une vidéo UGC en France en 2026 ?",
    description:
      "Les fourchettes réellement pratiquées : 150 à 350 € pour une vidéo en usage organique, nettement plus dès qu'on y ajoute les droits publicitaires. Ce qui fait varier le prix, et ce qu'il faut prévoir en plus.",
    intention: "combien coûte une vidéo UGC prix tarif",
    categorie: "Tarifs",
    publieLe: "2026-08-31",
    lecture: 5,
    contenu: [
      {
        type: "p",
        texte:
          "C'est la première question que pose une marque, et celle à laquelle un créateur qui débute n'a aucune réponse. Il n'existe pas de barème officiel — mais les fourchettes pratiquées sont connues, et elles s'expliquent.",
      },
      { type: "h2", texte: "Les fourchettes observées" },
      {
        type: "p",
        texte:
          "Pour une vidéo UGC destinée à un **usage organique** — la marque la publie sur ses propres réseaux, sans budget publicitaire derrière :",
      },
      {
        type: "tableau",
        entetes: ["Profil du créateur", "Fourchette constatée"],
        lignes: [
          ["Débutant, script fourni par la marque", "150 – 200 €"],
          ["Créateur confirmé, avec portfolio", "environ 350 €"],
          ["Prix moyen toutes expériences confondues", "200 – 220 €"],
        ],
      },
      {
        type: "p",
        texte:
          "Les sources divergent sur le haut de la fourchette : certaines grilles annoncent 300 à 1 000 € pour une vidéo organique, d'autres se stabilisent autour de 200 €. L'écart s'explique surtout par ce qu'on met derrière le mot « vidéo » — trente secondes filmées au téléphone et un tournage scénarisé de deux minutes ne sont pas le même métier.",
      },
      { type: "h2", texte: "Ce qui fait vraiment varier le prix" },
      {
        type: "liste",
        items: [
          "**Le script.** Fourni par la marque, ou écrit par le créateur — ce n'est pas la même prestation.",
          "**La durée et le nombre de plans.** Une vidéo de 15 secondes en un plan n'a rien à voir avec 90 secondes en multi-décors.",
          "**Le nombre de variantes.** Les marques qui font de la publicité en demandent souvent trois ou quatre pour tester.",
          "**Le délai.** Une livraison en 48 heures se paie.",
          "**Les droits d'utilisation** — et c'est le poste que tout le monde oublie.",
        ],
      },
      { type: "h2", texte: "Le poste que les débutants oublient : les droits" },
      {
        type: "encadre",
        ton: "alerte",
        titre: "Une vidéo organique et une vidéo publicitaire n'ont pas le même prix",
        texte:
          "Le marché facture les droits d'exploitation publicitaire environ 15 à 30 % du tarif par tranche de 30 jours de diffusion. Une vidéo à 300 € que la marque veut pousser en publicité pendant trois mois représente donc plusieurs centaines d'euros de plus. Un créateur qui ne facture pas ce supplément travaille à perte sans le savoir : c'est son visage qui sert de support publicitaire, potentiellement devant des gens qui ne le connaissent pas.",
      },
      {
        type: "p",
        texte:
          "Les grilles les plus complètes situent d'ailleurs la vidéo publicitaire — droits inclus — entre 700 et 3 000 €, contre 150 à 350 € pour la même vidéo en usage organique. Le contenu est identique ; c'est le droit qui change.",
      },
      { type: "h2", texte: "Et pour un pack de plusieurs vidéos ?" },
      {
        type: "p",
        texte:
          "La plupart des créateurs proposent un tarif dégressif à partir de trois ou cinq vidéos. C'est logique : le repérage, le brief et la mise en place se font une seule fois. Un tarif journalier médian d'environ 450 € est observé pour une journée de tournage regroupant plusieurs contenus.",
      },
      {
        type: "cta",
        titre: "Les tarifs se voient avant de discuter",
        texte:
          "Sur Collabbs, chaque créateur affiche ses tarifs par format. La marque fixe le montant du contenu et la durée des droits d'usage — le supplément se calcule automatiquement, et le total est annoncé avant de payer. Le créateur touche l'intégralité de ce qui est affiché : la commission est à la charge de la marque.",
        libelle: "Parcourir les créateurs",
        href: "/creators",
      },
      { type: "h2", texte: "Ce qu'il faut retenir" },
      {
        type: "liste",
        items: [
          "**150 à 350 €** pour une vidéo en usage organique, selon l'expérience.",
          "**+15 à 30 % par tranche de 30 jours** pour les droits publicitaires.",
          "Une vidéo destinée à la publicité se situe dans un tout autre ordre de grandeur.",
          "Le tarif dégressif commence généralement à trois vidéos.",
          "**Le prix se négocie sur la prestation, mais les droits se facturent à part.**",
        ],
      },
    ],
    sources: [
      { titre: "Prix vidéo UGC en France — guide 2026 (Takema)", url: "https://www.takema-studio.com/marques/prix-video-ugc-en-france-le-guide-complet-pour-2026" },
      { titre: "Combien coûte une vidéo UGC en 2026 (Katall)", url: "https://katall.fr/prix-video-ugc" },
      { titre: "Tarif créateur UGC 2026 : combien facturer aux marques", url: "https://www.collabscene.com/resources/creators/tarif-createur-ugc-2026" },
    ],
  },
  {
    slug: "avantages-en-nature-seuil-legal-influence",
    titre: "Gifting et produits offerts : ils comptent dans le seuil légal",
    description:
      "Une marque qui envoie seulement des produits, sans jamais verser un euro, peut franchir le seuil des 1 000 € et déclencher l'obligation de contrat écrit. Ce que la loi compte, et comment le suivre.",
    intention: "avantages en nature gifting seuil 1000 euros influence",
    categorie: "Réglementation",
    publieLe: "2026-08-31",
    lecture: 4,
    contenu: [
      {
        type: "p",
        texte:
          "Beaucoup de marques pensent être hors du champ de la loi parce qu'elles ne paient pas leurs créateurs : elles envoient des produits. C'est une erreur de lecture, et c'est probablement la plus répandue.",
      },
      {
        type: "encadre",
        ton: "alerte",
        titre: "La valeur des avantages en nature entre dans le calcul",
        texte:
          "Le seuil de 1 000 € HT qui déclenche l'obligation de contrat écrit s'apprécie sur la rémunération ET la valeur des avantages en nature, cumulées sur l'année civile pour un même couple marque × créateur. Un produit à 400 € offert rapproche du seuil exactement autant que 400 € virés.",
      },
      { type: "h2", texte: "Un exemple qui n'a rien d'extrême" },
      {
        type: "p",
        texte:
          "Une marque de cosmétiques envoie chaque trimestre une box de produits d'une valeur commerciale de 300 € à la même créatrice, en échange de publications. Aucun euro ne change de main.",
      },
      {
        type: "tableau",
        entetes: ["Mois", "Envoi", "Cumul annuel"],
        lignes: [
          ["Janvier", "Box — 300 €", "300 €"],
          ["Avril", "Box — 300 €", "600 €"],
          ["Juillet", "Box — 300 €", "900 €"],
          ["Octobre", "Box — 300 €", "**1 200 € — seuil franchi**"],
        ],
      },
      {
        type: "p",
        texte:
          "À partir du quatrième envoi, la collaboration exige un contrat écrit. La marque n'a jamais payé, et pourtant les deux parties sont désormais exposées — car **la marque et le créateur sont solidairement responsables**.",
      },
      { type: "h2", texte: "Quelle valeur retenir ?" },
      {
        type: "p",
        texte:
          "La valeur commerciale du bien ou du service, c'est-à-dire ce que le produit coûterait au public. Pas le prix de revient, pas le prix remisé.",
      },
      {
        type: "p",
        texte:
          "En pratique, c'est le point où les deux parties peuvent ne pas être d'accord — d'où l'intérêt que la valeur soit **déclarée et acceptée** au moment de l'envoi, plutôt que reconstituée un an plus tard.",
      },
      { type: "h2", texte: "Le problème du suivi" },
      {
        type: "p",
        texte:
          "Additionner de l'argent est facile. Additionner de l'argent **et** des produits, par créateur, sur une année civile, quand on travaille avec vingt personnes, ne se fait pas de tête. C'est là que les marques se retrouvent en infraction sans intention de l'être.",
      },
      {
        type: "cta",
        titre: "Collabbs additionne les deux",
        texte:
          "Les collaborations payées, les commissions d'affiliation et les avantages en nature déclarés entrent dans le même cumul annuel, par couple marque × créateur. Chaque partie voit où elle en est, et le contrat écrit se déclenche avant le franchissement. Gratuit pour les créateurs.",
        libelle: "Créer un compte gratuit",
        href: "/signup?role=brand",
      },
      {
        type: "p",
        texte:
          "Cet article a une visée informative et ne constitue pas un conseil juridique.",
      },
    ],
    sources: [
      { titre: "Influence commerciale : nouvelles obligations dès janvier 2026 — TGS France Avocats", url: "https://www.tgs-avocats.fr/blog/influence-commerciale-de-nouvelles-obligations-contractuelles-des-janvier-2026" },
      { titre: "Loi influenceur 2026 : contrat obligatoire, sanctions et conformité — Tanke", url: "https://www.tanke.fr/loi-influenceur-2026/" },
    ],
  },

  {
    slug: "droits-usage-ugc-combien-facturer",
    titre: "Droits d'usage d'une vidéo UGC : ce que vous cédez, et à quel prix",
    description:
      "Payer une vidéo ne donne pas le droit de l'exploiter indéfiniment ni de la passer en publicité. Ce que recouvrent les droits d'usage, comment le marché les facture, et pourquoi c'est le poste le plus souvent oublié.",
    intention: "droits usage vidéo UGC prix cession publicité",
    categorie: "Tarifs",
    publieLe: "2026-08-31",
    lecture: 5,
    contenu: [
      {
        type: "p",
        texte:
          "C'est le malentendu le plus fréquent entre une marque et un créateur, et il éclate toujours après coup : la marque pense avoir acheté une vidéo, le créateur pense avoir vendu une publication.",
      },
      {
        type: "p",
        texte:
          "Les deux ont raison — et c'est bien le problème. **Une collaboration paie la fabrication d'un contenu. Le droit de le réutiliser ensuite est autre chose**, et il se facture séparément.",
      },
      { type: "h2", texte: "Deux périmètres, deux mondes" },
      {
        type: "tableau",
        entetes: ["Périmètre", "Ce que la marque peut faire", "Ce que ça vaut"],
        lignes: [
          [
            "**Organique**",
            "Republier sur ses propres réseaux, son site, ses newsletters — sans budget publicitaire",
            "Supplément modéré",
          ],
          [
            "**Publicité payante**",
            "Pousser le contenu en publicité, y compris auprès d'audiences qui ne connaissent pas le créateur",
            "Environ le double",
          ],
        ],
      },
      {
        type: "p",
        texte:
          "La différence n'est pas technique, elle est humaine : dans le second cas, **c'est le visage du créateur qui sert de support publicitaire**, souvent devant des gens qui ne l'ont jamais choisi. Un créateur qui découvre son visage dans une publicité qu'il n'a pas négociée a de bonnes raisons de le vivre mal.",
      },
      { type: "h2", texte: "Comment le marché facture la durée" },
      {
        type: "p",
        texte:
          "Les grilles observées facturent les droits d'exploitation publicitaire autour de **15 à 30 % du tarif du contenu par tranche de 30 jours** de diffusion.",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "La durée ne se facture pas au prorata",
        texte:
          "Douze mois ne valent pas douze fois un mois. Le premier mois est le plus cher, le reste s'amortit — une formule strictement proportionnelle donnerait des suppléments qu'aucune marque n'accepte et qu'aucun créateur n'obtient. Les grilles fonctionnent par paliers : un mois, trois mois, six mois, un an, puis la cession sans limite de durée.",
      },
      { type: "h2", texte: "Ce qu'il faut écrire noir sur blanc" },
      {
        type: "liste",
        items: [
          "**La durée** — en mois, à compter de la livraison.",
          "**Le périmètre** — supports propres uniquement, ou diffusion publicitaire incluse.",
          "**Le prix de la cession**, distinct du prix du contenu.",
          "**Ce qui se passe après** : sans reconduction, l'exploitation s'arrête.",
        ],
      },
      {
        type: "p",
        texte:
          "Un contrat qui dit seulement « six mois » sans préciser le périmètre se règle au tribunal le jour où la marque pousse le contenu en publicité. Et une clause qui renvoie « aux limites convenues entre les parties » sans qu'aucune limite n'ait jamais été convenue ne protège personne.",
      },
      {
        type: "cta",
        titre: "Les droits se fixent avec le montant, pas après",
        texte:
          "Sur Collabbs, la marque choisit la durée et le périmètre au moment de poser les termes. Le supplément se calcule, il est annoncé aux deux parties, il va intégralement au créateur, et le contrat écrit nomme précisément ce qui a été cédé — et à quel prix.",
        libelle: "Voir comment ça marche",
        href: "/signup",
      },
    ],
    sources: [
      { titre: "Prix vidéo UGC en France — guide 2026 (Takema)", url: "https://www.takema-studio.com/marques/prix-video-ugc-en-france-le-guide-complet-pour-2026" },
      { titre: "Tarif créateur UGC 2026 : combien facturer aux marques", url: "https://www.collabscene.com/resources/creators/tarif-createur-ugc-2026" },
    ],
  },
  {
    slug: "se-faire-payer-createur-ugc",
    titre: "Créateur UGC : comment être sûr d'être payé",
    description:
      "Livrer d'abord et espérer ensuite est la norme du métier — et la première cause d'impayés. Les protections qui existent réellement : acompte, contrat écrit, séquestre. Et ce que la loi impose désormais à la marque.",
    intention: "créateur UGC impayé se faire payer sécurité",
    categorie: "Créateurs",
    publieLe: "2026-08-31",
    lecture: 5,
    contenu: [
      {
        type: "p",
        texte:
          "Le scénario est toujours le même. Un échange en messages privés, un accord de principe sur un montant, une vidéo livrée — puis plus de réponse. Ou une réponse qui demande une retouche, puis une autre, puis une troisième.",
      },
      {
        type: "p",
        texte:
          "Ce n'est pas de la malchance : c'est la conséquence directe d'un métier qui s'exerce presque entièrement **sans contrat et sans garantie de paiement**.",
      },
      { type: "h2", texte: "Ce qui protège vraiment, par ordre d'efficacité" },
      {
        type: "h3",
        texte: "1. L'argent bloqué avant que vous tourniez",
      },
      {
        type: "p",
        texte:
          "C'est la seule protection qui ne dépend pas de la bonne foi de la marque. Le principe du **séquestre** : la marque paie avant la prestation, mais l'argent ne lui appartient plus et ne vous est versé qu'à la livraison validée. Si elle disparaît, les fonds sont déjà là.",
      },
      { type: "h3", texte: "2. Le contrat écrit" },
      {
        type: "p",
        texte:
          "Il ne fait pas payer à votre place, mais il fixe ce qui est dû, pour quoi, et dans quel délai. Sans lui, un désaccord se règle sur des captures d'écran de conversation.",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "Depuis janvier 2026, ce n'est plus à vous de le demander",
        texte:
          "Un contrat écrit est obligatoire dès 1 000 € HT cumulés sur l'année civile avec une même marque — avantages en nature compris. Et la marque n'est pas seule concernée : créateur, marque et agence sont solidairement responsables. Demander un contrat n'est plus une exigence inconfortable, c'est la loi.",
      },
      { type: "h3", texte: "3. Le nombre de retouches, écrit à l'avance" },
      {
        type: "p",
        texte:
          "La demande de retouche sans fin est la version polie du non-paiement. Deux rounds inclus, annoncés dès le départ, coupent court : au-delà, c'est une nouvelle prestation.",
      },
      { type: "h2", texte: "Les signaux qui doivent vous alerter" },
      {
        type: "liste",
        items: [
          "Un refus de contrat écrit, même pour un montant modeste.",
          "Un paiement promis « à la publication » sans date ni garantie.",
          "Un brief qui change après la livraison.",
          "Une marque qui ne veut communiquer que par messages privés.",
          "Une demande de fichiers sources avant tout paiement.",
        ],
      },
      { type: "h2", texte: "Et si vous êtes déjà impayé" },
      {
        type: "p",
        texte:
          "Rassemblez tout ce qui matérialise l'accord — messages, brief, livrable, dates. Envoyez une relance écrite, puis une mise en demeure. Pour les montants faibles, la procédure est souvent plus coûteuse que la créance : c'est précisément pour cette raison que la protection se joue **avant**, pas après.",
      },
      {
        type: "cta",
        titre: "Sur Collabbs, l'argent est bloqué avant que vous tourniez",
        texte:
          "La marque règle la collaboration en séquestre dès l'acceptation. Le contrat est généré et signé par les deux parties. Vous livrez, la marque valide, vous êtes payé — et si elle ne répond pas dans le délai, la validation se fait automatiquement. Le tout est gratuit pour vous : la commission est à la charge de la marque, et vous touchez l'intégralité du montant annoncé.",
        libelle: "Créer mon profil gratuitement",
        href: "/signup",
      },
    ],
    sources: [
      { titre: "Loi influenceur 2026 : contrat obligatoire, sanctions et conformité — Tanke", url: "https://www.tanke.fr/loi-influenceur-2026/" },
      { titre: "Influence commerciale : nouvelles obligations dès janvier 2026 — TGS France Avocats", url: "https://www.tgs-avocats.fr/blog/influence-commerciale-de-nouvelles-obligations-contractuelles-des-janvier-2026" },
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
