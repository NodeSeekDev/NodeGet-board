export const MAIN_COLOR = "#3e8eff";
export const SUB_COLOR = "#e46e0a";
export const LOAD15_COLOR = "#22c55e";
export const SWAP_COLOR = "#a855f7";

export const WINDOWS = [
  { label: "7天", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "1天", value: 24 * 60 * 60 * 1000 },
  { label: "12小时", value: 12 * 60 * 60 * 1000 },
  { label: "6小时", value: 6 * 60 * 60 * 1000 },
  { label: "1小时", value: 60 * 60 * 1000 },
  { label: "30分钟", value: 30 * 60 * 1000 },
  { label: "5分钟", value: 5 * 60 * 1000 },
  { label: "3分钟", value: 3 * 60 * 1000 },
  { label: "1分钟", value: 1 * 60 * 1000 },
] as const;

export const REFRESH_INTERVALS = [
  { label: "1秒", value: 1_000 },
  { label: "2秒", value: 2_000 },
  { label: "5秒", value: 5_000 },
  { label: "10秒", value: 10_000 },
  { label: "30秒", value: 30_000 },
] as const;

export type WindowOption = (typeof WINDOWS)[number];
export type RefreshOption = (typeof REFRESH_INTERVALS)[number];

// Detail sections: window <= 5min allows 1s refresh; > 5min enforces minimum 10s
export const detailMinRefresh = (windowMs: number) =>
  windowMs > 5 * 60 * 1000 ? 10_000 : 1_000;

export const detailRefreshOptions = (windowMs: number) => {
  const min = detailMinRefresh(windowMs);
  return REFRESH_INTERVALS.filter((r) => r.value >= min);
};

export const effectiveDetailRefresh = (
  windowMs: number,
  refreshInterval: number,
) => Math.max(refreshInterval, detailMinRefresh(windowMs));

// Default agent KV limits if absent
export const DEFAULT_DYNAMIC_LIMIT = 21_600_000; // 6h
export const DEFAULT_SUMMARY_LIMIT = 2_592_000_000; // 30d

export type TabId = "cpu" | "memory" | "disk" | "network";
export type DetailTab = "disk" | "network";
