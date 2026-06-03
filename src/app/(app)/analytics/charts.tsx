"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

const eur = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR")}€`;

/* ============ KpiTrend ============ */

export function KpiTrend({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "default",
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number | null;
  icon: string;
  tone?: "default" | "brand" | "emerald" | "amber";
  prefix?: string;
  suffix?: string;
}) {
  const tones: Record<NonNullable<"default" | "brand" | "emerald" | "amber">, string> = {
    default: "from-zinc-50 to-zinc-100 text-zinc-600",
    brand: "from-purple-50 to-pink-50 text-purple-700",
    emerald: "from-emerald-50 to-teal-50 text-emerald-700",
    amber: "from-amber-50 to-orange-50 text-amber-700",
  };
  const deltaTone =
    delta === null || delta === undefined
      ? "bg-zinc-100 text-zinc-500"
      : delta >= 0
        ? "bg-emerald-50 text-emerald-700"
        : "bg-red-50 text-red-700";
  const deltaArrow =
    delta === null || delta === undefined
      ? "—"
      : delta >= 0
        ? "↗"
        : "↘";

  const displayed =
    typeof value === "number" ? `${prefix}${Math.round(value).toLocaleString("fr-FR")}${suffix}` : value;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]} text-lg`}
        >
          {icon}
        </span>
        {delta !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${deltaTone}`}
            title={
              delta === null
                ? "Pas de période précédente"
                : `vs période précédente : ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`
            }
          >
            {deltaArrow} {delta === null ? "—" : `${Math.abs(delta).toFixed(0)}%`}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-black tracking-tight text-ink">
        {displayed}
      </p>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

/* ============ AreaChart revenu / clics ============ */

export function RevenueChart({
  data,
  color = "#7c3aed",
  format = "eur",
}: {
  data: { date: string; value: number }[];
  color?: string;
  format?: "eur" | "int";
}) {
  const id = `gradient-${color.replace("#", "")}`;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => {
              // YYYY-MM-DD → DD/MM
              const [, m, d] = v.split("-");
              return `${d}/${m}`;
            }}
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) =>
              format === "eur"
                ? v >= 1000
                  ? `${(v / 1000).toFixed(1)}k`
                  : String(Math.round(v))
                : String(Math.round(v))
            }
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #f4f4f5",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#71717a", fontWeight: 600 }}
            formatter={(v) => {
              const n = Number(v ?? 0);
              return [
                format === "eur" ? eur(n) : Math.round(n).toLocaleString("fr-FR"),
                "",
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${id})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============ BarChart horizontal pour Top X ============ */

export function TopList({
  items,
  format = "eur",
}: {
  items: { name: string; value: number; subtitle?: string }[];
  format?: "eur" | "int";
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm italic text-zinc-400">
        Pas encore assez de données.
      </p>
    );
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="space-y-3">
      {items.map((it, idx) => {
        const pct = (it.value / max) * 100;
        return (
          <li key={`${it.name}-${idx}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-500">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{it.name}</span>
                  {it.subtitle && (
                    <span className="block truncate text-xs text-zinc-500">
                      {it.subtitle}
                    </span>
                  )}
                </span>
              </p>
              <span className="shrink-0 font-display text-sm font-black text-ink">
                {format === "eur" ? eur(it.value) : Math.round(it.value).toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ============ Funnel (clics → ventes → CA → commission) ============ */

export function FunnelStages({
  stages,
}: {
  stages: { label: string; value: number; format?: "eur" | "int" }[];
}) {
  if (stages.every((s) => s.value === 0)) {
    return (
      <p className="text-sm italic text-zinc-400">
        Pas encore d&apos;activité affiliation.
      </p>
    );
  }
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className="space-y-2">
      {stages.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? stages[i - 1].value : null;
        const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-ink">
                {s.label}
                {conv !== null && (
                  <span className="ml-2 text-xs font-normal text-zinc-400">
                    ({conv.toFixed(1)}% du précédent)
                  </span>
                )}
              </p>
              <span className="font-display text-base font-black text-ink">
                {s.format === "eur"
                  ? eur(s.value)
                  : Math.round(s.value).toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="mt-1 h-6 overflow-hidden rounded-md bg-zinc-50">
              <div
                className="flex h-full items-center justify-end rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-2 text-[10px] font-semibold text-white"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============ BarChart compact pour distribution / breakdown ============ */

export function DistributionBars({
  data,
  format = "eur",
}: {
  data: { name: string; value: number; color?: string }[];
  format?: "eur" | "int";
}) {
  if (data.every((d) => d.value === 0)) {
    return (
      <p className="text-sm italic text-zinc-400">
        Pas encore assez de données.
      </p>
    );
  }
  const palette = ["#7c3aed", "#ec4899", "#06b6d4", "#f59e0b", "#10b981"];
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) =>
              format === "eur"
                ? v >= 1000
                  ? `${(v / 1000).toFixed(1)}k`
                  : String(Math.round(v))
                : String(Math.round(v))
            }
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #f4f4f5",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
              fontSize: 12,
            }}
            formatter={(v) => {
              const n = Number(v ?? 0);
              return [
                format === "eur" ? eur(n) : Math.round(n).toLocaleString("fr-FR"),
                "",
              ];
            }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? palette[i % palette.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
