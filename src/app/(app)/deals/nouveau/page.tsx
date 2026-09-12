import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FormulaireProposition from "./FormulaireProposition";

/**
 * Proposer une collaboration à un créateur — les termes d'abord.
 *
 * ─── Pourquoi cette page existe ───
 * Le bouton « Proposer une collaboration » créait la collaboration au clic, à
 * 0 €, puis affichait une consigne : « Montant à fixer, utilise Modifier les
 * termes ». Il promettait une proposition et livrait un devoir à faire — et
 * une marque qui changeait d'avis en route laissait une coquille vide dans sa
 * liste comme dans celle du créateur.
 *
 * Ici, rien n'est écrit tant qu'il n'y a rien à proposer. On repart sans
 * laisser de trace si on ferme l'onglet.
 */
export default async function PageNouvelleProposition({
  searchParams,
}: {
  searchParams: Promise<{ createur?: string }>;
}) {
  const { createur } = await searchParams;
  if (!createur) redirect("/creators");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: moi } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (moi?.role !== "brand") redirect("/dashboard");

  const [{ data: profil }, { data: fiche }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", createur).single(),
    supabase
      .from("creators")
      .select("handle, rate_video, rate_mention, rate_pack")
      .eq("id", createur)
      .maybeSingle(),
  ]);
  if (!profil) redirect("/creators");

  // Une collaboration déjà ouverte avec ce créateur : on n'en propose pas une
  // seconde, on renvoie vers celle qui existe. Deux propositions concurrentes
  // s'ignoreraient, et personne ne saurait laquelle fait foi.
  const { data: ouverte } = await supabase
    .from("deals")
    .select("id")
    .eq("brand_id", user.id)
    .eq("creator_id", createur)
    .is("campaign_id", null)
    .in("status", ["negotiation", "active"])
    .limit(1);
  if (ouverte && ouverte.length > 0) redirect(`/deals/${ouverte[0].id}?existante=1`);

  /* Le tarif affiché du créateur sert de point de départ au montant. Une marque
     qui ne sait pas quoi mettre part de ce que le créateur demande — c'est
     l'information la plus utile qu'on ait, et elle évite la proposition à 20 €
     qui fait fuir. */
  const tarifDepart = fiche?.rate_video ?? fiche?.rate_pack ?? fiche?.rate_mention ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={fiche?.handle ? `/creators/${fiche.handle}` : "/creators"}
        className="text-sm font-medium text-zinc-500 transition hover:text-ink"
      >
        ← Retour au profil
      </Link>

      <h1 className="font-display mt-4 text-3xl font-black tracking-tight text-ink">
        Proposer une collaboration
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        à <span className="font-semibold text-ink">{profil.display_name ?? "ce créateur"}</span>
        {fiche?.handle ? ` · @${fiche.handle}` : ""}
      </p>

      <FormulaireProposition
        creatorId={createur}
        nomCreateur={profil.display_name ?? "ce créateur"}
        tarifDepart={tarifDepart}
      />
    </div>
  );
}
