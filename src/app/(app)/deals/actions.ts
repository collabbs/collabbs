"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { notify } from "@/lib/notifications";
import { buildContractSnapshot, LEGAL_FIELD_LABELS } from "@/lib/contract-snapshot";

type Result = { ok: boolean; error?: string };

/** Référence de contrat lisible, style CLB-XXXXXX. */
function contractRef(): string {
  return "CLB-" + crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

/**
 * La marque crée un deal à partir d'une candidature acceptée.
 * Pré-rempli depuis la campagne, statut "negotiation", livrables seedés.
 */
export async function createDealFromApplication(applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, creator_id, campaign_id, status, campaigns(brand_id, name, type, fixed_amount, campaign_platforms(platform_id))",
    )
    .eq("id", applicationId)
    .single();
  if (!app || app.campaigns?.brand_id !== user.id) redirect("/campaigns");
  if (app.status !== "accepted") redirect(`/campaigns/${app.campaign_id}`);

  // Évite les doublons : si un deal existe déjà pour ce duo+campagne, on y va.
  const { data: existing } = await supabase
    .from("deals")
    .select("id")
    .eq("brand_id", user.id)
    .eq("creator_id", app.creator_id)
    .eq("campaign_id", app.campaign_id)
    .maybeSingle();
  if (existing) redirect(`/deals/${existing.id}`);

  const platformId = app.campaigns?.campaign_platforms?.[0]?.platform_id ?? null;
  const amount = app.campaigns?.fixed_amount ?? 0;

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      brand_id: user.id,
      creator_id: app.creator_id,
      campaign_id: app.campaign_id,
      title: app.campaigns?.name ?? "Collaboration",
      amount,
      format: "video_post",
      platform_id: platformId,
      quantity: 1,
      status: "negotiation",
    })
    .select("id")
    .single();
  if (error || !deal) redirect(`/campaigns/${app.campaign_id}`);

  // Livrables par défaut.
  await supabase.from("deliverables").insert([
    { deal_id: deal.id, label: "Contenu livré", position: 1 },
    { deal_id: deal.id, label: "Validation finale de la marque", position: 2 },
  ]);

  // Contrat (brouillon) — figé et signé à l'acceptation du créateur.
  await supabase
    .from("contracts")
    .insert({ deal_id: deal.id, reference: contractRef(), status: "draft" });

  await notify({
    userId: app.creator_id,
    type: "deal_proposed",
    title: `Nouveau deal proposé — "${app.campaigns?.name ?? "campagne"}"`,
    body: "La marque vient de te proposer une collaboration. Ouvre la page pour voir les termes et l'accepter.",
    link: `/deals/${deal.id}`,
  });

  redirect(`/deals/${deal.id}`);
}

/**
 * Booking direct : une marque propose une collaboration à un créateur depuis son
 * profil (sans passer par une campagne). Crée un deal en "negotiation".
 */
export async function createDirectDeal(creatorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (creatorId === user.id) redirect("/creators");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "brand") redirect("/creators");

  // Évite les doublons : deal direct (sans campagne) déjà ouvert avec ce créateur.
  const { data: open } = await supabase
    .from("deals")
    .select("id")
    .eq("brand_id", user.id)
    .eq("creator_id", creatorId)
    .is("campaign_id", null)
    .in("status", ["negotiation", "active"])
    .limit(1);
  if (open && open.length > 0) redirect(`/deals/${open[0].id}`);

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      brand_id: user.id,
      creator_id: creatorId,
      campaign_id: null,
      title: "Collaboration",
      amount: 0,
      format: "video_post",
      quantity: 1,
      status: "negotiation",
    })
    .select("id")
    .single();
  if (error || !deal) redirect("/creators");

  await supabase.from("deliverables").insert([
    { deal_id: deal.id, label: "Contenu livré", position: 1 },
    { deal_id: deal.id, label: "Validation finale de la marque", position: 2 },
  ]);

  await supabase
    .from("contracts")
    .insert({ deal_id: deal.id, reference: contractRef(), status: "draft" });

  await notify({
    userId: creatorId,
    type: "deal_proposed",
    title: "Nouveau deal proposé",
    body: "Une marque vient de te proposer une collaboration directe. Ouvre la page pour voir les termes.",
    link: `/deals/${deal.id}`,
  });

  redirect(`/deals/${deal.id}`);
}

