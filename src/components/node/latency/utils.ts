import type { TaskQueryResult } from "@/composables/useCronHistory";

export const SERIES_COLORS = [
  "#1F77B4",
  "#FF7F0E",
  "#2CA02C",
  "#D62728",
  "#9467BD",
  "#8C564B",
  "#E377C2",
  "#7F7F7F",
  "#BCBD22",
  "#17BECF",
  "#8B0000",
  "#00BFFF",
  "#FFD700",
  "#006400",
  "#4B0082",
  "#FF6F61",
  "#20B2AA",
  "#2F4F4F",
];

export function normalizeTs(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

export type SeriesStats = {
  name: string;
  color: string;
  avg: number | null;
  jitter: number | null;
  lossRate: number;
};

export function computeStats(
  data: TaskQueryResult[],
  type: "ping" | "tcp_ping",
): SeriesStats[] {
  const cronNames = [...new Set(data.map((r) => r.cron_source ?? "未知"))];
  return cronNames
    .map((name, i) => {
      const rows = data.filter((r) => (r.cron_source ?? "未知") === name);
      const total = rows.length;
      const color = SERIES_COLORS[i % SERIES_COLORS.length]!;
      if (total === 0)
        return { name, color, avg: null, jitter: null, lossRate: 0 };

      const vals = rows
        .filter(
          (r) =>
            r.success &&
            r.task_event_result &&
            typeof r.task_event_result[type] === "number",
        )
        .map((r) => r.task_event_result![type] as number);

      const lossRate = ((total - vals.length) / total) * 100;
      if (vals.length === 0)
        return { name, color, avg: null, jitter: null, lossRate };

      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const jitter =
        vals.length >= 2
          ? vals.slice(1).reduce((s, v, i) => s + Math.abs(v - vals[i]!), 0) /
            (vals.length - 1)
          : null;

      return { name, color, avg, jitter, lossRate };
    })
    .sort((a, b) => {
      const avgA = a.avg ?? Infinity;
      const avgB = b.avg ?? Infinity;
      if (avgA !== avgB) return avgA - avgB;
      const jitterA = a.jitter ?? Infinity;
      const jitterB = b.jitter ?? Infinity;
      if (jitterA !== jitterB) return jitterA - jitterB;
      return a.lossRate - b.lossRate;
    });
}
