<script setup lang="ts">
import { useDraggable } from "@vueuse/core";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSystemSettingsStore } from "@/stores/systemSettings";
import { registerRpcDebugEventHandler } from "./rpcDebugStore";
import RpcDebugPanel from "./RpcDebugPanel.vue";
import Button from "@/components/ui/button/Button.vue";

const DRAG_THRESHOLD_PX = 4;
const FLOATING_BUTTON_MARGIN_PX = 8;

const systemSettingsStore = useSystemSettingsStore();
const open = ref(false);
const buttonRef = ref<HTMLButtonElement | null>(null);
const hasButtonPosition = ref(false);
const suppressNextClick = ref(false);
let suppressClickTimer: number | undefined;
let unregisterDebugEvents: (() => void) | undefined;
let dragStartPoint: { x: number; y: number } | undefined;
let dragMoved = false;

const enabled = computed(() => systemSettingsStore.config.rpcDebugPanelEnabled);

const { position: buttonPosition, isDragging } = useDraggable(buttonRef, {
  buttons: [0],
  initialValue: { x: 0, y: 0 },
  onStart: handleFloatingButtonDragStart,
  onMove: handleFloatingButtonDragMove,
  onEnd: handleFloatingButtonDragEnd,
});

const floatingButtonStyle = computed(() => {
  if (!hasButtonPosition.value) {
    return {
      right: "1.25rem",
      bottom: "1.25rem",
    };
  }

  return {
    left: `${buttonPosition.value.x}px`,
    top: `${buttonPosition.value.y}px`,
  };
});

watch(enabled, (nextEnabled) => {
  if (!nextEnabled) {
    open.value = false;
    resetDragTracking();
    return;
  }

  nextTick(() => syncFloatingButtonPosition());
});

onMounted(() => {
  syncFloatingButtonPosition();
  window.addEventListener("resize", handleWindowResize);
  unregisterDebugEvents = registerRpcDebugEventHandler();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleWindowResize);
  unregisterDebugEvents?.();
  if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
});

function toggleOpen() {
  if (!enabled.value) return;
  open.value = !open.value;
}

function handleFloatingButtonDragStart(
  _position: { x: number; y: number },
  event: PointerEvent,
) {
  if (!enabled.value) return false;
  if (event.pointerType === "mouse" && event.button !== 0) return false;

  syncFloatingButtonPosition();
  dragStartPoint = { x: event.clientX, y: event.clientY };
  dragMoved = false;
}

function handleFloatingButtonDragMove(
  position: { x: number; y: number },
  event: PointerEvent,
) {
  if (dragStartPoint) {
    const deltaX = event.clientX - dragStartPoint.x;
    const deltaY = event.clientY - dragStartPoint.y;

    if (!dragMoved && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
      dragMoved = true;
    }
  }

  setFloatingButtonPosition(position);
}

function handleFloatingButtonDragEnd(position: { x: number; y: number }) {
  const wasDragged = dragMoved;
  setFloatingButtonPosition(position);
  resetDragTracking();
  if (wasDragged) suppressClickTemporarily();
}

function handleFloatingButtonClick(event: MouseEvent) {
  if (suppressNextClick.value) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick.value = false;
    return;
  }

  toggleOpen();
}

function handleWindowResize() {
  if (!hasButtonPosition.value) return;
  setFloatingButtonPosition(buttonPosition.value);
}

function syncFloatingButtonPosition() {
  const element = buttonRef.value;
  if (!element) return;

  const rect = element.getBoundingClientRect();
  setFloatingButtonPosition(
    hasButtonPosition.value
      ? buttonPosition.value
      : {
          x: rect.left,
          y: rect.top,
        },
  );
}

function setFloatingButtonPosition(position: { x: number; y: number }) {
  buttonPosition.value = constrainFloatingButtonPosition(position);
  hasButtonPosition.value = true;
}

function constrainFloatingButtonPosition(position: { x: number; y: number }) {
  const element = buttonRef.value;
  const width = element?.offsetWidth ?? 72;
  const height = element?.offsetHeight ?? 44;
  const maxX = Math.max(
    FLOATING_BUTTON_MARGIN_PX,
    window.innerWidth - width - FLOATING_BUTTON_MARGIN_PX,
  );
  const maxY = Math.max(
    FLOATING_BUTTON_MARGIN_PX,
    window.innerHeight - height - FLOATING_BUTTON_MARGIN_PX,
  );

  return {
    x: clamp(position.x, FLOATING_BUTTON_MARGIN_PX, maxX),
    y: clamp(position.y, FLOATING_BUTTON_MARGIN_PX, maxY),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resetDragTracking() {
  dragStartPoint = undefined;
  dragMoved = false;
}

function suppressClickTemporarily() {
  suppressNextClick.value = true;
  if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
  suppressClickTimer = window.setTimeout(() => {
    suppressNextClick.value = false;
    suppressClickTimer = undefined;
  }, 250);
}
</script>

<template>
  <button
    v-if="enabled"
    v-show="!open"
    ref="buttonRef"
    type="button"
    class="fixed z-60 inline-flex h-11 touch-none items-center gap-2 rounded-full border bg-background/95 px-4 text-sm font-medium shadow-lg backdrop-blur transition select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
    :style="floatingButtonStyle"
    :aria-expanded="open"
    aria-controls="rpc-debug-panel-dialog"
    title="RPC 调试面板"
    @click="handleFloatingButtonClick"
  >
    <span
      class="h-2.5 w-2.5 rounded-full"
      :class="open ? 'bg-emerald-500' : 'bg-primary'"
    />
    RPC
  </button>

  <Dialog :open="open" @update:open="open = $event">
    <DialogContent
      id="rpc-debug-panel-dialog"
      class="flex h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] w-[calc(100vw-3rem)] max-w-[calc(100vw-3rem)] flex-col gap-3 overflow-hidden p-3 sm:max-w-[calc(100vw-3rem)] md:h-[calc(100vh-4rem)] md:max-h-[calc(100vh-4rem)] md:w-[calc(100vw-4rem)] md:max-w-[calc(100vw-4rem)] md:p-4"
      :show-close-button="false"
    >
      <DialogHeader
        class="flex flex-none flex-row items-center justify-between gap-3 space-y-0"
      >
        <div class="min-w-0">
          <DialogTitle class="text-sm">RPC 调试面板</DialogTitle>
          <DialogDescription class="text-xs">
            点击遮罩或按 Esc 关闭
          </DialogDescription>
        </div>
        <Button
          variant="destructive"
          class="inline-flex h-8 items-center rounded-md border px-3 text-sm transition hover:bg-muted"
          @click="open = false"
        >
          关闭
        </Button>
      </DialogHeader>

      <RpcDebugPanel />
    </DialogContent>
  </Dialog>
</template>
