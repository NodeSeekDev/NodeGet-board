export const LATENCY_SEGMENTS = [
  { label: "≤50ms", min: 0, max: 50, color: "#26a91e" },
  { label: "51-100ms", min: 50, max: 100, color: "#43dd3e" },
  { label: "101-200ms", min: 100, max: 200, color: "#bef663" },
  { label: "201-250ms", min: 200, max: 250, color: "#f6ed44" },
  { label: ">250ms", min: 250, max: Infinity, color: "#f69833" },
] as const;

export const LOSS_COLOR = "#e6170f";
export const PENDING_COLOR = "#6b7280";

export function getLatencyColor(latency: number | null, loss: number): string {
  if (loss >= 100) return LOSS_COLOR;
  if (latency === null) return PENDING_COLOR;
  for (const seg of LATENCY_SEGMENTS) {
    if (latency < seg.max) return seg.color;
  }
  return LATENCY_SEGMENTS[LATENCY_SEGMENTS.length - 1].color;
}
