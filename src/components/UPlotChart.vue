<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface UPlotChartProps {
  data: number[];
  data2?: number[];
  color: string;
  color2?: string;
  height?: number;
  maxValue?: number;
  yLabel?: string;
  showArea?: boolean;
  isTimeSeries?: boolean;
  timestamps?: number[];
}

const props = withDefaults(defineProps<UPlotChartProps>(), {
  data2: () => [],
  color2: "#4ade80",
  height: 260,
  maxValue: 100,
  yLabel: "",
  showArea: true,
  isTimeSeries: false,
  timestamps: () => [],
});

const chartRef = ref<HTMLDivElement | null>(null);
let uplot: uPlot | null = null;

const formatValue = (val: number): string => {
  if (props.yLabel === "%") {
    return val.toFixed(1) + "%";
  }
  if (props.yLabel?.includes("B/s")) {
    return formatBytes(val) + "/s";
  }
  return val.toString();
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const initChart = () => {
  if (!chartRef.value) return;

  const opts: uPlot.Options = {
    width: chartRef.value.clientWidth,
    height: props.height - 40,
    padding: [10, 10, 20, 40],
    cursor: {
      drag: {
        x: false,
        y: false,
      },
      points: {
        show: false,
      },
    },
    select: {
      show: false,
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    },
    legend: {
      show: false,
    },
    scales: {
      x: {
        time: props.isTimeSeries,
      },
      y: {
        range: [0, props.maxValue],
      },
    },
    axes: [
      {
        show: false,
      },
      {
        show: true,
        stroke: "hsl(var(--muted-foreground))",
        grid: {
          show: true,
          stroke: "hsl(var(--border) / 0.4)",
          width: 1,
          dash: [4, 4],
        },
        ticks: {
          show: true,
          stroke: "hsl(var(--border) / 0.4)",
          width: 1,
        },
        values: (u: uPlot, vals: number[]) => vals.map((v) => formatValue(v)),
        size: 40,
        gap: 4,
        font: "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
    ],
    series: [
      {
        label: "Time",
      },
      {
        label: "Value",
        stroke: props.color,
        fill: props.showArea ? props.color + "40" : undefined,
        width: 1.5,
        points: {
          show: false,
        },
      },
    ],
  };

  if (props.data2.length > 0) {
    opts.series!.push({
      label: "Value2",
      stroke: props.color2,
      fill: props.showArea ? props.color2 + "30" : undefined,
      width: 1.5,
      points: {
        show: false,
      },
    });
  }

  const data: uPlot.AlignedData = props.isTimeSeries
    ? [
        props.timestamps.length > 0
          ? props.timestamps
          : props.data.map((_, i) => i),
        props.data,
      ]
    : [props.data.map((_, i) => i), props.data];

  if (props.data2.length > 0) {
    data.push(props.data2);
  }

  uplot = new uPlot(opts, data, chartRef.value);
};

const updateChart = () => {
  if (!uplot) return;

  const data: uPlot.AlignedData = props.isTimeSeries
    ? [
        props.timestamps.length > 0
          ? props.timestamps
          : props.data.map((_, i) => i),
        props.data,
      ]
    : [props.data.map((_, i) => i), props.data];

  if (props.data2.length > 0) {
    data.push(props.data2);
  }

  uplot.setData(data);

  if (!props.isTimeSeries) {
    const maxVal =
      props.data2.length > 0
        ? Math.max(...props.data, ...props.data2, props.maxValue)
        : Math.max(...props.data, props.maxValue);
    uplot.setScale("y", { min: 0, max: maxVal });
  }
};

const handleResize = () => {
  if (!uplot || !chartRef.value) return;
  uplot.setSize({
    width: chartRef.value.clientWidth,
    height: props.height - 40,
  });
};

onMounted(() => {
  nextTick(() => {
    initChart();
    window.addEventListener("resize", handleResize);
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  if (uplot) {
    uplot.destroy();
    uplot = null;
  }
});

watch(
  () => [props.data, props.data2, props.timestamps],
  () => {
    updateChart();
  },
  { deep: true },
);

watch(
  () => props.maxValue,
  () => {
    if (uplot) {
      uplot.setScale("y", { min: 0, max: props.maxValue });
    }
  },
);
</script>

<template>
  <div ref="chartRef" class="w-full h-full" />
</template>

<style scoped>
:deep(.uplot) {
  font-family: inherit;
}

:deep(.u-select) {
  background: hsl(var(--primary) / 0.1);
}
</style>
