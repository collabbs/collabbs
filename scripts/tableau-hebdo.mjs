#!/usr/bin/env node
/**
 * Le tableau du lundi — où en est le test de sortie.
 *
 *   node scripts/tableau-hebdo.mjs
 *
 * ─── Pourquoi ce script existe ───
 * Le plan de sortie du 05/11 (`JARVIS/domaines/collabbs-sortie.md`) fixe un
 * test de huit semaines dont le verdict se lit sur une seule ligne : combien
 * de collaborations ont été payées en séquestre par des marques que Julien
 * n'a pas démarchées. Trois canaux sont testés en même temps.
 *
 * Sans ce tableau, huit semaines produiraient un chiffre sans explication, et
 * la décision qui suit — prolonger, arrêter, investir — se prendrait à
 * l'aveugle. Le point n° 7 du plan demandait donc « un tableau hebdo tiré de
 * Supabase + liens UTM par canal ». Les liens UTM sont dans `lib/origine.ts` ;
 * voici le tableau.
 *
 * ─── Ce que ce script NE PEUT PAS savoir, et qu'il n'invente pas ───
 * Une campagne ou une transaction ne compte, selon le plan, que si la marque
 * (a) n'a pas été contactée par Julien, (b) n'est pas un proche ni un élève,
 * (c) a payé avec sa propre carte. (a) et (b) ne sont écrits nulle part en
 * base : ce sont des jugements. Le script sort donc des CANDIDATS et nomme
 * chaque marque, pour que Julien exclue à la lecture. Il ne décide pas à sa
 * place, et il ne fait surtout pas semblant que (a) et (b) soient mesurés.
 *
 * ─── Lecture seule ───
 * Aucune écriture, nulle part. Il lit la production et imprime.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ─── Accès ─────────────────────────────────────────────────────────────── */

