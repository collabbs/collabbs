/**
 * Périodes supportées par /analytics.
 * Toutes les périodes sont calculées à partir d'un "now" passé explicitement
 * (jamais Date.now() pour rester resumable côté workflows).
 */
export type PeriodId = "7d" | "30d" | "90d" | "ytd";

export const PERIOD_LABELS: Record<PeriodId, string> = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  ytd: "Depuis le 1er janvier",
};

export const ALL_PERIODS: PeriodId[] = ["7d", "30d", "90d", "ytd"];

export function parsePeriod(raw: string | undefined): PeriodId {
  if (raw === "7d" || raw === "30d" || raw === "90d" || raw === "ytd") return raw;
  return "30d";
}

/**
 * Renvoie deux intervalles : la période demandée et la période précédente
 * de même durée, pour calculer la variation %.
 */
export function periodRange(period: PeriodId, now: Date): {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
  days: number;
} {
  const end = now;
  let start: Date;
  let days: number;

  if (period === "ytd") {
    start = new Date(now.getFullYear(), 0, 1);
    days = Math.max(
      1,
      Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    );
  } else {
    days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    current: { start, end },
    previous: { start: prevStart, end: prevEnd },
    days,
  };
}

/**
 * Granularité conseillée pour les line charts : day jusqu'à 31j, sinon week.
 */
export function bucketSize(days: number): "day" | "week" {
  return days <= 31 ? "day" : "week";
}

/** YYYY-MM-DD (jour local). */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Début de semaine ISO (lundi) → YYYY-MM-DD du lundi. */
export function weekKey(d: Date): string {
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  const monday = new Date(d);
  monday.setDate(monday.getDate() - day);
  return dayKey(monday);
}

/**
 * Aligne une série de events daté en buckets par jour ou semaine.
 * Garantit que chaque bucket entre start et end est présent (valeur 0 si vide).
 */
export function bucketize(
  events: { date: Date; value: number }[],
  start: Date,
  end: Date,
  granularity: "day" | "week",
): { date: string; value: number }[] {
  const buckets = new Map<string, number>();
  // Pré-remplit tous les buckets entre start et end.
  const stepMs = (granularity === "day" ? 1 : 7) * 24 * 60 * 60 * 1000;
  const startBucketKey =
    granularity === "day" ? dayKey(start) : weekKey(start);
  const endTime = end.getTime();
  // On itère depuis le 1er bucket (clamp début) jusqu'à end.
  const cur = new Date(start);
  let safety = 200;
  while (cur.getTime() <= endTime && safety-- > 0) {
    const key = granularity === "day" ? dayKey(cur) : weekKey(cur);
    if (!buckets.has(key)) buckets.set(key, 0);
    cur.setTime(cur.getTime() + stepMs);
  }
  // Garantit le 1er bucket aussi (cas edge).
  if (!buckets.has(startBucketKey)) buckets.set(startBucketKey, 0);

  for (const ev of events) {
    if (ev.date < start || ev.date > end) continue;
    const key = granularity === "day" ? dayKey(ev.date) : weekKey(ev.date);
    buckets.set(key, (buckets.get(key) ?? 0) + ev.value);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, value]) => ({ date, value }));
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // 100% n'a pas vraiment de sens si on partait de 0
  return ((current - previous) / previous) * 100;
}
