import { redirect } from "next/navigation";

/**
 * L'ancienne adresse du questionnaire.
 *
 * Il vit maintenant à la racine. On redirige plutôt que de dupliquer : deux
 * adresses pour un même parcours, ce sont deux versions qui finissent par
 * diverger — et tous les liens deja partages continuent de fonctionner.
 */
export default async function CommencerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cote = typeof params.cote === "string" ? `?cote=${params.cote}` : "";
  redirect(`/${cote}`);
}
