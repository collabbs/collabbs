import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";

/**
 * Le rappel qui tient la promesse du paquet.
 *
 * ─── Pourquoi ───
 * L'écran de fin annonce « 35 autres t'attendent demain ». Rien ne déclenchait
 * ce retour : la promesse était faite, le rappel n'existait pas. Or c'est le
 * seul mécanisme qui fait revenir — personne ne revient pour une liste.
 *
 * ─── Ce qu'on ne fait pas ───
 * On n'écrit pas à quelqu'un qui n'a rien de neuf à voir. Un rappel qui promet
 * des nouveautés et n'en montre aucune apprend à ignorer les suivants, et on
 * ne le récupère plus.
 *
 * On n'écrit pas non plus à quelqu'un qui vient de passer : le rappel sert à
 * ramener, pas à harceler quelqu'un qui est déjà là.
 */

/** Nombre de jours d'absence avant qu'un rappel se justifie. */
const ABSENCE_JOURS = 3;
/** En dessous, il n'y a pas de quoi déranger. */
const NOUVEAUTES_MINIMUM = 5;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const seuil = new Date(Date.now() - ABSENCE_JOURS * 24 * 3600 * 1000).toISOString();

  const [{ data: createurs }, { count: campagnes }] = await Promise.all([
    admin.from("profiles").select("id, display_name").eq("role", "creator").limit(2000),
    admin
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const total = campagnes ?? 0;
  let envoyes = 0;
  let ignores = 0;

  /* ⚠️ Jamais aux comptes de DÉMONSTRATION.
     Ils portent des adresses en `@collabbs.test`, un domaine qui n'existe pas.
     Le premier envoi aurait produit vingt-quatre rebonds durs d'un coup sur un
     domaine d'expédition tout neuf — c'est exactement ainsi qu'on brûle sa
     réputation avant d'avoir écrit à un seul vrai utilisateur. */
  const { data: comptes } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const adresses = new Map(
    (comptes?.users ?? []).map((u) => [u.id, (u.email ?? "").toLowerCase()]),
  );

  for (const c of createurs ?? []) {
    const adresse = adresses.get(c.id) ?? "";
    if (!adresse || adresse.endsWith("@collabbs.test") || adresse.includes("+demo")) {
      ignores++;
      continue;
    }
    // Ce qu'il a vu, et quand il a regardé pour la dernière fois.
    const { data: vues } = await admin
      .from("cartes_vues")
      .select("cible_id, created_at")
      .eq("viewer_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    const derniere = vues?.[0]?.created_at;
    // Quelqu'un qui vient de passer n'a pas besoin qu'on le rappelle.
    if (derniere && derniere > seuil) {
      ignores++;
      continue;
    }

    const restantes = total - (vues?.length ?? 0);
    // Le chiffre annoncé doit être VRAI, sinon le rappel se dément à
    // l'ouverture et on perd la personne pour de bon.
    if (restantes < NOUVEAUTES_MINIMUM) {
      ignores++;
      continue;
    }

    await notify({
      userId: c.id,
      type: "rappel_defile",
      title: `${restantes} campagnes t'attendent`,
      body: "Elles n'ont pas encore trouvé leur créateur. Regarde celles qui te parlent.",
      link: "/defile",
    });
    envoyes++;
  }

  return NextResponse.json({ ok: true, envoyes, ignores });
}