/** La marque ajuste les termes pendant la négociation. */
export async function updateDealTerms(
  dealId: string,
  data: { amount: number; quantity: number; deadline: string | null; brandNotes: string | null },
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "negotiation")
    return { ok: false, error: "Les termes ne sont modifiables qu'en négociation." };

  const { error } = await supabase
    .from("deals")
    .update({
      amount: Math.max(0, Math.round(data.amount)),
      quantity: Math.max(1, Math.round(data.quantity)),
      deadline: data.deadline || null,
      brand_notes: data.brandNotes?.trim() || null,
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}

/** Le créateur accepte le deal → passe en "active". */
export async function acceptDeal(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "brand_id, creator_id, status, title, amount, format, platform_id, quantity, deadline, brand_notes",
    )
    .eq("id", dealId)
    .single();
  if (!deal || deal.creator_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "negotiation")
    return { ok: false, error: "Ce deal n'est plus en négociation." };

  // Avant d'accepter, on essaie de construire le snapshot du contrat. Si une
  // partie n'a pas ses infos légales minimales, on bloque ici avec un
  // message explicite — sinon on signerait un contrat à trous.
  const build = await buildContractSnapshot(dealId);
  if (!build.ok) {
    if (build.reason === "incomplete_legal_info" && build.missing) {
      const fields = build.missing.fields
        .map((f) => LEGAL_FIELD_LABELS[f] ?? f)
        .join(", ");
      const who =
        build.missing.who === "creator"
          ? "Tu dois compléter tes infos légales avant de pouvoir accepter"
          : "La marque doit d'abord compléter ses infos légales pour pouvoir signer";
      return { ok: false, error: `${who} : ${fields}.` };
    }
    return { ok: false, error: "Impossible de générer le contrat." };
  }

  // À l'acceptation : on enregistre accepted_at + on calcule escrow_due_at
  // (SLA marque pour régler) à +7 jours. Si dépassé, un cron pourra annuler.
  const acceptedAtIso = new Date().toISOString();
  const escrowDueIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("deals")
    .update({
      status: "active",
      accepted_at: acceptedAtIso,
      escrow_due_at: escrowDueIso,
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  await notify({
    userId: deal.brand_id,
    type: "deal_accepted",
    title: `Le créateur a accepté ton deal "${deal.title ?? "collaboration"}"`,
    body: "Tu peux maintenant régler le séquestre. Tu as 7 jours pour effectuer le paiement, sinon le deal sera annulé automatiquement.",
    link: `/deals/${dealId}`,
  });

  // Le contrat est figé (snapshot complet des termes ET des coordonnées
  // légales des 2 parties) et signé par les 2 parties simultanément.
  const now = new Date().toISOString();
  await supabase
    .from("contracts")
    .update({
      status: "signed",
      brand_signed_at: now,
      creator_signed_at: now,
      terms_snapshot: build.snapshot,
    })
    .eq("deal_id", dealId);

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/** Annulation par l'une ou l'autre partie (tant que non terminé). */
export async function cancelDeal(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || (deal.brand_id !== user.id && deal.creator_id !== user.id))
    return { ok: false, error: "Action non autorisée." };
  if (deal.status === "completed" || deal.status === "cancelled")
    return { ok: false, error: "Ce deal est déjà clôturé." };

  const { error } = await supabase
    .from("deals")
    .update({ status: "cancelled" })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("contracts")
    .update({ status: "terminated", terminated_at: new Date().toISOString() })
    .eq("deal_id", dealId);

  // Notifie l'autre partie de l'annulation.
  const recipientId = deal.brand_id === user.id ? deal.creator_id : deal.brand_id;
  await notify({
    userId: recipientId,
    type: "deal_cancelled",
    title: "Collaboration annulée",
    body:
      deal.brand_id === user.id
        ? "La marque a annulé le deal. Les fonds éventuellement en séquestre seront remboursés."
        : "Le créateur a annulé le deal.",
    link: `/deals/${dealId}`,
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/**
 * Le créateur dépose le lien de sa publication (post / dossier UGC / etc.) et
 * marque automatiquement le livrable comme livré. Modifiable tant que la marque
 * n'a pas validé.
 */
export async function setDeliverableSubmission(
  deliverableId: string,
  url: string,
  notes: string,
): Promise<Result> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return { ok: false, error: "Lien requis." };
  try {
    const u = new URL(trimmedUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:")
      return { ok: false, error: "Le lien doit commencer par http(s)." };
  } catch {
    return { ok: false, error: "Lien invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, approved, deals(creator_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.creator_id !== user.id)
    return { ok: false, error: "Action non autorisée." };
  if (d.deals?.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };
  if (d.approved) return { ok: false, error: "Déjà validé par la marque." };

  const { error } = await supabase
    .from("deliverables")
    .update({
      submission_url: trimmedUrl,
      submission_notes: notes.trim() || null,
      submitted_at: new Date().toISOString(),
      done: true,
    })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  // Notifie la marque (avec throttle pour ne pas spammer si le créateur édite
  // plusieurs fois le même livrable en peu de temps).
  const { data: dealForNotif } = await supabase
    .from("deals")
    .select("brand_id, title")
    .eq("id", d.deal_id)
    .single();
  if (dealForNotif?.brand_id) {
    await notify({
      userId: dealForNotif.brand_id,
      type: "deliverable_submitted",
      title: `Contenu déposé sur "${dealForNotif.title ?? "ta collaboration"}"`,
      body: "Le créateur vient de te déposer un livrable. Va le voir et valide ou demande une révision.",
      link: `/deals/${d.deal_id}`,
      throttleMinutes: 10,
    });
  }

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

type SubmissionFile = { path: string; name: string; size: number; mime: string };

/**
 * Enregistre la métadonnée des fichiers uploadés sur un livrable. L'upload
 * vers Storage est fait côté client (RLS y enforce qui peut écrire) ; ici on
 * ne fait que stocker la liste de fichiers et passer le livrable en "livré".
 */
export async function recordDeliverableFiles(
  deliverableId: string,
  newFiles: SubmissionFile[],
): Promise<Result> {
  if (!newFiles?.length) return { ok: false, error: "Aucun fichier." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, approved, submission_files, deals(creator_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.creator_id !== user.id)
    return { ok: false, error: "Action non autorisée." };
  if (d.deals?.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };
  if (d.approved) return { ok: false, error: "Déjà validé par la marque." };

  const existing = Array.isArray(d.submission_files) ? (d.submission_files as SubmissionFile[]) : [];
  const merged = [...existing, ...newFiles];

  const { error } = await supabase
    .from("deliverables")
    .update({
      submission_files: merged,
      submitted_at: new Date().toISOString(),
      done: true,
    })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  const { data: dealForNotif } = await supabase
    .from("deals")
    .select("brand_id, title")
    .eq("id", d.deal_id)
    .single();
  if (dealForNotif?.brand_id) {
    await notify({
      userId: dealForNotif.brand_id,
      type: "deliverable_submitted",
      title: `Contenu déposé sur "${dealForNotif.title ?? "ta collaboration"}"`,
      body: `Le créateur a uploadé ${newFiles.length} fichier${newFiles.length > 1 ? "s" : ""}. Ouvre la page pour le visionner.`,
      link: `/deals/${d.deal_id}`,
      throttleMinutes: 10,
    });
  }

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/** Retire un fichier d'un livrable (Storage + métadonnée). Créateur, non validé. */
export async function removeDeliverableFile(
  deliverableId: string,
  path: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, approved, submission_files, deals(creator_id)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.creator_id !== user.id)
    return { ok: false, error: "Action non autorisée." };
  if (d.approved) return { ok: false, error: "Déjà validé — fichier non modifiable." };

  await supabase.storage.from("deliverables").remove([path]);

  const existing = Array.isArray(d.submission_files) ? (d.submission_files as SubmissionFile[]) : [];
  const filtered = existing.filter((f) => f.path !== path);

  const { error } = await supabase
    .from("deliverables")
    .update({ submission_files: filtered })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/** Le créateur marque un livrable comme fait / pas fait. */
export async function setDeliverableDone(
  deliverableId: string,
  done: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, deals(creator_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.creator_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (d.deals?.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };

  const { error } = await supabase
    .from("deliverables")
    .update({ done })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/** La marque valide (ou retire la validation d') un livrable. */
export async function setDeliverableApproved(
  deliverableId: string,
  approved: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: d } = await supabase
    .from("deliverables")
    .select("deal_id, deals(brand_id, status)")
    .eq("id", deliverableId)
    .single();
  if (!d || d.deals?.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };

  const { error } = await supabase
    .from("deliverables")
    .update({ approved })
    .eq("id", deliverableId);
  if (error) return { ok: false, error: error.message };

  // Notifie le créateur que la marque a validé (uniquement à la validation, pas au retrait).
  if (approved) {
    const { data: dealForNotif } = await supabase
      .from("deals")
      .select("creator_id, title")
      .eq("id", d.deal_id)
      .single();
    if (dealForNotif?.creator_id) {
      await notify({
        userId: dealForNotif.creator_id,
        type: "deliverable_approved",
        title: `Livrable validé sur "${dealForNotif.title ?? "ta collaboration"}" ✅`,
        body: "La marque a validé ton contenu. Plus qu'à attendre qu'elle clôture le deal pour recevoir ta part.",
        link: `/deals/${d.deal_id}`,
        throttleMinutes: 10,
      });
    }
  }

  revalidatePath(`/deals/${d.deal_id}`);
  return { ok: true };
}

/**
 * La marque demande une retouche sur un livrable.
 * - Respecte le quota `revision_rounds_max` du deal.
 * - Remet le livrable en "à livrer" (done=false, approved=false, submission
 *   vidée) et stocke le message + revision_requested=true.
 * - Incrément `revision_rounds_used` côté deal.
 * - Notifie le créateur avec le message + le nombre de retouches restantes.
 */
export async function requestRevision(
  deliverableId: string,
  message: string,
): Promise<Result> {
  const trimmed = message.trim();
  if (trimmed.length < 5) {
    return { ok: false, error: "Donne un message de retouche clair (5 caractères min)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: dv } = await supabase
    .from("deliverables")
    .select("deal_id, label, deals(brand_id, creator_id, title, status, revision_rounds_max, revision_rounds_used)")
    .eq("id", deliverableId)
    .single();
  if (!dv || dv.deals?.brand_id !== user.id) {
    return { ok: false, error: "Action non autorisée." };
  }
  if (dv.deals?.status !== "active") {
    return { ok: false, error: "Le deal n'est pas en cours." };
  }

  const used = dv.deals.revision_rounds_used ?? 0;
  const max = dv.deals.revision_rounds_max ?? 2;
  if (used >= max) {
    return {
      ok: false,
      error: `Tu as atteint la limite de ${max} rounds de retouches inclus dans ce forfait. Valide la version actuelle ou demande au créateur d'ajuster sur une future collaboration.`,
    };
  }

  // 1. Marque le livrable comme "à refaire"
  const { error: dvErr } = await supabase
    .from("deliverables")
    .update({
      done: false,
      approved: false,
      revision_requested: true,
      revision_message: trimmed,
    })
    .eq("id", deliverableId);
  if (dvErr) return { ok: false, error: dvErr.message };

  // 2. Incrément compteur côté deal
  const { error: dealErr } = await supabase
    .from("deals")
    .update({ revision_rounds_used: used + 1 })
    .eq("id", dv.deal_id);
  if (dealErr) return { ok: false, error: dealErr.message };

  const remaining = max - (used + 1);
  // 3. Notif créateur
  if (dv.deals.creator_id) {
    await notify({
      userId: dv.deals.creator_id,
      type: "deliverable_revision_requested",
      title: `Retouche demandée sur "${dv.label}"`,
      body: `${trimmed}\n\n${remaining === 0 ? "C'était le dernier round de retouches inclus." : `${remaining} round${remaining > 1 ? "s" : ""} de retouches restant${remaining > 1 ? "s" : ""}.`}`,
      link: `/deals/${dv.deal_id}`,
    });
  }

  revalidatePath(`/deals/${dv.deal_id}`);
  return { ok: true };
}

/** La marque clôture le deal → "completed" (tous les livrables validés requis). */
export async function completeDeal(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "active") return { ok: false, error: "Le deal n'est pas en cours." };

  const { data: dels } = await supabase
    .from("deliverables")
    .select("approved")
    .eq("deal_id", dealId);
  const allApproved = (dels ?? []).length > 0 && (dels ?? []).every((d) => d.approved);
  if (!allApproved)
    return { ok: false, error: "Tous les livrables doivent être validés avant de clôturer." };

  const { error } = await supabase
    .from("deals")
    .update({ status: "completed", brand_validated_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) return { ok: false, error: error.message };

  // Tente le versement au créateur (non bloquant : si son compte n'est pas prêt,
  // les fonds restent en séquestre et il pourra déclencher le versement ensuite).
  const payoutRes = await attemptDealPayout(dealId);

  await notify({
    userId: deal.creator_id,
    type: "deal_completed",
    title: "Collaboration terminée 🎉",
    body: payoutRes.released
      ? "La marque a clôturé le deal et ton paiement vient d'être versé sur ton compte."
      : "La marque a clôturé le deal. Pour recevoir ta part, connecte ton compte de paiement.",
    link: payoutRes.released ? `/deals/${dealId}` : "/payouts",
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/**
 * Verse au créateur sa part (net) du séquestre vers son compte connecté.
 * Utilise `source_transaction` (le paiement de la marque) pour autoriser le
 * transfert même si le solde disponible n'est pas encore consolidé.
 * Renvoie le détail pour pouvoir afficher l'erreur réelle au besoin.
 */
async function attemptDealPayout(
  dealId: string,
): Promise<{ released: boolean; error?: string }> {
  if (!stripeConfigured) return { released: false, error: "Stripe non configuré." };
  const admin = createAdminClient();

  const { data: deal } = await admin
    .from("deals")
    .select("creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.status !== "completed")
    return { released: false, error: "Le deal n'est pas terminé." };

  const { data: tx } = await admin
    .from("transactions")
    .select("id, net_amount, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { released: false, error: "Aucun paiement en séquestre." };
  if (tx.status === "released" || tx.status === "paid") return { released: true };
  if (tx.status !== "in_escrow")
    return { released: false, error: "Ce paiement ne peut pas être versé." };

  const { data: cr } = await admin
    .from("creators")
    .select("stripe_account_id")
    .eq("id", deal.creator_id)
    .single();
  if (!cr?.stripe_account_id)
    return { released: false, error: "Le créateur n'a pas encore connecté son compte." };

  try {
    const account = await stripe.accounts.retrieve(cr.stripe_account_id);
    if (account.capabilities?.transfers !== "active")
      return { released: false, error: "Le compte du créateur n'est pas encore prêt à recevoir." };

    let sourceCharge: string | undefined;
    if (tx.reference) {
      const pi = await stripe.paymentIntents.retrieve(tx.reference);
      sourceCharge =
        typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : (pi.latest_charge?.id ?? undefined);
    }

    await stripe.transfers.create({
      amount: Math.round(Number(tx.net_amount) * 100),
      currency: "eur",
      destination: cr.stripe_account_id,
      ...(sourceCharge ? { source_transaction: sourceCharge } : {}),
      metadata: { deal_id: dealId },
    });
    await admin
      .from("transactions")
      .update({ status: "released", escrow_released_at: new Date().toISOString() })
      .eq("id", tx.id);

    // Notif "tu as reçu X€" au créateur.
    await notify({
      userId: deal.creator_id,
      type: "payment_received_creator",
      title: `Tu viens de recevoir ${Number(tx.net_amount).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} 💸`,
      body: "Le versement a été transféré sur ton compte Stripe connecté. Selon ton calendrier de payout, il atterrira sur ton compte bancaire dans les prochains jours.",
      link: "/payouts",
    });

    return { released: true };
  } catch (e) {
    return { released: false, error: e instanceof Error ? e.message : "Échec du versement." };
  }
}

/** Déclenche/réessaie le versement de la part créateur (créateur ou marque). */
export async function releaseDealPayout(dealId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id")
    .eq("id", dealId)
    .single();
  if (!deal || (deal.brand_id !== user.id && deal.creator_id !== user.id))
    return { ok: false, error: "Action non autorisée." };

  const res = await attemptDealPayout(dealId);
  if (!res.released) return { ok: false, error: res.error ?? "Versement impossible pour le moment." };

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/payouts");
  return { ok: true };
}

/** Le créateur relie/complète son compte Stripe pour recevoir ses paiements. */
export async function startCreatorPayoutOnboarding() {
  if (!stripeConfigured) redirect("/payouts?error=stripe");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "creator") redirect("/dashboard");

  const { data: creator } = await supabase
    .from("creators")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  let linkUrl: string | null = null;
  let failed = false;
  try {
    let accountId = creator?.stripe_account_id ?? null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email ?? undefined,
        metadata: { creator_id: user.id },
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await supabase.from("creators").update({ stripe_account_id: accountId }).eq("id", user.id);
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/payouts?refresh=1`,
      return_url: `${origin}/payouts?done=1`,
      type: "account_onboarding",
    });
    linkUrl = link.url;
  } catch {
    failed = true;
  }
  if (failed) redirect("/payouts?error=connect");
  if (linkUrl) redirect(linkUrl);
  redirect("/payouts");
}

/** La marque rembourse un paiement encore en séquestre (avant versement). */
export async function refundDeal(dealId: string): Promise<Result> {
  if (!stripeConfigured) return { ok: false, error: "Stripe non configuré." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from("transactions")
    .select("id, status, reference")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (!tx) return { ok: false, error: "Aucun paiement à rembourser." };
  if (tx.status !== "in_escrow")
    return { ok: false, error: "Ce paiement ne peut plus être remboursé." };
  if (!tx.reference) return { ok: false, error: "Référence de paiement introuvable." };

  try {
    await stripe.refunds.create({ payment_intent: tx.reference });
  } catch {
    return { ok: false, error: "Le remboursement Stripe a échoué." };
  }
  await admin.from("transactions").update({ status: "refunded" }).eq("id", tx.id);

  // Notifie le créateur que le paiement a été remboursé (donc pas de versement).
  const { data: dealForNotif } = await supabase
    .from("deals")
    .select("creator_id, title")
    .eq("id", dealId)
    .single();
  if (dealForNotif?.creator_id) {
    await notify({
      userId: dealForNotif.creator_id,
      type: "deal_refunded",
      title: `Paiement remboursé sur "${dealForNotif.title ?? "le deal"}"`,
      body: "La marque a annulé son paiement avant clôture — le versement vers ton compte n'aura donc pas lieu pour ce deal.",
      link: `/deals/${dealId}`,
    });
  }

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return { ok: true };
}

/**
 * La marque règle le deal : crée une session Stripe Checkout (mode test).
 * Les fonds vont sur la balance plateforme = séquestre, jusqu'au versement
 * au créateur à la clôture (versement via Connect — étape suivante).
 */
export async function createDealCheckout(dealId: string) {
  if (!stripeConfigured) redirect(`/deals/${dealId}?stripe=missing`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, title, amount, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) redirect("/deals");
  if (deal.status !== "active" || !deal.amount || deal.amount <= 0)
    redirect(`/deals/${dealId}`);

  // Déjà payé ?
  const { data: tx } = await supabase
    .from("transactions")
    .select("id")
    .eq("deal_id", dealId)
    .eq("type", "deal_payment")
    .maybeSingle();
  if (tx) redirect(`/deals/${dealId}`);

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const origin = `${proto}://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          product_data: { name: deal.title ?? "Collaboration Collabbs" },
          unit_amount: deal.amount * 100,
        },
      },
    ],
    metadata: { deal_id: dealId, brand_id: deal.brand_id, creator_id: deal.creator_id },
    payment_intent_data: { metadata: { deal_id: dealId } },
    success_url: `${origin}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/deals/${dealId}?canceled=1`,
  });

  if (session.url) redirect(session.url);
  redirect(`/deals/${dealId}`);
}

/** La marque laisse un avis sur un deal terminé (1 avis par deal). */
export async function leaveReview(
  dealId: string,
  rating: number,
  comment: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non connecté." };

  const r = Math.round(rating);
  if (r < 1 || r > 5) return { ok: false, error: "Note invalide." };

  const { data: deal } = await supabase
    .from("deals")
    .select("brand_id, creator_id, status")
    .eq("id", dealId)
    .single();
  if (!deal || deal.brand_id !== user.id) return { ok: false, error: "Action non autorisée." };
  if (deal.status !== "completed")
    return { ok: false, error: "Tu pourras laisser un avis une fois le deal terminé." };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("deal_id", dealId)
    .maybeSingle();
  if (existing) return { ok: false, error: "Tu as déjà laissé un avis pour ce deal." };

  const { error } = await supabase.from("reviews").insert({
    deal_id: dealId,
    brand_id: user.id,
    creator_id: deal.creator_id,
    rating: r,
    comment: comment.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  await notify({
    userId: deal.creator_id,
    type: "review_received",
    title: `Tu as reçu un avis ${"⭐".repeat(r)}`,
    body: comment.trim() ? `"${comment.trim().slice(0, 200)}"` : "La marque vient de noter votre collaboration.",
    link: `/deals/${dealId}`,
  });

  revalidatePath(`/deals/${dealId}`);
  return { ok: true };
}
