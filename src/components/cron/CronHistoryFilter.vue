<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, Search, RotateCcw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface FilterState {
  id: string;
  startTime: string;
  endTime: string;
  status: "all" | "success" | "failed";
  limit: number;
  latestOnly: boolean;
}

const props = defineProps<{
  modelValue: FilterState;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FilterState];
  search: [];
  reset: [];
}>();

const { t } = useI18n();

const localFilter = ref<FilterState>({ ...props.modelValue });

watch(
  () => props.modelValue,
  (val) => {
    localFilter.value = { ...val };
  },
  { deep: true },
);

const updateFilter = () => {
  emit("update:modelValue", { ...localFilter.value });
};

const handleSearch = () => {
  updateFilter();
  emit("search");
};

const handleReset = () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  localFilter.value = {
    id: "",
    startTime: formatDateTimeLocal(oneHourAgo),
    endTime: formatDateTimeLocal(now),
    status: "all",
    limit: 20,
    latestOnly: false,
  };
  updateFilter();
  emit("reset");
};

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};
</script>

<template>
  <div class="bg-card border rounded-xl shadow-sm p-5 transition-all">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="space-y-1.5">
        <label class="text-sm font-medium text-foreground/80">
          {{ t("dashboard.cron.history.recordId") }}
        </label>
        <Input
          v-model="localFilter.id"
          type="number"
          min="1"
          class="bg-background/50 h-9"
          @change="updateFilter"
        />
      </div>

      <div class="space-y-1.5">
        <label class="text-sm font-medium text-foreground/80">
          {{ t("dashboard.cron.history.filterStatus") }}
        </label>
        <Select v-model="localFilter.status" @update:model-value="updateFilter">
          <SelectTrigger class="bg-background/50 h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span class="flex items-center gap-2">
                {{ t("dashboard.cron.history.all") }}
              </span>
            </SelectItem>
            <SelectItem value="success">
              <span class="flex items-center gap-2">
                {{ t("dashboard.cron.history.success") }}
              </span>
            </SelectItem>
            <SelectItem value="failed">
              <span class="flex items-center gap-2">
                {{ t("dashboard.cron.history.failed") }}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1.5">
        <label class="text-sm font-medium text-foreground/80">
          {{ t("dashboard.cron.history.limit") }}
        </label>
        <Input
          :model-value="localFilter.limit"
          type="number"
          min="1"
          max="500"
          class="bg-background/50 h-9"
          @update:model-value="
            localFilter.limit = Math.max(1, Number($event) || 20)
          "
          @change="updateFilter"
        />
      </div>

      <div class="space-y-1.5">
        <label class="text-sm font-medium text-foreground/80">
          {{ t("dashboard.cron.history.latestOnly") }}
        </label>
        <Select
          :model-value="localFilter.latestOnly ? 'yes' : 'no'"
          @update:model-value="
            localFilter.latestOnly = $event === 'yes';
            updateFilter();
          "
        >
          <SelectTrigger class="bg-background/50 h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">{{
              t("dashboard.cron.history.disabled")
            }}</SelectItem>
            <SelectItem value="yes">{{
              t("dashboard.cron.history.enabled")
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1.5">
        <label class="text-sm font-medium text-foreground/80">
          {{ t("dashboard.cron.history.startTime") }}
        </label>
        <Input
          v-model="localFilter.startTime"
          type="datetime-local"
          class="bg-background/50 h-9"
          @change="updateFilter"
        />
      </div>

      <div class="space-y-1.5">
        <label class="text-sm font-medium text-foreground/80">
          {{ t("dashboard.cron.history.endTime") }}
        </label>
        <Input
          v-model="localFilter.endTime"
          type="datetime-local"
          class="bg-background/50 h-9"
          @change="updateFilter"
        />
      </div>

      <div
        class="sm:col-span-2 flex items-end justify-end gap-3 mt-2 sm:mt-0 w-full"
      >
        <Button
          :disabled="loading"
          @click="handleReset"
          variant="outline"
          class="flex-1 sm:flex-none h-9 px-4 transition-all hover:bg-muted"
        >
          <RotateCcw
            class="mr-2 h-4 w-4"
            :class="{ 'animate-spin': loading }"
          />
          {{ t("dashboard.cron.history.reset") }}
        </Button>
        <Button
          :disabled="loading"
          @click="handleSearch"
          class="flex-1 sm:flex-none h-9 px-6 shadow-sm transition-all hover:shadow-md active:scale-95"
        >
          <Search v-if="!loading" class="mr-2 h-4 w-4" />
          <Loader2 v-else class="mr-2 h-4 w-4 animate-spin" />
          {{ t("dashboard.cron.history.search") }}
        </Button>
      </div>
    </div>
  </div>
</template>
