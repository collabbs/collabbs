import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
// ⚠️ Sans cet import, `reportError` ne serait pas une erreur de compilation :
// c'est aussi une fonction globale du navigateur (`window.reportError`), à un
// seul argument. Le code aurait compilé et signalé dans le vide.
import { reportError } from "@/lib/report-error";

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

  /* ⚠️ `creators.is_demo`, PAS la forme de l'adresse.
     Le garde-fou d'hier reposait sur le texte de l'adresse : il cherchait
     « @collabbs.test » et « +demo ». Or les comptes de démonstration
     s'appellent `demo+lea@collabbs.dev` — le plus est AVANT, et le domaine
     n'est pas celui que je croyais. Aucun des vingt-quatre n'était donc
     écarté, et `collabbs.dev` n'a pas d'enregistrement MX : vingt-quatre
     rebonds durs d'un coup, exactement ce que le garde-fou disait empêcher.
     Une devinette sur une chaîne de caractères ne protège rien. La base sait
     qui est un compte de démonstration : on le lui demande. */
  const [{ data: createurs }, { count: campagnes }] = await Promise.all([
    admin.from("creators").select("id").eq("is_demo", false).limit(2000),
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
     domaine d'expédition tout neuf — c'est ainsi qu'on brûle sa réputation
     avant d'avoir écrit à un seul vrai utilisateur.

     ⚠️⚠️ ET SURTOUT : `listUsers` peut échouer EN ENTIER.
     Six lignes d'authentification sont corrompues (des marques de démo créées
     en SQL, avec des jetons à NULL que GoTrue ne sait pas lire). Une seule
     ligne malade fait tomber la page entière, donc l'appel complet.
     La première version de ce garde-fou lisait `data` sans regarder `error` :
     la table d'adresses restait vide, chaque créateur tombait dans « adresse
     inconnue », et le rappel n'envoyait RIEN — en comptant tout le monde comme
     « ignoré ». Un envoi hebdomadaire qui ne part jamais et qui se déclare en
     bonne santé, c'est pire que pas d'envoi du tout.

     On lit donc l'erreur, on le dit, et on se rabat sur une lecture compte par
     compte : elle ne récupère que les créateurs retenus, et une ligne malade
     n'emporte plus que la sienne. */
  const { data: comptes, error: errComptes } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (errComptes) {
    await reportError("cron/rappel-defile-comptes", errComptes, {
      detail:
        "listUsers a échoué : lecture compte par compte à la place. " +
        "Une ligne auth.users corrompue suffit à faire tomber l'appel entier.",
    });
  }
  const adresses = new Map(
    (comptes?.users ?? []).map((u) => [u.id, (u.email ?? "").toLowerCase()]),
  );

  /* Filet de sécurité, DERRIÈRE `is_demo` et non à sa place : les domaines
     qui ne reçoivent rien. Si un jeu de données de test arrive un jour sans
     être marqué, il ne coûtera pas la réputation du domaine d'envoi. */
  const DOMAINES_MORTS = ["@collabbs.dev", "@collabbs.test", "@example.com", "@example.org"];

  /** L'adresse d'un créateur, en dernier recours ligne par ligne. */
  async function adresseDe(id: string): Promise<string | null> {
    const connue = adresses.get(id);
    if (connue !== undefined) return connue;
    const { data, error } = await admin.auth.admin.getUserById(id);
    // Cette ligne-ci est illisible : on ne lui écrit pas, et on ne fait pas
    // tomber le reste de l'envoi pour autant.
    if (error || !data?.user) return null;
    const mail = (data.user.email ?? "").toLowerCase();
    adresses.set(id, mail);
    return mail;
  }

  for (const c of createurs ?? []) {
    const adresse = await adresseDe(c.id);
    if (!adresse || DOMAINES_MORTS.some((d) => adresse.endsWith(d))) {
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
