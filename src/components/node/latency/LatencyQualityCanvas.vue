<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  LATENCY_SEGMENTS,
  LOSS_COLOR,
} from "@/components/ping/pingLatencyConfig";

const CANVAS_HEIGHT = 24;
const HEIGHT_CAP_MS = 400;

const props = defineProps<{
  bars: Array<number | null>;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const wrapperRef = ref<HTMLDivElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
let canvasWidth = 0;

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (canvasWidth <= 0) return;

  canvas.width = canvasWidth;
  canvas.height = CANVAS_HEIGHT;
  ctx.clearRect(0, 0, canvasWidth, CANVAS_HEIGHT);

  if (props.bars.length === 0) return;

  const visibleBars = props.bars.slice(-canvasWidth);
  if (visibleBars.length === 0) return;

  const colW = Math.max(1, canvasWidth / visibleBars.length);

  for (let i = 0; i < visibleBars.length; i++) {
    const latency = visibleBars[i];
    const x = Math.floor(i * colW);
    const w = Math.max(1, Math.ceil((i + 1) * colW) - x);

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

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const width = Math.max(0, Math.floor(entry.contentRect.width));
    if (width === canvasWidth) return;
    canvasWidth = width;
    draw();
  });

  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

watch(
  () => props.bars,
  () => draw(),
  { deep: true },
);
</script>

<template>
  <div ref="wrapperRef" class="w-full">
    <canvas ref="canvasRef" class="block h-6 w-full rounded-sm" />
  </div>
</template>
