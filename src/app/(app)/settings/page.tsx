import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "./PasswordForm";
import DangerZone from "./DangerZone";

export const metadata = {
  title: "Réglages — Collabbs",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const dangerError =
    sp.error === "confirm"
      ? "Tu dois taper exactement SUPPRIMER pour confirmer."
      : sp.error
        ? sp.error
        : null;

  // Format "Sur Collabbs depuis [mois année]"
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="pb-12">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight text-ink sm:text-4xl">
          Réglages
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Gère ton compte, ta sécurité et la confidentialité.
        </p>
      </div>

      {/* ============ Section Compte ============ */}
      <section className="mt-8 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Compte</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Informations rattachées à ta connexion.
        </p>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <dt className="font-medium text-zinc-600">Email</dt>
            <dd className="font-mono text-ink">{user.email}</dd>
          </div>
          {memberSince && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <dt className="font-medium text-zinc-600">Membre depuis</dt>
              <dd className="text-ink">{memberSince}</dd>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="font-medium text-zinc-600">ID utilisateur</dt>
            <dd className="select-all font-mono text-[11px] text-zinc-400">{user.id}</dd>
          </div>
        </dl>

        <p className="mt-5 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
          Pour changer ton adresse email, contacte le support à{" "}
          <a href="mailto:support@collabbs.com" className="font-semibold text-brand hover:underline">
            support@collabbs.com
          </a>
          .
        </p>
      </section>

      {/* ============ Section Sécurité ============ */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">Sécurité</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Change régulièrement ton mot de passe.
        </p>
        <PasswordForm />
      </section>

      {/* ============ Section Notifications email ============ */}
      <section className="mt-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-ink">
          Notifications email
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Choisis ce que tu reçois par mail. Les notifications in-app continuent
          d&apos;arriver dans tous les cas.
        </p>
        <div className="mt-5 space-y-2">
          {[
            { label: "Nouveaux deals et propositions", desc: "Reçus quand une marque te contacte ou propose une collab." },
            { label: "Mises à jour de mes collaborations", desc: "Livrables validés, paiements, fin de deal." },
            { label: "Messages", desc: "Quand quelqu'un t'envoie un message." },
            { label: "Affiliation (ventes & seuils)", desc: "Quand une vente est confirmée ou que tu atteins un palier." },
            { label: "Récap hebdomadaire", desc: "Tous les lundis, résumé de ta semaine sur Collabbs." },
          ].map((n) => (
            <div
              key={n.label}
              className="flex items-start justify-between gap-3 rounded-xl bg-zinc-50/50 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{n.label}</p>
                <p className="text-xs text-zinc-500">{n.desc}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                Bientôt
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ Zone danger ============ */}
      <section className="mt-6 rounded-2xl border border-red-100 bg-red-50/40 p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-black text-red-700">Zone danger</h2>
        <p className="mt-1 text-xs text-red-600">
          Actions irréversibles. Lis bien avant de cliquer.
        </p>
        <DangerZone error={dangerError} />
      </section>
    </div>
  );
}
