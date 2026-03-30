<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  LATENCY_SEGMENTS,
  LOSS_COLOR,
} from "@/components/ping/pingLatencyConfig";

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 16;
const HEIGHT_CAP_MS = 400;
const SAMPLE_LIMIT = 200;

const props = defineProps<{
  bars: Array<number | null>;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

function draw() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (props.bars.length === 0) return;

  const visibleBars = props.bars.slice(-SAMPLE_LIMIT);
  if (visibleBars.length === 0) return;

  const colW = Math.max(1, CANVAS_WIDTH / visibleBars.length);

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

onMounted(draw);

watch(
  () => props.bars,
  () => draw(),
  { deep: true },
);
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="CANVAS_WIDTH"
    :height="CANVAS_HEIGHT"
    class="block h-4 w-[200px] bg-black/4"
  />
</template>
