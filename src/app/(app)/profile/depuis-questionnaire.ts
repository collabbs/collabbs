"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliserCarteCreateur, TRANCHES_AUDIENCE } from "@/lib/quiz";
import { saveCreatorOnboarding } from "@/app/onboarding/actions";

/**
 * Le questionnaire d'un créateur devient son profil.
 *
 * ─── Le trou que ça bouche ───
 * Côté marque, le pont existait : le questionnaire devient une campagne.
 * Côté créateur, non. Il remplissait son pseudo, sa plateforme, son audience,
 * ses niches et ses tarifs par format — puis tout était jeté, et on lui
 * redemandait la même chose après l'inscription. On lui faisait faire deux
 * fois le même travail, et le second est celui qu'on abandonne.
 *
 * Conséquence plus grave depuis ce soir : sans profil, il n'est visible
 * d'aucune marque. Aucune ne peut le repérer, donc aucun match ne peut jamais
 * se former. Le pont ne manquait pas de confort, il bloquait la boucle.
 *
 * ─── On passe par l'inscription existante ───
 * `saveCreatorOnboarding` porte déjà les règles : normalisation du pseudo, de
 * la ville, écriture des niches, des plateformes et des offres. Une seconde
 * porte d'entrée qui les contourne finirait par diverger.
 */

/** L'audience déclarée par tranche : on prend le bas de la fourchette. */
function abonnesDepuisTranche(id: string | null): number | null {
  const t = TRANCHES_AUDIENCE.find((x) => x.id === id);
  if (!t) return null;
  // Le bas, pas le milieu : une marque filtre sur un minimum, et annoncer
  // plus que le plancher déclaré serait gonfler le chiffre à sa place.
  return t.min;
}

export async function creerProfilDepuisCarte(
  brute: unknown,
): Promise<{ ok: boolean; error?: string }> {
  // La carte vient du navigateur : elle a pu être bricolée ou corrompue.
  const carte = normaliserCarteCreateur(brute);
  if (!carte) return { ok: false, error: "Questionnaire illisible." };
  if (!carte.handle) return { ok: false, error: "Il manque le pseudo." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const admin = createAdminClient();

  /* ⚠️ ON NE RECOUVRE JAMAIS UN PROFIL DÉJÀ RENSEIGNÉ.
     Depuis que le questionnaire occupe la page d'accueil, un créateur déjà
     inscrit qui répond par curiosité voyait, à sa visite suivante, sa bio, sa
     ville, ses réseaux et ses offres REMPLACÉS par ses réponses — sans
     confirmation, sans message, sans retour arrière.
     La reprise ne sert qu'à installer un profil qui n'existe pas encore. */
  const { data: existant } = await admin
    .from("creators")
    .select("handle, bio, city")
    .eq("id", user.id)
    .maybeSingle();
  const dejaRenseigne = Boolean(
    existant && (existant.bio?.trim() || existant.city?.trim() || existant.handle?.trim()),
  );
  if (dejaRenseigne) {
    // Ce n'est pas un échec : il a déjà son profil, il n'y a rien à reprendre.
    return { ok: true };
  }

  // Les niches du questionnaire sont des LIBELLÉS, la base attend des
  // identifiants. On traduit sur le libellé exact, sans rapprochement flou :
  // ranger quelqu'un dans une niche qu'il n'a pas choisie serait pire que de
  // n'en garder aucune.
  const { data: niches } = await admin.from("niches").select("id, label");
  const parLibelle = new Map((niches ?? []).map((n) => [n.label.toLowerCase(), n.id]));
  const nicheIds = carte.niches
    .map((l) => parLibelle.get(l.toLowerCase()))
    .filter((id): id is number => typeof id === "number");

  // La plateforme est un slug ; la base attend son identifiant.
  const { data: plateformes } = await admin.from("platforms").select("id, slug");
  const idPlateforme = (plateformes ?? []).find((p) => p.slug === carte.plateforme)?.id;

  return saveCreatorOnboarding({
    handle: carte.handle,
    // Ce qu'on n'a pas demandé, on ne l'invente pas : le créateur complétera
    // sa bio et sa ville depuis son profil, où c'est visible et modifiable.
    bio: "",
    avatarUrl: null,
    customNiche: "",
    city: "",
    travels: false,
    niches: nicheIds,
    platforms: idPlateforme
      ? [
          {
            platformId: idPlateforme,
            handle: carte.handle,
            subscribers: abonnesDepuisTranche(carte.audience),
            url: "",
          },
        ]
      : [],
    // Un prix par format, exactement comme le questionnaire les a collectés.
    // Les formats sans prix — affiliation, performance — passent à `null` :
    // ce sont des commissions, pas des forfaits.
    offers: carte.offres.map((offre) => ({
      offer: offre,
      price: carte.prix[offre] ?? null,
    })),
  });
}
