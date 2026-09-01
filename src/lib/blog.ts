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
          "Le seuil s'apprécie **par couple marque × créateur** et **sur l'année**. Deux collaborations à 600 € avec le même créateur dans la même année déclenchent l'obligation, même si aucune ne l'atteint seule.",
      },
      {
        type: "p",
        texte:
          "Voici le texte exact, parce qu'il vaut mieux le lire une fois que le paraphraser dix. L'article 1er du décret impose le contrat écrit lorsque « la somme des rémunérations versées et de la valeur des avantages en nature accordés à un influenceur par un annonceur au cours de la même année en contrepartie d'une prestation ou d'un ensemble de prestations d'influence commerciale par voie électronique **poursuivant un même objectif promotionnel** est supérieure ou égale à un montant de 1 000 euros hors taxes ».",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "« Un même objectif promotionnel » : la condition que presque personne ne cite",
        texte:
          "Le cumul ne mélange pas tout ce qu'une marque verse à un créateur : il additionne les prestations qui poursuivent **le même but promotionnel**. Deux campagnes réellement distinctes — un lancement de produit en mars, une opération de fin d'année sans rapport — s'apprécient séparément. En revanche, une série de collaborations qui servent la même promotion se cumulent, quel que soit leur nombre. La frontière n'a pas encore été tranchée par un juge : dans le doute, la prudence est de cumuler.",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "Un outil gratuit pour suivre ce cumul",
        texte:
          "Ce calcul est le genre de chose qu'on ne fait pas de tête : par marque, sur l'année, argent et cadeaux additionnés. Nous avons mis en ligne un **suivi du seuil de 1 000 €** utilisable sans compte, où rien ne quitte votre navigateur : [ouvrir l'outil](/outils/seuil-1000-euros).",
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
            "L'année, et non la collaboration",
            "Le décret dit « au cours de la même année ». Collabbs remet le compteur à zéro le 1er janvier",
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
          "Contrat écrit obligatoire dès **1 000 € HT cumulés** sur l'année, par couple marque × créateur, pour un même objectif promotionnel.",
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
          "Le seuil de 1 000 € HT qui déclenche l'obligation de contrat écrit s'apprécie sur la rémunération ET la valeur des avantages en nature, cumulées sur l'année pour un même couple marque × créateur, dès lors que les prestations poursuivent le même objectif promotionnel. Un produit à 400 € offert rapproche du seuil exactement autant que 400 € virés.",
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
        type: "encadre",
        ton: "info",
        titre: "Chiffrer votre cas en dix secondes",
        texte:
          "Nous avons mis ces paliers dans un calculateur gratuit et sans compte : vous entrez le prix du contenu, la durée et le périmètre, il vous rend le montant à facturer. [Ouvrir le calculateur](/outils/droits-usage).",
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
          "Un contrat écrit est obligatoire dès 1 000 € HT cumulés sur l'année avec une même marque — avantages en nature compris. Et la marque n'est pas seule concernée : créateur, marque et agence sont solidairement responsables. Demander un contrat n'est plus une exigence inconfortable, c'est la loi.",
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
  {
    slug: "meilleures-plateformes-ugc-france",
    titre: "Les meilleures plateformes UGC en France : le comparatif 2026",
    description:
      "Youdji, Influee, Moggo, Skeepers, Collabbs : quatre modèles économiques très différents derrière un même mot. Tarifs relevés sur les pages publiques de chaque plateforme, et comment choisir selon votre situation.",
    intention: "meilleure plateforme UGC france comparatif",
    categorie: "Comparatif",
    publieLe: "2026-08-31",
    lecture: 9,
    contenu: [
      {
        type: "p",
        texte:
          "Toutes ces plateformes promettent la même chose : des vidéos UGC, des créateurs vérifiés, des paiements sécurisés. La différence n'est pas là. Elle est dans **qui paie quoi**, et ça change le coût réel d'un facteur trois selon la plateforme et selon le volume que vous produisez.",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "Comment ce comparatif a été fait",
        texte:
          "Chaque chiffre cité ici a été relevé le **31 août 2026 sur la page publique de la plateforme concernée** — pas sur un comparatif tiers, pas de mémoire. Les liens sont en bas de page, vérifiez vous-même. Les tarifs évoluent : si vous lisez ceci bien plus tard, recoupez.",
      },
      { type: "h2", texte: "Quatre modèles économiques, pas quatre plateformes" },
      {
        type: "p",
        texte:
          "Comprenez le modèle et vous saurez laquelle vous convient, sans lire une seule page de fonctionnalités.",
      },
      { type: "h3", texte: "1. Abonnement mensuel + commission — Influee" },
      {
        type: "p",
        texte:
          "Influee facture un abonnement à la plateforme, **et** prend une commission sur ce que vous versez aux créateurs. Sa page tarifs affiche Starter à **199 € / mois** (jusqu'à 10 créateurs par mois), Basic à **449 € / mois** (25 créateurs), Pro à **849 € / mois** (50 créateurs), et une offre Enterprise sur mesure. À chaque palier s'ajoutent **10 % de frais de marketplace sur les paiements aux créateurs**, qui ne sont pas compris dans l'abonnement.",
      },
      {
        type: "p",
        texte:
          "Leur propre exemple de calcul : 199 € d'abonnement + 10 vidéos de 30 secondes à 28 € = **479 € le premier mois**. La plateforme annonce plus de 150 000 créateurs dans le monde et les droits d'utilisation inclus.",
      },
      {
        type: "p",
        texte:
          "**Le modèle est bon si** vous produisez en continu et en volume : l'abonnement se dilue. **Il est mauvais si** vous faites trois vidéos par trimestre — vous payez l'abonnement les mois où vous ne produisez rien.",
      },
      { type: "h3", texte: "2. Commission prélevée au créateur — Youdji" },
      {
        type: "p",
        texte:
          "Youdji ne fait payer ni abonnement ni commission à la marque. Sa page tarifs affiche pour les marques et agences : **abonnement 0 € / mois, commission 0 %**. Pour les créateurs, la même page affiche : **abonnement 0 € / mois, commission 20 %**.",
      },
      {
        type: "p",
        texte:
          "Autrement dit, la plateforme est gratuite pour la marque parce que c'est le créateur qui la finance, à hauteur d'un cinquième de ce qu'il facture. La plateforme annonce plus de 11 300 créateurs vérifiés, plus de 3 000 marques et agences, et un paiement séquestré libéré à l'approbation de la commande.",
      },
      {
        type: "encadre",
        ton: "alerte",
        titre: "Une commission créateur se répercute presque toujours sur le prix",
        texte:
          "Un créateur qui veut toucher 200 € net sur une plateforme à 20 % ne facture pas 200 €, il facture 250 €. La gratuité côté marque est donc en partie une gratuité de façade : elle est intégrée dans les tarifs affichés par les créateurs. Ce qui ne veut pas dire que le modèle est mauvais — mais il faut comparer des prix nets, pas des pourcentages.",
      },
      { type: "h3", texte: "3. Commission des deux côtés — Takema" },
      {
        type: "p",
        texte:
          "Takema est le seul concurrent français à écrire noir sur blanc le mot « séquestre », et le seul à prélever **des deux côtés à la fois**. Sa page tarifs affiche **10 % du montant HT à la marque, plus 2,5 % de frais de transaction**, et **5 % au créateur — ramenés à 0 % avec un abonnement Pro à 19 € par mois**. Publier une annonce est gratuit. La plateforme annonce plus de 7 000 créateurs.",
      },
      {
        type: "p",
        texte:
          "**Le modèle est bon si** vous voulez la sécurité du séquestre sans abonnement côté marque. **Il est à regarder de près si** vous êtes créateur : sur 250 € facturés, il reste 237,50 € — ou 250 € si vous payez 228 € d'abonnement dans l'année, ce qui n'est rentable qu'au-delà d'environ 4 560 € de collaborations annuelles.",
      },
      { type: "h3", texte: "4. Prix fixe par vidéo — Moggo" },
      {
        type: "p",
        texte:
          "Moggo vend la vidéo, pas l'accès à un annuaire : **99 € HT** pour une vidéo de 15 secondes, sans abonnement et sans commission. Le site annonce plus de 4 000 créateurs vérifiés, deux demandes de retouche incluses, une livraison sous sept jours et les droits publicitaires pour deux ans compris dans le prix.",
      },
      {
        type: "p",
        texte:
          "**Le modèle est bon si** vous voulez du contenu sans gérer de relation créateur : vous commandez, vous recevez. **Il est limité si** vous cherchez une relation durable avec des créateurs identifiés, une campagne d'affiliation, ou un créateur qui parle à sa propre audience — ici vous achetez un fichier vidéo, pas une prise de parole.",
      },
      { type: "h3", texte: "5. Suite entreprise sur devis — Skeepers" },
      {
        type: "p",
        texte:
          "Skeepers ne publie aucun tarif : chaque parcours mène à « Demander une démo ». C'est une suite complète — avis clients, feedback, communautés de marque, et une brique marketing d'influence — annoncée à plus de 6 000 entreprises clientes et plus de 100 000 micro et nano-influenceurs.",
      },
      {
        type: "p",
        texte:
          "**Le modèle est bon si** vous êtes une marque établie avec un budget annuel et un besoin qui dépasse l'UGC. **Il est inadapté si** vous êtes entrepreneur ou petite marque : l'entrée se fait par un cycle commercial, pas par une inscription.",
      },
      { type: "h2", texte: "Le tableau" },
      {
        type: "tableau",
        entetes: ["Plateforme", "Coût pour la marque", "Coût pour le créateur", "Modèle"],
        lignes: [
          ["**Youdji**", "0 € / mois, 0 % de commission", "0 € / mois, **20 % de commission**", "Marketplace financée par les créateurs"],
          ["**Influee**", "199 à 849 € / mois **+ 10 %** sur les paiements créateurs", "Non affiché sur la page tarifs marques", "Abonnement + commission"],
          ["**Takema**", "10 % + 2,5 % de frais, sans abonnement", "**5 %** — ou 0 % avec un abonnement à 19 €/mois", "Commission des deux côtés, séquestre"],
          ["**Moggo**", "99 € HT par vidéo de 15 s", "Non affiché", "Vente à l'unité, sans abonnement"],
          ["**Skeepers**", "Sur devis, démo obligatoire", "Non affiché", "Suite entreprise"],
          ["**Collabbs**", "0 € / mois + 10 %, ou 99 € / mois + 8 %, ou 299 € / mois + 5 %", "**0 %** — le créateur touche le montant annoncé", "Commission ajoutée au prix, à la charge de la marque"],
        ],
      },
      {
        type: "p",
        texte:
          "Une précision d'honnêteté : Collabbs est lancé en 2026 et n'affiche pas de compteur de créateurs, parce qu'un chiffre gonflé se retourne toujours contre celui qui l'annonce. Si votre critère numéro un est la taille du catalogue, les plateformes ci-dessus ont plusieurs années d'avance et il faut le dire.",
      },
      { type: "h2", texte: "Ce que le tableau ne montre pas : le coût réel à volume donné" },
      {
        type: "p",
        texte:
          "Prenez une marque qui commande **cinq vidéos à 200 € net pour le créateur** dans le mois. Voici ce qu'elle sort réellement, sur la base des tarifs publics ci-dessus :",
      },
      {
        type: "liste",
        items: [
          "**Influee, offre Starter** : 199 € d'abonnement + 1 000 € aux créateurs + 100 € de frais de marketplace = **1 299 €**.",
          "**Youdji** : 0 € de frais, mais le créateur qui veut 200 € net facture 250 € pour absorber les 20 % — soit **1 250 €** si les tarifs affichés intègrent la commission, ce qui est l'usage.",
          "**Moggo** : cinq vidéos de 15 s à 99 € HT = **495 €**, mais ce n'est pas le même produit — format court, pas de relation créateur, pas de publication sur le compte du créateur.",
          "**Collabbs, offre gratuite** : 1 000 € aux créateurs + 100 € de commission = **1 100 €**, sans abonnement, et le créateur touche bien 200 €.",
        ],
      },
      {
        type: "p",
        texte:
          "Ces chiffres ne désignent pas un gagnant : ils montrent que **la question utile est votre volume mensuel**, pas le pourcentage affiché. En dessous de dix vidéos par mois, tout modèle avec abonnement vous coûte cher. Au-dessus de cinquante, c'est l'inverse.",
      },
      { type: "h2", texte: "Le critère que presque aucune plateforme ne traite : le contrat" },
      {
        type: "p",
        texte:
          "Depuis le **1er janvier 2026**, un contrat écrit est obligatoire dès **1 000 € HT cumulés sur l'année entre une même marque et un même créateur** — avantages en nature compris. Marque, agence et créateur sont **solidairement responsables**.",
      },
      {
        type: "p",
        texte:
          "Ce seuil se franchit sans qu'on s'en aperçoive : quatre collaborations à 300 € avec le même créateur dans l'année, et vous y êtes. Une plateforme qui vous met en relation mais vous laisse gérer le contrat vous laisse aussi la responsabilité.",
      },
      {
        type: "cta",
        titre: "Collabbs génère le contrat et suit le seuil pour vous",
        texte:
          "Le contrat est produit au moment de l'accord, signé par les deux parties, et fige les conditions réelles de la collaboration. Le cumul annuel par créateur est suivi automatiquement. L'argent est bloqué en séquestre à l'acceptation et libéré à la validation. Et la commission est payée par la marque : le créateur touche l'intégralité du montant annoncé.",
        libelle: "Créer un compte gratuitement",
        href: "/signup",
      },
    ],
    sources: [
      { titre: "Youdji — page tarifs (relevée le 31/08/2026)", url: "https://youdji.com/fr/pricing" },
      { titre: "Influee — tarification création UGC (relevée le 31/08/2026)", url: "https://influee.co/fr/tarification/creation-ugc" },
      { titre: "Takema — page plateforme et tarifs (relevée le 31/08/2026)", url: "https://www.takema-studio.com/plateforme" },
      { titre: "Moggo — page d'accueil (relevée le 31/08/2026)", url: "https://www.moggo.fr/" },
      { titre: "Skeepers — page d'accueil (relevée le 31/08/2026)", url: "https://skeepers.io/fr/" },
      { titre: "Décret n° 2025-1137 du 28 novembre 2025 — Légifrance", url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000052950561" },
    ],
  },
  {
    slug: "alternative-youdji",
    titre: "Alternative à Youdji : ce que change une commission payée par la marque",
    description:
      "Youdji est gratuit pour les marques et prélève 20 % aux créateurs. Ce que ce choix implique concrètement sur les tarifs, sur la qualité des profils, et quelles alternatives existent en France.",
    intention: "alternative youdji",
    categorie: "Comparatif",
    publieLe: "2026-08-30",
    lecture: 6,
    contenu: [
      {
        type: "p",
        texte:
          "Youdji est une plateforme UGC française sérieuse : paiement séquestré, facturation automatique, plus de 11 300 créateurs vérifiés annoncés et plus de 6 millions de dollars reversés selon son site. Si vous cherchez une alternative, c'est rarement pour la qualité de l'outil — c'est presque toujours pour une question de tarif, et elle mérite d'être posée précisément.",
      },
      { type: "h2", texte: "Ce que dit exactement leur page tarifs" },
      {
        type: "p",
        texte:
          "Deux colonnes, deux chiffres. **Marques et agences : abonnement 0 € / mois, commission 0 %.** **Créateurs : abonnement 0 € / mois, commission 20 %.**",
      },
      {
        type: "p",
        texte:
          "C'est cohérent et assumé : la plateforme est financée par le côté créateur. Un créateur qui facture 250 € en reçoit 200. Aucun reproche à faire à un modèle affiché aussi clairement — mais il a trois conséquences qu'il vaut mieux avoir en tête avant de choisir.",
      },
      { type: "h2", texte: "Conséquence 1 : la gratuité côté marque est en partie apparente" },
      {
        type: "p",
        texte:
          "Un créateur qui vise 200 € net ne peut pas afficher 200 €. Il affiche 250 €. La commission ne disparaît pas parce qu'elle est prélevée de l'autre côté : elle **remonte dans les prix du catalogue**.",
      },
      {
        type: "p",
        texte:
          "Comparer « 0 % » à « 10 % » n'a donc aucun sens tant qu'on n'a pas comparé le **prix net payé pour une même prestation**. C'est le seul chiffre qui compte, et il faut le calculer sur des devis réels, pas sur des pages tarifs.",
      },
      { type: "h2", texte: "Conséquence 2 : le créateur a intérêt à sortir de la plateforme" },
      {
        type: "p",
        texte:
          "Quand la commission pèse sur le créateur, chaque collaboration lui coûte 20 %. La deuxième collaboration avec la même marque est donc **structurellement tentante à faire en direct** — et beaucoup le font. La marque y gagne à court terme, et perd le séquestre, le contrat et la trace écrite au moment précis où les montants deviennent significatifs.",
      },
      {
        type: "p",
        texte:
          "Quand la commission est à la charge de la marque et s'ajoute au prix, le créateur n'a aucune raison de fuir : il touche la même chose dedans et dehors, mais dedans il est payé d'avance et couvert par un contrat.",
      },
      { type: "h2", texte: "Conséquence 3 : le seuil légal reste sur votre bureau" },
      {
        type: "p",
        texte:
          "Depuis le 1er janvier 2026, un contrat écrit est obligatoire dès **1 000 € HT cumulés dans l'année entre une marque et un créateur**, avantages en nature compris, avec **responsabilité solidaire** des deux parties. Ce cumul se suit par couple marque × créateur : c'est un travail de comptabilité que personne ne fait à la main correctement.",
      },
      { type: "h2", texte: "Les alternatives, selon ce que vous cherchez" },
      {
        type: "liste",
        items: [
          "**Vous voulez juste des fichiers vidéo, vite** : Moggo vend la vidéo de 15 secondes à 99 € HT, sans abonnement ni commission, droits publicitaires deux ans inclus.",
          "**Vous produisez en gros volume tous les mois** : Influee propose des abonnements de 199 à 849 € / mois selon le nombre de créateurs, plus 10 % sur les paiements créateurs, avec plus de 150 000 créateurs annoncés.",
          "**Vous êtes une entreprise établie avec un besoin large** : Skeepers couvre avis clients, communautés et influence, sur devis après démo.",
          "**Vous voulez que le créateur touche le montant annoncé et que le contrat soit géré** : c'est le parti pris de Collabbs, détaillé ci-dessous.",
        ],
      },
      { type: "h2", texte: "Le parti pris de Collabbs" },
      {
        type: "p",
        texte:
          "Sur Collabbs, **la commission est payée par la marque et s'ajoute au prix** au lieu d'être prélevée sur la part du créateur. Une collaboration à 300 € coûte 330 € à la marque en offre gratuite, et le créateur reçoit 300 €. Le taux baisse avec l'abonnement : 10 % sans abonnement, 8 % à 99 € / mois, 5 % à 299 € / mois.",
      },
      {
        type: "p",
        texte:
          "Ce n'est pas une générosité, c'est un calcul : un créateur payé intégralement n'a aucune raison de contourner la plateforme, et une marque qui garde ses collaborations dans l'outil garde ses contrats et ses preuves.",
      },
      {
        type: "encadre",
        ton: "info",
        titre: "Où sont vérifiés ces chiffres",
        texte:
          "Les tarifs Youdji, Influee, Moggo et Skeepers cités ici ont été relevés le **31 août 2026 sur leurs pages publiques**, dont les liens figurent en bas de cet article. Aucun n'est repris d'un comparatif tiers. Les tarifs bougent : vérifiez à la source avant de décider.",
      },
      {
        type: "cta",
        titre: "Essayez sans abonnement",
        texte:
          "L'offre gratuite de Collabbs permet de faire tourner deux campagnes en même temps, sans carte bancaire et sans engagement. Contrat conforme généré automatiquement, paiement séquestré, suivi du seuil de 1 000 €. Gratuit pour les créateurs, toujours.",
        libelle: "Créer un compte gratuitement",
        href: "/signup",
      },
    ],
    sources: [
      { titre: "Youdji — page tarifs (relevée le 31/08/2026)", url: "https://youdji.com/fr/pricing" },
      { titre: "Youdji — page créateurs (relevée le 31/08/2026)", url: "https://youdji.com/fr/creators" },
      { titre: "Influee — tarification création UGC (relevée le 31/08/2026)", url: "https://influee.co/fr/tarification/creation-ugc" },
      { titre: "Moggo — page d'accueil (relevée le 31/08/2026)", url: "https://www.moggo.fr/" },
      { titre: "Décret n° 2025-1137 du 28 novembre 2025 — Légifrance", url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000052950561" },
    ],
  },
  {
    slug: "alternative-skeepers",
    titre: "Alternative à Skeepers quand on est entrepreneur ou petite marque",
    description:
      "Skeepers est une suite entreprise vendue sur devis après démo. Si vous cherchez une alternative, c'est souvent parce que le cycle commercial ne correspond pas à votre taille. Les options qui s'ouvrent par simple inscription.",
    intention: "alternative skeepers",
    categorie: "Comparatif",
    publieLe: "2026-08-29",
    lecture: 6,
    contenu: [
      {
        type: "p",
        texte:
          "Skeepers est un acteur majeur : plus de 6 000 entreprises clientes annoncées, une communauté de plus de 100 000 micro et nano-influenceurs, et une suite qui va bien au-delà de l'UGC — avis clients, gestion du feedback, communautés de marque, marketing d'influence.",
      },
      {
        type: "p",
        texte:
          "Si vous cherchez une alternative, ce n'est généralement pas un problème de fonctionnalités. C'est que **rien n'est accessible sans passer par une démo commerciale**, et qu'aucun tarif n'est publié. Pour une marque qui fait 30 000 € de chiffre d'affaires et veut lancer trois collaborations le mois prochain, ce n'est simplement pas le bon format.",
      },
      { type: "h2", texte: "Ce que vous cherchez vraiment en cherchant une alternative" },
      {
        type: "liste",
        items: [
          "**Un tarif public**, que vous pouvez évaluer seul, sans rendez-vous.",
          "**Une inscription immédiate**, sans engagement annuel ni minimum de volume.",
          "**Une brique unique** — les collaborations créateurs — sans payer pour trois modules que vous n'utiliserez pas.",
          "**La conformité quand même** : contrat écrit, traçabilité des paiements. Ce n'est pas parce qu'on est petit que le décret ne s'applique pas.",
        ],
      },
      { type: "h2", texte: "Les options accessibles sans passer par un commercial" },
      { type: "h3", texte: "Si vous voulez des vidéos, sans relation créateur" },
      {
        type: "p",
        texte:
          "**Moggo** vend la vidéo à l'unité : 99 € HT pour un format de 15 secondes, sans abonnement ni commission, deux retouches et deux ans de droits publicitaires inclus, livraison annoncée sous sept jours. Vous commandez comme sur un site marchand.",
      },
      { type: "h3", texte: "Si vous produisez beaucoup, tous les mois" },
      {
        type: "p",
        texte:
          "**Influee** fonctionne à l'abonnement : 199 € / mois pour jusqu'à 10 créateurs, 449 € pour 25, 849 € pour 50, plus **10 % de frais de marketplace** sur les sommes versées aux créateurs. La plateforme annonce plus de 150 000 créateurs. Le modèle devient intéressant à partir d'une production régulière et soutenue.",
      },
      { type: "h3", texte: "Si vous ne voulez rien payer d'avance" },
      {
        type: "p",
        texte:
          "**Youdji** n'applique ni abonnement ni commission aux marques — sa page tarifs affiche 0 € / mois et 0 %. En contrepartie, la même page affiche **20 % de commission côté créateur**, qui se retrouve mécaniquement dans les tarifs que les créateurs affichent.",
      },
      { type: "h3", texte: "Si le contrat et la conformité sont votre sujet" },
      {
        type: "p",
        texte:
          "C'est la raison d'être de **Collabbs** : offre gratuite sans carte bancaire avec deux campagnes actives simultanées et 10 % de commission, puis 99 € / mois pour 8 % et cinq campagnes, ou 299 € / mois pour 5 % et un nombre illimité de campagnes. La commission est **à la charge de la marque** et s'ajoute au prix : le créateur touche l'intégralité du montant convenu.",
      },
      {
        type: "encadre",
        ton: "alerte",
        titre: "Être une petite structure n'exonère de rien",
        texte:
          "Depuis le 1er janvier 2026, le contrat écrit est obligatoire dès **1 000 € HT cumulés sur l'année entre une marque et un créateur**, avantages en nature inclus, et la responsabilité est **solidaire**. Le seuil ne dépend ni de votre chiffre d'affaires ni de votre effectif. Trois collaborations à 400 € dans l'année avec le même créateur suffisent.",
      },
      { type: "h2", texte: "Comment trancher en une question" },
      {
        type: "p",
        texte:
          "Demandez-vous ce que vous achetez. **Un fichier vidéo** ? Prenez le prix à l'unité. **Un volume industriel** ? Prenez l'abonnement. **Une relation avec des créateurs qui parlent à leur audience, avec un cadre juridique qui tient** ? Prenez la plateforme qui produit le contrat et bloque l'argent, pas celle qui se contente de vous présenter des profils.",
      },
      {
        type: "cta",
        titre: "Commencez sans rendez-vous commercial",
        texte:
          "Compte créé en deux minutes, offre gratuite sans carte bancaire, deux campagnes actives en même temps. Contrat écrit conforme généré à l'accord, paiement séquestré jusqu'à validation, suivi automatique du seuil de 1 000 € par créateur.",
        libelle: "Créer un compte gratuitement",
        href: "/signup",
      },
    ],
    sources: [
      { titre: "Skeepers — page d'accueil (relevée le 31/08/2026)", url: "https://skeepers.io/fr/" },
      { titre: "Moggo — page d'accueil (relevée le 31/08/2026)", url: "https://www.moggo.fr/" },
      { titre: "Influee — tarification création UGC (relevée le 31/08/2026)", url: "https://influee.co/fr/tarification/creation-ugc" },
      { titre: "Youdji — page tarifs (relevée le 31/08/2026)", url: "https://youdji.com/fr/pricing" },
      { titre: "Décret n° 2025-1137 du 28 novembre 2025 — Légifrance", url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000052950561" },
    ],
  },
  {
    slug: "plateforme-ugc-createur-combien-elle-prend",
    titre: "Créateur UGC : combien chaque plateforme vous prend réellement",
    description:
      "Avant de fixer vos tarifs, sachez ce que la plateforme retient. Comparatif des commissions côté créateur en France, et comment calculer le prix à afficher pour toucher le montant que vous visez.",
    intention: "commission plateforme ugc créateur combien",
    categorie: "Créateurs",
    publieLe: "2026-08-28",
    lecture: 7,
    contenu: [
      {
        type: "p",
        texte:
          "La première erreur d'un créateur UGC qui démarre n'est pas de facturer trop peu. C'est de **facturer un montant sans savoir ce qu'il en restera**. Sur certaines plateformes, un tarif de 200 € vous laisse 200 €. Sur d'autres, il vous en laisse 160.",
      },
      { type: "h2", texte: "Ce que retiennent les principales plateformes en France" },
      {
        type: "tableau",
        entetes: ["Plateforme", "Ce qu'elle retient au créateur", "Sur 250 € facturés, vous touchez"],
        lignes: [
          ["**Youdji**", "20 % de commission, aucun abonnement", "**200 €**"],
          ["**Collabbs**", "0 % — la commission est payée par la marque, en plus du prix", "**250 €**"],
          ["**Takema**", "5 % de commission, ou 0 % avec un abonnement à 19 €/mois", "**237,50 €** (ou 250 € si vous payez l'abonnement)"],
          ["**Influee**", "Non affiché sur la page tarifs destinée aux marques", "À vérifier auprès d'eux"],
          ["**Moggo**", "Non affiché — la plateforme vend la vidéo à prix fixe et rémunère ses créateurs séparément", "À vérifier auprès d'eux"],
        ],
      },
      {
        type: "encadre",
        ton: "info",
        titre: "Pourquoi deux cases disent « à vérifier »",
        texte:
          "Parce que ces plateformes ne publient pas leur commission créateur sur une page publique, et qu'inventer un chiffre serait exactement le genre d'information qui vous ferait perdre de l'argent. Demandez-le par écrit avant votre première collaboration — une plateforme sérieuse répond en une phrase.",
      },
      { type: "h2", texte: "La formule pour afficher le bon prix" },
      {
        type: "p",
        texte:
          "Sur une plateforme qui prélève un pourcentage, le prix à afficher n'est **pas** votre objectif majoré du même pourcentage. C'est votre objectif **divisé** par ce qui vous reste.",
      },
      {
        type: "liste",
        items: [
          "Objectif 200 € net, commission 20 % → 200 ÷ 0,80 = **250 €** à afficher.",
          "Objectif 400 € net, commission 20 % → 400 ÷ 0,80 = **500 €** à afficher.",
          "L'erreur classique : afficher 200 + 20 % = 240 €, et toucher 192 €. Vous perdez 8 € à chaque fois sans le voir.",
        ],
      },
      { type: "h2", texte: "Le vrai risque n'est pas la commission, c'est de ne pas être payé" },
      {
        type: "p",
        texte:
          "Une commission de 20 % sur une collaboration payée vaut infiniment mieux que 0 % sur une collaboration jamais réglée. Avant de comparer les taux, vérifiez trois choses :",
      },
      {
        type: "liste",
        items: [
          "**L'argent est-il bloqué avant que vous tourniez ?** Un séquestre signifie que la marque a déjà payé, et que la somme vous attend. Sans séquestre, vous travaillez à crédit.",
          "**Que se passe-t-il si la marque ne valide jamais ?** Sur une plateforme sérieuse, la validation devient automatique après un délai. Sinon, votre paiement dépend du bon vouloir d'un interlocuteur silencieux.",
          "**Y a-t-il un contrat écrit ?** Depuis le 1er janvier 2026, il est obligatoire dès 1 000 € HT cumulés dans l'année avec la même marque, avantages en nature compris — et vous êtes **solidairement responsable** de son absence, pas seulement la marque.",
        ],
      },
      { type: "h2", texte: "Les produits offerts comptent dans le seuil" },
      {
        type: "p",
        texte:
          "C'est le piège des créateurs qui travaillent beaucoup en gifting. La valeur des produits reçus entre dans le cumul annuel au même titre que l'argent. Trois envois à 350 € de valeur commerciale de la même marque, et vous êtes au-dessus du seuil : le contrat écrit est obligatoire, même si vous n'avez jamais reçu un euro.",
      },
      {
        type: "cta",
        titre: "Sur Collabbs, vous touchez le montant affiché",
        texte:
          "Zéro commission, zéro abonnement, à vie. La commission est payée par la marque et s'ajoute au prix : si vous annoncez 250 €, vous recevez 250 €. L'argent est bloqué en séquestre avant que vous tourniez, le contrat est généré et signé automatiquement, et la validation se déclenche seule si la marque ne répond pas.",
        libelle: "Créer mon profil gratuitement",
        href: "/signup",
      },
    ],
    sources: [
      { titre: "Youdji — page tarifs (relevée le 31/08/2026)", url: "https://youdji.com/fr/pricing" },
      { titre: "Influee — tarification création UGC (relevée le 31/08/2026)", url: "https://influee.co/fr/tarification/creation-ugc" },
      { titre: "Moggo — page d'accueil (relevée le 31/08/2026)", url: "https://www.moggo.fr/" },
      { titre: "Décret n° 2025-1137 du 28 novembre 2025 — Légifrance", url: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000052950561" },
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
