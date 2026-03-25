<script setup lang="ts">
import { shallowRef, onMounted, onUnmounted, watch } from "vue";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { TaskQueryResult } from "@/composables/useCronHistory";

const props = withDefaults(
  defineProps<{
    data: TaskQueryResult[];
    type: "ping" | "tcp_ping";
    peakCut?: boolean;
    visibleSeries?: boolean[];
  }>(),
  { peakCut: true },
);

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function normalizeTs(ts: number): number {
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
}

/** 构建 uPlot 对齐数据 */
function buildData(): {
  cronNames: string[];
  aligned: uPlot.AlignedData;
  timeoutFlags: boolean[][];
} {
  const cronNames = [
    ...new Set(props.data.map((r) => r.cron_source ?? "未知")),
  ];

  // 对齐到 30s bucket，消除不同 cron 任务执行时间偏差导致的折线断裂
  const BUCKET_S = 30;
  const snapBucket = (tsSeconds: number) =>
    Math.floor(tsSeconds / BUCKET_S) * BUCKET_S;

  const tsSet = new Set<number>();
  for (const r of props.data)
    tsSet.add(snapBucket(Math.floor(normalizeTs(r.timestamp) / 1000)));
  const xs = [...tsSet].sort((a, b) => a - b);

  const PEAK_CAP = 500;

  const ysAndFlags = cronNames.map((name) => {
    const valMap = new Map<number, number | null>();
    const flagMap = new Map<number, boolean>();
    for (const r of props.data) {
      if ((r.cron_source ?? "未知") !== name) continue;
      const t = snapBucket(Math.floor(normalizeTs(r.timestamp) / 1000));
      const isTimeout =
        !r.success ||
        !r.task_event_result ||
        typeof r.task_event_result[props.type] !== "number";
      flagMap.set(t, isTimeout);
      let v: number | null;
      if (isTimeout) {
        v = props.peakCut ? PEAK_CAP : null;
      } else {
        const raw = r.task_event_result[props.type] as number;
        v = props.peakCut ? Math.min(raw, PEAK_CAP) : raw;
      }
      valMap.set(t, v);
    }
    return {
      vals: xs.map((t) => valMap.get(t) ?? null),
      flags: xs.map((t) => flagMap.get(t) ?? false),
    };
  });

  return {
    cronNames,
    aligned: [xs, ...ysAndFlags.map((r) => r.vals)] as uPlot.AlignedData,
    timeoutFlags: ysAndFlags.map((r) => r.flags),
  };
}

