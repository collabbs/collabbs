import LegalDoc, { Val, type LegalSection } from "../LegalDoc";
import { LEGAL_ENTITY as E, PROCESSORS } from "@/lib/legal-entity";

export const metadata = {
  title: "Politique de confidentialité — Collabbs",
  description:
    "Quelles données Collabbs collecte, pourquoi, combien de temps, et comment exercer ses droits.",
};

/**
 * ⚠️ Rédigé sans professionnel du droit. À faire relire par un avocat.
 * Décrit le traitement réellement effectué par le code — pas un modèle
 * générique. Toute évolution du produit doit se répercuter ici.
 */
const SECTIONS: LegalSection[] = [
  {
    title: "Données que nous collectons",
    paragraphs: [
      "**Pour créer et tenir un compte** : adresse e-mail, mot de passe chiffré, rôle choisi, nom affiché et photo de profil.",
      "**Pour un profil de créateur** : présentation, thématiques, comptes de réseaux sociaux et nombre d'abonnés déclaré, tarifs, contenus ajoutés au portfolio.",
      "**Pour un profil d'annonceur** : nom de l'entreprise, logo, secteur, site web, présentation.",
      "**Pour établir les contrats et les factures** : statut juridique, nom légal, représentant, adresse, numéro d'identification, numéro de TVA, adresse de contact. Ces informations ne sont exigées qu'au-delà du seuil légal rendant le contrat écrit obligatoire.",
      "**Pour les paiements** : les coordonnées bancaires sont collectées et conservées par notre prestataire de paiement. **Collabbs n'y a jamais accès et n'en conserve aucune copie.**",
      "**Pour mesurer les campagnes d'affiliation** : clics et ventes attribués. Les adresses IP et les agents utilisateurs ne sont conservés que sous forme empreintée, non réversible, aux seules fins de prévention de la fraude.",
      "**Pour la messagerie** : le contenu des échanges entre annonceurs et créateurs.",
    ],
  },
  {
    title: "Pourquoi nous les traitons",
    paragraphs: [
      {
        list: [
          "**Exécution du contrat** — tenir votre compte, mettre en relation, établir les contrats, séquestrer et verser les fonds, mesurer les campagnes.",
          "**Obligation légale** — conserver les pièces contractuelles et comptables, satisfaire aux mentions obligatoires en matière d'influence commerciale.",
          "**Intérêt légitime** — prévenir la fraude, sécuriser les comptes, améliorer le service.",
          "**Consentement** — vérification d'audience auprès d'une plateforme tierce, déclenchée par vous seul.",
        ],
      },
      "Nous n'utilisons vos données à aucune fin publicitaire et ne les vendons pas.",
    ],
  },
  {
    title: "Combien de temps nous les conservons",
    paragraphs: [
      {
        list: [
          "**Compte** — pendant toute sa durée de vie, puis trois ans après le dernier contact.",
          "**Contrats, factures et pièces comptables** — dix ans, conformément aux obligations légales de conservation.",
          "**Messages** — deux ans après la fin de la collaboration à laquelle ils se rattachent.",
          "**Événements d'affiliation** — trois ans, aux fins de justification des commissions versées.",
          "**Journaux techniques** — douze mois au plus.",
        ],
      },
    ],
  },
  {
    title: "Qui y a accès",
    paragraphs: [
      "Vos données ne sont partagées qu'avec les prestataires strictement nécessaires au fonctionnement du service, énumérés ci-dessous, et uniquement pour ce à quoi ils servent.",
      "Certains éléments de votre profil sont **publics par nature** : nom affiché, photo, présentation, thématiques, comptes de réseaux sociaux, tarifs et portfolio d'un créateur dont le profil est visible. Vous pouvez retirer cette visibilité à tout moment.",
      "L'autre partie à une collaboration accède aux informations nécessaires à son exécution, y compris les coordonnées légales figurant au contrat.",
    ],
  },
  {
    title: "Transferts hors de l'Union européenne",
    paragraphs: [
      "L'hébergement applicatif et la base de données se situent dans l'Union européenne. Certains prestataires sont établis aux États-Unis ; ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou par le cadre de protection des données UE–États-Unis.",
      "La vérification d'audience YouTube n'intervient qu'à votre demande explicite et transmet uniquement l'identifiant public de votre chaîne.",
    ],
  },
  {
    title: "Vos droits",
    paragraphs: [
      "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, ainsi que du droit de définir des directives relatives au sort de vos données après votre décès.",
      "La suppression de votre compte est accessible directement depuis vos réglages. Les pièces contractuelles et comptables sont néanmoins conservées pendant la durée légale, même après suppression : nous ne pouvons pas y déroger.",
      "Pour toute demande, écrivez-nous. Nous répondons dans un délai d'un mois.",
      "Vous pouvez également introduire une réclamation auprès de la Commission nationale de l'informatique et des libertés (CNIL), 3 place de Fontenoy, 75007 Paris.",
    ],
  },
  {
    title: "Cookies",
    paragraphs: [
      "**Le site collabbs.com ne dépose que des cookies strictement nécessaires** à votre authentification et à la sécurité de votre session. Ces cookies sont exemptés de consentement préalable ; c'est pourquoi aucune bannière ne vous est présentée.",
      "Nous n'utilisons ni cookie publicitaire, ni outil de mesure d'audience tiers.",
      "Le dispositif de suivi que nous fournissons aux annonceurs dépose un cookie **sur leur propre site**, sous leur responsabilité, aux fins d'attribution des commissions.",
    ],
  },
  {
    title: "Sécurité",
    paragraphs: [
      "Les accès à la base de données sont cloisonnés par des règles appliquées au niveau du serveur : chaque utilisateur ne peut lire que les données qui le concernent.",
      "Les mots de passe sont chiffrés et jamais accessibles en clair. Les échanges sont chiffrés en transit.",
      "En cas de violation de données susceptible d'engendrer un risque élevé pour vos droits, vous en serez informé sans délai injustifié.",
    ],
  },
];

export default function ConfidentialitePage() {
  return (
    <LegalDoc
      title="Politique de confidentialité"
      current="/legal/confidentialite"
      intro="Ce que nous collectons, pourquoi, combien de temps nous le gardons, et comment reprendre la main."
      sections={SECTIONS}
    >
      <div className="mt-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-5 text-sm text-zinc-700">
        <p>
          <strong className="text-ink">Responsable du traitement :</strong>{" "}
          <Val>{E.name}</Val>, <Val>{E.address}</Val> <Val>{E.zip}</Val>{" "}
          <Val>{E.city}</Val>.
        </p>
        <p className="mt-1">
          <strong className="text-ink">Contact :</strong>{" "}
          <a
            href={`mailto:${E.contactEmail}`}
            className="text-purple-700 underline underline-offset-2"
          >
            {E.contactEmail}
          </a>
        </p>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink">Nos sous-traitants</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-zinc-100">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-semibold">Prestataire</th>
                <th className="px-4 py-3 font-semibold">Rôle</th>
                <th className="px-4 py-3 font-semibold">Localisation</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((p) => (
                <tr key={p.name} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.role}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </LegalDoc>
  );
}
