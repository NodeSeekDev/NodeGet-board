<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import {
  LATENCY_SEGMENTS,
  LOSS_COLOR,
} from "@/components/ping/pingLatencyConfig";

const CANVAS_HEIGHT = 16;
const HEIGHT_CAP_MS = 400;

const props = defineProps<{
  bars: Array<number | null>;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const { width: canvasWidth } = useElementSize(canvasRef);

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvasWidth.value || canvas.offsetWidth || 200;
  canvas.width = width;
  canvas.height = CANVAS_HEIGHT;
  ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

  if (props.bars.length === 0) return;

  // 有多少像素显示多少条，1px = 1 条，取最新数据
  const maxBars = Math.floor(width);
  const displayBars = props.bars.slice(-maxBars);
  if (displayBars.length === 0) return;

  const n = displayBars.length;
  for (let i = 0; i < n; i++) {
    // Math.round 分界点保证相邻 bar 无缝不重叠
    const x = Math.round((i / n) * width);
    const w = Math.round(((i + 1) / n) * width) - x;
    if (w <= 0) continue;

    const latency = displayBars[i];
    let color: string;
    let height: number;

    if (latency == null) {
      color = LOSS_COLOR;
      height = CANVAS_HEIGHT;
    } else {
      const segment =
        LATENCY_SEGMENTS.find((item) => latency < item.max) ??
        LATENCY_SEGMENTS[LATENCY_SEGMENTS.length - 1]!;
      color = segment.color;
      height = Math.min(
        CANVAS_HEIGHT,
        Math.max(1, Math.round((latency / HEIGHT_CAP_MS) * CANVAS_HEIGHT)),
      );
    }

    ctx.fillStyle = color;
    ctx.fillRect(x, CANVAS_HEIGHT - height, w, height);
  }
}

onMounted(draw);

watch(
  () => props.bars,
  () => draw(),
  { deep: true },
);
watch(canvasWidth, () => draw());
</script>

<template>
  <canvas
    ref="canvasRef"
    :height="CANVAS_HEIGHT"
    class="block h-4 w-full bg-black/4"
  />
</template>
