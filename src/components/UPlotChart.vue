<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import Spinner from "@/components/ui/spinner/Spinner.vue";

interface UPlotChartProps {
  data: number[];
  data2?: number[];
  color: string;
  color2?: string;
  height?: number;
  maxValue?: number;
  yLabel?: string;
  showArea?: boolean;
  timestamps?: number[];
  label1?: string;
  label2?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<UPlotChartProps>(), {
  data2: () => [],
  color2: "#4ade80",
  height: 260,
  maxValue: 100,
  yLabel: "",
  showArea: false,
  timestamps: () => [],
  label1: "Value",
  label2: "Value2",
  loading: false,
});

const chartRef = ref<HTMLDivElement | null>(null);
let uplot: uPlot | null = null;
let resizeObserver: ResizeObserver | null = null;
let userZoomRange: { min: number; max: number } | null = null;
let chartIsTimeAxis: boolean | null = null;

const useTimeAxis = () => props.timestamps.length > 0;

const formatValue = (val: number): string => {
  if (props.yLabel === "%") return val.toFixed(1) + "%";
  if (props.yLabel?.includes("B/s")) return formatBytes(val) + "/s";
  return val.toString();
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

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
    minWidth: "120px",
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

        let html = "";

        if (useTimeAxis()) {
          const xVal = (u.data[0] as number[])[idx];
          if (xVal != null) {
            const d = new Date(xVal * 1000);
            const h = String(d.getHours()).padStart(2, "0");
            const m = String(d.getMinutes()).padStart(2, "0");
            const s = String(d.getSeconds()).padStart(2, "0");
            html += `<div style="color:var(--muted-foreground);margin-bottom:4px;font-size:11px">${h}:${m}:${s}</div>`;
          }
        }

        const val1 = (u.data[1] as (number | null)[])[idx];
        const valStr1 = val1 == null ? "—" : `<b>${formatValue(val1)}</b>`;
        html += `<div style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${props.color};flex-shrink:0"></span>
          <span style="color:var(--foreground)">${props.label1}: ${valStr1}</span>
        </div>`;

        if (props.data2.length > 0 && u.data[2] != null) {
          const val2 = (u.data[2] as (number | null)[])[idx];
          const valStr2 = val2 == null ? "—" : `<b>${formatValue(val2)}</b>`;
          html += `<div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${props.color2};opacity:0.7;flex-shrink:0"></span>
            <span style="color:var(--foreground);opacity:0.85">${props.label2}: ${valStr2}</span>
          </div>`;
        }

        el.innerHTML = html;
        el.style.display = "block";

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

const buildAlignedData = (): uPlot.AlignedData => {
  const xs = useTimeAxis() ? props.timestamps : props.data.map((_, i) => i);
  const data: uPlot.AlignedData = [xs, props.data];
  if (props.data2.length > 0) data.push(props.data2);
  return data;
};

const autoYRange = (u: uPlot, range: { min: number; max: number } | null) => {
  if (range) {
    const xs = u.data[0] as number[];
    const lo = range.min;
    const hi = range.max;
    let peak = 0;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i]! >= lo && xs[i]! <= hi) {
        const v1 = (u.data[1] as (number | null)[])[i];
        if (v1 != null && v1 > peak) peak = v1;
        if (u.data[2]) {
          const v2 = (u.data[2] as (number | null)[])[i];
          if (v2 != null && v2 > peak) peak = v2;
        }
      }
    }
    u.setScale("y", { min: 0, max: peak || 1 });
  } else {
    u.setScale("y", { min: 0, max: props.maxValue });
  }
};

