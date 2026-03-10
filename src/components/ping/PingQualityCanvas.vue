<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { LATENCY_SEGMENTS, LOSS_COLOR } from "./pingLatencyConfig";

const props = defineProps<{
  bars: Array<number | null>;
  loopCount: number;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);

function draw() {
  const el = canvas.value;
  if (!el) return;
  const ctx = el.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, 200, 20);

  const colW = Math.max(1, 200 / props.loopCount);

  for (let i = 0; i < props.bars.length; i++) {
    const lat = props.bars[i];
    const x = Math.floor(i * colW);
    const w = Math.max(1, Math.ceil(colW));
    let color: string;
    let h: number;

    if (lat === null) {
      color = LOSS_COLOR;
      h = 20;
    } else {
      const segIdx = LATENCY_SEGMENTS.findIndex((s) => lat < s.max);
      const idx = segIdx === -1 ? LATENCY_SEGMENTS.length - 1 : segIdx;
      const seg = LATENCY_SEGMENTS[idx];
      color = seg.color;
      const baseH = idx * 4;
      const rangeH =
        segIdx === -1 || seg.max === Infinity
          ? 4
          : ((lat - seg.min) / (seg.max - seg.min)) * 4;
      h = Math.min(20, Math.max(1, Math.round(baseH + rangeH)));
    }

    ctx.fillStyle = color;
    ctx.fillRect(x, 20 - h, w, h);
  }
}

onMounted(draw);
watch(() => props.bars.length, draw);
</script>

<template>
  <canvas ref="canvas" width="200" height="20" class="block" />
</template>
