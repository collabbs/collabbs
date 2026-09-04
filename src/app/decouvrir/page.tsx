import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Advantages from "@/components/landing/Advantages";
import Comparison from "@/components/landing/Comparison";
import Pricing from "@/components/landing/Pricing";
import Faq from "@/components/landing/Faq";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";
import { SITE } from "@/lib/legal-entity";

/**
 * La page qui explique Collabbs.
 *
 * C'est l'échappatoire du parcours d'entrée : quelqu'un qui arrive et ne sait
 * pas encore ce qu'il cherche — une marque sans idée de campagne, un créateur
 * qui découvre — vient ici plutôt que d'abandonner devant un questionnaire.
 *
 * ⚠️ Rigoureusement les MÊMES composants que `/`, dans le même ordre, sans la
 * moindre modification. Cette page ne réécrit rien : elle donne une seconde
 * adresse à un assemblage qui existe déjà. Le jour où `/` accueillera le quiz,
 * c'est ici que le contenu explicatif continuera de vivre — et il n'aura pas
 * bougé d'une ligne entre-temps.
 */
export const metadata: Metadata = {
  title: "Collabbs — la marketplace qui connecte créateurs et marques",
  description:
    "Trouvez le créateur idéal et collaborez comme vous voulez — UGC, vidéo, story, paiement à la performance ou affiliation. Contrats automatiques, paiement séquestré, 0 % de commission côté créateur.",
  alternates: { canonical: `${SITE.url}/decouvrir` },
  openGraph: {
    title: "Collabbs — créateurs et marques, en clair",
    description:
      "Contrat écrit généré, paiement bloqué en séquestre jusqu'à la livraison, et le créateur garde 100 % de ce qui est convenu.",
    url: `${SITE.url}/decouvrir`,
    type: "website",
  },
};

export default function PageDecouvrir() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Advantages />
        <Comparison />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