const initChart = () => {
  if (!chartRef.value) return;

  const chartHeight = chartRef.value.clientHeight || props.height;
  const isTime = useTimeAxis();

  const opts: uPlot.Options = {
    width: chartRef.value.clientWidth,
    height: chartHeight,
    padding: [8, 12, 16, 48],
    cursor: {
      drag: { x: true, y: false },
      points: { show: false },
    },
    select: { show: true, left: 0, top: 0, width: 0, height: 0 },
    legend: { show: false },
    scales: {
      x: { time: isTime },
      y: { range: [0, props.maxValue] },
    },
    axes: [
      {
        show: true,
        stroke: "#9ca3af",
        grid: { stroke: "rgba(156,163,175,0.15)", width: 1 },
        ticks: { stroke: "rgba(156,163,175,0.15)" },
        values: isTime
          ? (_u: uPlot, vals: number[]) =>
              vals.map((v) => {
                const d = new Date(v * 1000);
                return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
              })
          : undefined,
      },
      {
        show: true,
        stroke: "#9ca3af",
        grid: { stroke: "rgba(156,163,175,0.15)", width: 1, dash: [4, 4] },
        ticks: { show: true, stroke: "rgba(156,163,175,0.15)", width: 1 },
        values: (_u: uPlot, vals: number[]) => vals.map((v) => formatValue(v)),
        size: 40,
        gap: 4,
        font: "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
    ],
    series: [
      { label: "Time" },
      {
        label: props.label1,
        stroke: props.color,
        fill: props.showArea ? props.color + "40" : undefined,
        width: 2,
        points: { show: false },
      },
    ],
    plugins: [tooltipPlugin()],
    hooks: {
      setSelect: [
        (u: uPlot) => {
          if (u.select.width > 0) {
            const min = u.posToVal(u.select.left, "x");
            const max = u.posToVal(u.select.left + u.select.width, "x");
            userZoomRange = { min, max };
            u.setScale("x", { min, max });
            autoYRange(u, userZoomRange);
          }
        },
      ],
      init: [
        (u: uPlot) => {
          u.over.addEventListener("dblclick", () => {
            userZoomRange = null;
            autoYRange(u, null);
          });
        },
      ],
    },
  };

  if (props.data2.length > 0) {
    opts.series!.push({
      label: props.label2,
      stroke: props.color2,
      fill: props.showArea ? props.color2 + "30" : undefined,
      width: 2,
      points: { show: false },
    });
  }

  chartIsTimeAxis = isTime;
  uplot = new uPlot(opts, buildAlignedData(), chartRef.value);
};

const updateChart = () => {
  if (!uplot) return;
  uplot.setData(buildAlignedData());
  if (userZoomRange) {
    uplot.setScale("x", { min: userZoomRange.min, max: userZoomRange.max });
    autoYRange(uplot, userZoomRange);
  }
};

onMounted(() => {
  nextTick(() => {
    // Only initialize if data is already available; otherwise wait for first data in the watch
    if (props.data.length > 0 || props.timestamps.length > 0) {
      initChart();
    }
    if (chartRef.value) {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry || !uplot) return;
        uplot.setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });
      resizeObserver.observe(chartRef.value);
    }
  });
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (uplot) {
    uplot.destroy();
    uplot = null;
  }
});

watch(
  () => [props.data, props.data2, props.timestamps],
  () => {
    if (!uplot) {
      // Chart not yet initialized (no data on mount), initialize now
      nextTick(() => initChart());
      return;
    }
    const isTime = useTimeAxis();
    if (isTime !== chartIsTimeAxis) {
      // Time axis mode changed, reinitialize
      uplot.destroy();
      uplot = null;
      chartIsTimeAxis = null;
      nextTick(() => initChart());
    } else {
      updateChart();
    }
  },
);

watch(
  () => props.maxValue,
  () => {
    if (uplot) uplot.setScale("y", { min: 0, max: props.maxValue });
  },
);
</script>

<template>
  <div class="relative w-full h-full">
    <div ref="chartRef" class="w-full h-full" />
    <Transition name="uplot-loading">
      <div
        v-if="props.loading"
        class="absolute inset-0 flex items-center justify-center bg-background/40"
      >
        <Spinner class="size-5 text-muted-foreground" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
:deep(.uplot) {
  font-family: inherit;
}

:deep(.u-select) {
  background: rgba(0, 0, 0, 0.08);
  border-left: 1px solid rgba(0, 0, 0, 0.2);
  border-right: 1px solid rgba(0, 0, 0, 0.2);
}

.uplot-loading-enter-active,
.uplot-loading-leave-active {
  transition: opacity 0.2s ease;
}
.uplot-loading-enter-from,
.uplot-loading-leave-to {
  opacity: 0;
}
</style>