/** 悬浮 tooltip plugin */
function tooltipPlugin(): uPlot.Plugin {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute",
    pointerEvents: "none",
    display: "none",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    padding: "8px 10px",
    fontSize: "12px",
    lineHeight: "1.6",
    zIndex: "20",
    boxShadow: "0 4px 12px rgba(0,0,0,.12)",
    minWidth: "130px",
    whiteSpace: "nowrap",
  });

  return {
    hooks: {
      init(u: uPlot) {
        u.over.appendChild(el);
      },
      setCursor(u: uPlot) {
        const { left, top, idx } = u.cursor;
        if (idx == null || left == null || top == null || left < 0) {
          el.style.display = "none";
          return;
        }

        const xVal = (u.data[0] as number[])[idx];
        if (xVal == null) {
          el.style.display = "none";
          return;
        }

        const d = new Date(xVal * 1000);
        const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

        let html = `<div style="color:var(--muted-foreground);margin-bottom:4px;font-size:11px">${timeStr}</div>`;
        for (let i = 1; i < u.series.length; i++) {
          const series = u.series[i];
          if (!series) continue;
          const val = (u.data[i] as (number | null)[])[idx];
          const color = COLORS[(i - 1) % COLORS.length];
          const isTimeout = currentTimeoutFlags[i - 1]?.[idx] ?? false;
          const valStr = isTimeout
            ? `<span style="color:#ef4444;font-weight:600">超时</span>`
            : val == null
              ? "—"
              : `${val.toFixed(2)} ms`;
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
            <span style="color:var(--foreground)">${series.label}: <b>${valStr}</b></span>
          </div>`;
        }
        el.innerHTML = html;
        el.style.display = "block";

        // 边界检测，避免溢出右侧或底部
        const ow = u.over.clientWidth;
        const oh = u.over.clientHeight;
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        const x = left + tw + 16 > ow ? left - tw - 14 : left + 14;
        const y = Math.min(Math.max(top - th / 2, 0), oh - th);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      },
    },
  };
}

function makeOpts(
  width: number,
  height: number,
  cronNames: string[],
): uPlot.Options {
  return {
    width,
    height,
    padding: [8, 12, 0, 0],
    series: [
      {},
      ...cronNames.map((name, i) => ({
        label: name,
        stroke: COLORS[i % COLORS.length],
        width: 2,
        spanGaps: false,
        points: { show: false },
      })),
    ],
    axes: [
      {
        stroke: "#9ca3af",
        grid: { stroke: "rgba(156,163,175,0.15)", width: 1 },
        ticks: { stroke: "rgba(156,163,175,0.15)" },
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => {
            const d = new Date(v * 1000);
            return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
          }),
      },
      {
        label: "ms",
        labelGap: 4,
        stroke: "#9ca3af",
        grid: { stroke: "rgba(156,163,175,0.15)", width: 1 },
        ticks: { stroke: "rgba(156,163,175,0.15)" },
        values: (_u: uPlot, vals: (number | null)[]) =>
          vals.map((v) => (v == null ? "" : String(Math.round(v)))),
        size: 52,
      },
    ],
    scales: {
      x: { time: true },
      y: { auto: true },
    },
    legend: { show: false },
    plugins: [tooltipPlugin()],
  };
}

const containerRef = shallowRef<HTMLDivElement | null>(null);
const currentCronNames = shallowRef<string[]>([]);
let chart: uPlot | null = null;
let resizeObserver: ResizeObserver | null = null;
let currentTimeoutFlags: boolean[][] = [];

function destroy() {
  chart?.destroy();
  chart = null;
}

function applyVisibility() {
  if (!chart || !props.visibleSeries) return;
  props.visibleSeries.forEach((show, i) => {
    chart!.setSeries(i + 1, { show });
  });
}

function build(width: number, height: number) {
  if (!containerRef.value || width <= 0 || height <= 0) return;
  destroy();
  const { cronNames, aligned, timeoutFlags } = buildData();
  currentCronNames.value = cronNames;
  currentTimeoutFlags = timeoutFlags;
  chart = new uPlot(
    makeOpts(width, height, cronNames),
    aligned,
    containerRef.value,
  );
  applyVisibility();
}

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width, height } = entry.contentRect;
    if (!chart) {
      build(width, height);
    } else {
      chart.setSize({ width, height });
    }
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  destroy();
});

watch(
  () => props.visibleSeries,
  () => applyVisibility(),
  { deep: true },
);

watch(
  () => [props.data, props.type, props.peakCut] as const,
  () => {
    if (!containerRef.value) return;
    const { cronNames, aligned, timeoutFlags } = buildData();

    if (
      chart &&
      cronNames.length === currentCronNames.value.length &&
      cronNames.every((n, i) => n === currentCronNames.value[i])
    ) {
      currentTimeoutFlags = timeoutFlags;
      applyVisibility();
      const xs = aligned[0] as number[];
      const dataMin = xs.length ? (xs[0] ?? null) : null;
      const dataMax = xs.length ? (xs[xs.length - 1] ?? null) : null;
      const savedMin = chart.scales["x"]?.min ?? null;
      const savedMax = chart.scales["x"]?.max ?? null;
      const isZoomed =
        savedMin != null &&
        savedMax != null &&
        dataMin != null &&
        dataMax != null &&
        (savedMin !== dataMin || savedMax !== dataMax);

      chart.setData(aligned);

      if (isZoomed) {
        chart.setScale("x", { min: savedMin, max: savedMax });
      }
    } else {
      const { width, height } = containerRef.value.getBoundingClientRect();
      build(width, height);
    }
  },
);
</script>

<template>
  <div ref="containerRef" class="w-full h-full overflow-hidden" />
</template>
