<script setup lang="ts">
interface Option {
  label: string;
  value: number;
}

defineProps<{
  windowMs: number;
  refreshInterval: number;
  windowOptions: ReadonlyArray<Option>;
  refreshOptions: ReadonlyArray<Option>;
  showSyncAxes?: boolean;
}>();

const emit = defineEmits<{
  changeWindow: [value: number];
  changeRefresh: [value: number];
}>();

const syncAxes = defineModel<boolean>("syncAxes");

function onWindow(e: Event) {
  emit("changeWindow", +(e.target as HTMLSelectElement).value);
}
function onRefresh(e: Event) {
  emit("changeRefresh", +(e.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="text-xs text-muted-foreground inline-flex items-center gap-1">
      最近
      <select
        :value="windowMs"
        @change="onWindow"
        class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
      >
        <option v-for="w in windowOptions" :key="w.value" :value="w.value">
          {{ w.label }}
        </option>
      </select>
    </span>
    <span class="text-xs text-muted-foreground inline-flex items-center gap-1">
      每
      <select
        :value="refreshInterval"
        @change="onRefresh"
        class="bg-card border rounded px-1.5 py-0.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
      >
        <option v-for="r in refreshOptions" :key="r.value" :value="r.value">
          {{ r.label }}
        </option>
      </select>
      更新
    </span>
    <label
      v-if="showSyncAxes"
      class="text-xs text-muted-foreground inline-flex items-center gap-1.5 cursor-pointer select-none"
    >
      <input
        type="checkbox"
        v-model="syncAxes"
        class="h-3 w-3 cursor-pointer accent-current"
      />
      同步坐标轴
    </label>
  </div>
</template>
