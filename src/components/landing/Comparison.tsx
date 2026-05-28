type Cell = true | false | string;

const COLUMNS = ["Collabbs", "AdSense", "Agence influence", "Démarchage direct"];

const ROWS: { feature: string; vals: Cell[] }[] = [
  { feature: "Lien d'affiliation en 1 clic", vals: [true, false, false, false] },
  { feature: "Commissions selon les abonnés", vals: [true, false, false, false] },
  { feature: "Contrat automatique en 5s", vals: [true, false, false, false] },
  { feature: "Paiement garanti (escrow)", vals: [true, false, "Partiel", false] },
  { feature: "0% de commission créateur", vals: [true, false, false, false] },
  { feature: "Suivi des ventes en temps réel", vals: [true, "Partiel", false, false] },
  { feature: "Programme d'affiliation massif", vals: [true, false, false, false] },
  { feature: "Deals vidéo + affiliation combinés", vals: [true, false, false, false] },
];

function Mark({ value }: { value: Cell }) {
  if (value === true)
    return <span className="text-lg font-bold text-emerald-500">✓</span>;
  if (value === false) return <span className="text-zinc-300">—</span>;
  return <span className="text-xs font-semibold text-amber-500">{value}</span>;
}

export default function Comparison() {
  return (
    <section className="border-t border-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            Comparatif
          </p>
          <h2 className="mt-2 font-display text-4xl font-black tracking-tight text-ink sm:text-5xl">
            Comparé à ce qui existe déjà
          </h2>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-2/5 p-3" />
                {COLUMNS.map((col, i) => (
                  <th
                    key={col}
                    className={`p-3 text-center text-sm font-bold ${
                      i === 0
                        ? "rounded-t-xl bg-purple-50 text-brand-deep"
                        : "text-zinc-500"
                    }`}
                  >
                    {i === 0 ? (
                      <span className="font-display">Collabbs ✦</span>
                    ) : (
                      col
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <tr key={row.feature}>
                  <td className="border-b border-zinc-100 p-3 text-sm font-medium text-zinc-700">
                    {row.feature}
                  </td>
                  {row.vals.map((v, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-zinc-100 p-3 text-center ${
                        ci === 0 ? "bg-purple-50/60" : ""
                      } ${ri === ROWS.length - 1 && ci === 0 ? "rounded-b-xl" : ""}`}
                    >
                      <Mark value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
