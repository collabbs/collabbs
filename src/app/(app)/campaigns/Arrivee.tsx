import Link from "next/link";

/**
 * Le premier écran d'une marque qui arrive du défilé.
 *
 * ─── Pourquoi il existe ───
 * Elle vient de créer sa carte, de repérer cinq créateurs, puis de créer son
 * compte. Elle atterrissait sur une liste de campagnes, sans savoir quoi
 * faire : le geste qu'elle venait d'accomplir n'était mentionné nulle part, et
 * les créateurs qu'elle avait retenus non plus.
 *
 * On lui dit donc où elle en est et ce qui vient ensuite, dans l'ordre où ça
 * lui sert : sa campagne est en ligne, ses créateurs sont gardés, et le
 * catalogue complet est à un clic.
 *
 * ─── Ce qu'il ne fait pas ───
 * Il ne reste pas. Dès qu'une campagne est active ET que la shortlist a servi,
 * il n'a plus rien à dire — un guide qui persiste après avoir été suivi
 * devient du décor.
 */
export default function Arrivee({
  campagnesActives,
  reperes,
}: {
  campagnesActives: number;
  reperes: number;
}) {
  const etapes = [
    {
      fait: campagnesActives > 0,
      titre: campagnesActives > 0 ? "Ta campagne est en ligne" : "Publie ta campagne",
      detail:
        campagnesActives > 0
          ? "Les créateurs la voient dans leur fil."
          : "Sans campagne, les créateurs n'ont rien à quoi répondre.",
      lien: campagnesActives > 0 ? null : "/campaigns/new",
      action: "Créer ma campagne",
    },
    {
      fait: reperes > 0,
      titre: reperes > 0 ? `${reperes} créateurs gardés` : "Repère des créateurs",
      detail:
        reperes > 0
          ? "Ceux que tu as retenus en faisant défiler t'attendent dans ta shortlist."
          : "Garde ceux qui te plaisent : ils sont prévenus quand vous vous choisissez tous les deux.",
      lien: reperes > 0 ? "/shortlist" : null,
      action: "Voir ma shortlist",
    },
    {
      fait: false,
      titre: "Parcours le catalogue",
      detail: "Tous les créateurs, filtrables par niche, audience et format.",
      lien: "/creators",
      action: "Voir les créateurs",
    },
  ];

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
          Pour démarrer
        </p>
        <p className="font-display mt-1 text-[20px] font-black tracking-tight text-ink">
          Trois choses, et tu es lancée.
        </p>
      </div>

      <ul className="divide-y divide-zinc-100">
        {etapes.map((e) => (
          <li key={e.titre} className="flex items-center gap-4 px-5 py-4">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                e.fait ? "bg-emerald-100 text-emerald-700" : "bg-[#F4F1F5] text-zinc-400"
              }`}
            >
              {e.fait ? "✓" : "·"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{e.titre}</span>
              <span className="block text-[13px] leading-snug text-zinc-500">{e.detail}</span>
            </span>
            {e.lien && (
              <Link
                href={e.lien}
                className="shrink-0 rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
              >
                {e.action}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