/** Lit une variable dans `.env.local`, comme `verifier-fuite-brands.sh`. */
function lire(nom) {
  for (const f of [".env.local", ".env"]) {
    try {
      const ligne = readFileSync(new URL(`../${f}`, import.meta.url), "utf8")
        .split("\n")
        .find((l) => l.startsWith(`${nom}=`));
      if (ligne) return ligne.slice(nom.length + 1).replace(/^["']|["'\r]+$/g, "");
    } catch {
      /* fichier absent : on essaie le suivant */
    }
  }
  return "";
}

const URL_SB = lire("NEXT_PUBLIC_SUPABASE_URL");
const CLE = lire("SUPABASE_SECRET_KEY");
if (!URL_SB || !CLE) {
  console.error("Clés introuvables dans .env.local — lance ce script depuis le dépôt collabbs.");
  process.exit(1);
}
const db = createClient(URL_SB, CLE, { auth: { persistSession: false } });

/* ─── Ce qu'on retire du décompte ───────────────────────────────────────── */

/**
 * Les comptes de Julien, repérés lors du ménage du 23/10/2026.
 *
 * Ils portent l'historique comptable des paiements de test et ne doivent
 * jamais compter dans le verdict : ce sont ses propres cartes. Gardés en base
 * exprès — les supprimer effacerait la trace des paiements.
 */
const COMPTES_DE_JULIEN = new Set([
  "687a3447-0db5-4138-9048-5595a8c63394", // marque « test » — 4 transactions
  "32998ce4-cc69-4f9c-a8b2-e7f314c1ace2", // « julien test1 » / @juliendrn
]);

/** Les statuts d'une transaction où l'argent de la marque est réellement parti. */
const ARGENT_PARTI = ["in_escrow", "released", "paid"];

/* ─── Mise en forme ─────────────────────────────────────────────────────── */

const nb = (n) => String(n).padStart(5);
const feu = (v, stop, go) => (v >= go ? "🟢 GO" : v <= stop ? "🔴 STOP" : "🟡 PROLONGER");

function titre(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
  console.log("─".repeat(t.length));
}

/* ─── Le relevé ─────────────────────────────────────────────────────────── */

async function main() {
  const projet = URL_SB.match(/\/\/([a-z]+)\./)?.[1] ?? "?";
  const aujourdhui = new Date().toISOString().slice(0, 10);
  console.log(`\n\x1b[1mCollabbs — tableau du ${aujourdhui}\x1b[0m`);
  console.log(`projet ${projet} · lecture seule · seuils du plan du 05/11`);

  /* ── 1. Les marques candidates ──
     Toute marque qui n'est ni de démonstration ni un compte de Julien. On les
     NOMME : c'est à la lecture que se fait l'exclusion des proches et des
     marques démarchées. */
  const { data: marques, error: errM } = await db
    .from("brands")
    .select("id, name, is_demo, created_at")
    .order("created_at", { ascending: false });
  if (errM) {
    console.error("\nLecture des marques impossible :", errM.message);
    process.exit(1);
  }
  const candidates = (marques ?? []).filter(
    (b) => b.is_demo !== true && !COMPTES_DE_JULIEN.has(b.id),
  );

  /* ── 2. Les campagnes publiées par ces marques ── */
  const idsCandidates = candidates.map((b) => b.id);
  const { data: campagnes } = idsCandidates.length
    ? await db
        .from("campaigns")
        .select("id, name, brand_id, status, privee, created_at")
        .in("brand_id", idsCandidates)
    : { data: [] };
  const publiees = (campagnes ?? []).filter((c) => c.privee === false);

  /* ── 3. L'argent — la ligne qui décide ── */
  const { data: paiements } = await db
    .from("transactions")
    .select("id, brand_id, creator_id, gross_amount, net_amount, status, created_at")
    .eq("type", "deal_payment")
    .in("status", ARGENT_PARTI)
    .order("created_at", { ascending: false });
  const payees = (paiements ?? []).filter(
    (t) => t.brand_id && !COMPTES_DE_JULIEN.has(t.brand_id),
  );
  const parMarque = new Map();
  for (const t of payees) parMarque.set(t.brand_id, (parMarque.get(t.brand_id) ?? 0) + 1);
  const revenantes = [...parMarque.values()].filter((n) => n >= 2).length;

  /* ── 4. Le haut de l'entonnoir ── */
  const etape = async (e) => {
    const { count } = await db
      .from("tunnel_evenements")
      .select("*", { count: "exact", head: true })
      .eq("etape", e);
    return count ?? 0;
  };
  const [ouverts, cotesChoisis, questionnairesFinis] = await Promise.all([
    etape("tunnel_ouvert"),
    etape("cote_choisi"),
    etape("questionnaire_fini"),
  ]);

  /* ── 5. Par canal d'origine ──
     La migration 0088 ajoute la colonne. Tant qu'elle n'est pas passée, on le
     dit au lieu d'afficher des zéros qui ressembleraient à une mesure. */
  const { data: parCanalProfils, error: errCanal } = await db
    .from("profiles")
    .select("origine, role")
    .not("origine", "is", null);
  const canalDisponible = !errCanal;

  /* ─── Impression ─────────────────────────────────────────────────────── */

  titre("La ligne qui décide");
  const n = payees.length;
  console.log(`  collaborations payées en séquestre   ${nb(n)}   ${feu(n, 0, 3)}`);
  console.log(`  dont marques revenues pour une 2e    ${nb(revenantes)}   ${revenantes >= 1 ? "🟢 signal très fort" : "—"}`);
  console.log("\n  Seuils du plan : 0 = STOP · 1-2 = PROLONGER 4 sem. · ≥ 3 = GO");

  titre("Les autres indicateurs");
  console.log(`  vraies campagnes publiées            ${nb(publiees.length)}   ${feu(publiees.length, 2, 10)}`);
  console.log(`  questionnaires terminés              ${nb(questionnairesFinis)}   ${feu(questionnairesFinis, 19, 61)}`);
  console.log(`  côtés choisis (brief commencé)       ${nb(cotesChoisis)}`);
  console.log(`  tunnels ouverts                      ${nb(ouverts)}`);

  titre("Par canal d'origine");
  if (!canalDisponible) {
    console.log("  ⚠️  Colonne absente : la migration 0088 n'est pas appliquée.");
    console.log("      Tant qu'elle ne l'est pas, on ne sait pas QUEL canal paie.");
  } else {
    const compte = new Map();
    for (const p of parCanalProfils ?? []) {
      const k = `${p.origine} · ${p.role}`;
      compte.set(k, (compte.get(k) ?? 0) + 1);
    }
    if (compte.size === 0) {
      console.log("  aucun compte encore attribué à un canal");
      console.log("  (normal avant le lancement : la colonne ne se remplit qu'aux nouvelles inscriptions)");
    } else {
      for (const [k, v] of [...compte].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k.padEnd(28)} ${nb(v)} compte(s)`);
      }
    }
  }

  titre("À TOI de trancher — le script ne peut pas le savoir");
  if (candidates.length === 0) {
    console.log("  Aucune marque candidate : il n'y a que des marques d'exemple et tes comptes.");
  } else {
    console.log("  Pour chaque marque ci-dessous : démarchée par toi ? proche ou élève ?");
    console.log("  Si oui, retire-la du décompte à la main.\n");
    for (const b of candidates) {
      const camps = publiees.filter((c) => c.brand_id === b.id).length;
      const pay = parMarque.get(b.id) ?? 0;
      console.log(
        `  ${String(b.created_at).slice(0, 10)}  ${(b.name ?? "(sans nom)").slice(0, 30).padEnd(32)}` +
          `${camps} campagne(s) · ${pay} payée(s)`,
      );
    }
  }
  console.log();
}

main().catch((e) => {
  console.error("\nÉchec :", e?.message ?? e);
  process.exit(1);
});
