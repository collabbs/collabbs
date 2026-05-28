const ITEMS = [
  {
    q: "Comment fonctionne l'affiliation sur Collabbs ?",
    a: "Tu t'inscris, tu renseignes ta niche et tes réseaux. Les marques qui correspondent à ton profil te proposent leurs programmes. Tu récupères ton lien tracké en 1 clic — chaque vente via ce lien te génère une commission automatiquement.",
  },
  {
    q: "Comment sont calculées les commissions ?",
    a: "Chaque marque définit sa propre grille par palier d'abonnés. En général les taux montent avec l'audience (Nano 3%, Micro 5%, Mid 8%, Macro 12%). Le créateur voit le taux exact avant d'accepter.",
  },
  {
    q: "Est-ce que les créateurs paient quelque chose ?",
    a: "Non. L'inscription et toutes les fonctionnalités sont gratuites à vie pour les créateurs. Collabbs ne se rémunère que sur les ventes générées — pas de vente, pas de frais.",
  },
  {
    q: "Comment fonctionne un deal vidéo ?",
    a: "Une marque propose un paiement fixe pour une vidéo. Le créateur accepte, un contrat est généré et signé en 5 secondes. Le paiement est bloqué en escrow : le créateur est garanti d'être payé avant de publier.",
  },
  {
    q: "Quels réseaux sont supportés ?",
    a: "TikTok, Instagram, YouTube, Facebook, Snapchat, LinkedIn, Twitter / X et Twitch.",
  },
  {
    q: "Comment suivre les ventes et les performances ?",
    a: "Chaque créateur a un lien unique. Chaque clic et chaque vente sont enregistrés et attribués au bon créateur. Le dashboard affiche en temps réel les ventes, la commission due et le ROI de chaque campagne.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="border-t border-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-20 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            FAQ
          </p>
          <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
            Questions fréquentes
          </h2>
        </div>

        <div className="mt-10 divide-y divide-zinc-100">
          {ITEMS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {item.q}
                <span className="shrink-0 text-zinc-400 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
