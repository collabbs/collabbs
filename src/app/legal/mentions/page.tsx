import LegalDoc, { Val } from "../LegalDoc";
import { LEGAL_ENTITY as E, HOST, SITE, legalEntityIncomplete } from "@/lib/legal-entity";

export const metadata = {
  title: "Mentions légales — Collabbs",
  description: "Identité de l'éditeur, hébergeur et contact du site Collabbs.",
};

/**
 * Mentions légales — obligatoires au titre de l'article 6-III de la LCEN
 * du 21 juin 2004. Leur absence est un délit ; leur inexactitude aussi.
 */
export default function MentionsPage() {
  const incomplete = legalEntityIncomplete();

  return (
    <LegalDoc
      title="Mentions légales"
      current="/legal/mentions"
      intro="Informations relatives à l'éditeur et à l'hébergeur du site, conformément à la loi pour la confiance dans l'économie numérique."
    >
      {incomplete && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Ces mentions sont incomplètes.</p>
          <p className="mt-1">
            Certaines informations obligatoires n&apos;ont pas encore été renseignées.
            Le site ne doit pas être ouvert au public en l&apos;état — l&apos;absence
            de mentions légales est sanctionnée pénalement.
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="font-display text-xl font-bold text-ink">Éditeur du site</h2>
          <dl className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-100">
            {[
              ["Dénomination", E.name],
              ["Forme juridique", E.legalForm],
              ["Capital social", E.capital],
              ["Siège social", `${E.address}, ${E.zip} ${E.city}, ${E.country}`],
              ["SIRET", E.siret],
              ["RCS", E.rcs],
              ["TVA intracommunautaire", E.vat],
              ["Directeur de la publication", E.publicationDirector],
              ["Contact", E.contactEmail],
              ["Téléphone", E.phone],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap justify-between gap-3 px-4 py-3">
                <dt className="text-zinc-500">{k}</dt>
                <dd className="text-right font-medium text-ink">
                  <Val>{String(v)}</Val>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink">Hébergeur</h2>
          <p className="mt-3">
            Le site est hébergé par <strong className="text-ink">{HOST.name}</strong>,{" "}
            {HOST.address}.
          </p>
          <p className="mt-2">
            Les données applicatives (base de données, authentification, fichiers) sont
            hébergées par <strong className="text-ink">Supabase Inc.</strong> au sein de
            l&apos;Union européenne, région de Francfort (Allemagne).
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            Propriété intellectuelle
          </h2>
          <p className="mt-3">
            La marque {SITE.name}, le site et les éléments qui le composent — structure,
            textes, interface, code — sont protégés par le droit de la propriété
            intellectuelle. Toute reproduction ou représentation, totale ou partielle,
            sans autorisation écrite préalable est interdite.
          </p>
          <p className="mt-2">
            Les contenus publiés par les créateurs et les marques restent la propriété
            de leurs auteurs respectifs. {SITE.name} n&apos;acquiert aucun droit sur ces
            contenus au-delà de ce qui est strictement nécessaire au fonctionnement du
            service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink">Signalement</h2>
          <p className="mt-3">
            {SITE.name} agit en qualité d&apos;hébergeur au sens de la LCEN pour les
            contenus publiés par ses utilisateurs. Tout contenu manifestement illicite
            peut être signalé à{" "}
            <a
              href={`mailto:${E.contactEmail}`}
              className="text-purple-700 underline underline-offset-2"
            >
              {E.contactEmail}
            </a>
            . Le signalement doit préciser le contenu visé, son emplacement et les
            motifs pour lesquels il devrait être retiré.
          </p>
        </section>
      </div>
    </LegalDoc>
  );
}
