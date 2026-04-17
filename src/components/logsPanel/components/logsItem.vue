<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/composables/useLogs";

const props = defineProps<{
  item: LogEntry;
}>();

const isOpen = ref(false);
const { t } = useI18n();

const levelClass = computed(() => {
  const level = props.item.level.toUpperCase();
  if (level === "ERROR") return "text-red-600";
  if (level === "WARN") return "text-amber-600";
  if (level === "DEBUG") return "text-blue-600";
  if (level === "TRACE") return "text-fuchsia-600";
  return "text-emerald-600";
});

const formattedTimestamp = computed(() => {
  const date = new Date(props.item.timestamp);
  if (Number.isNaN(date.getTime())) {
    return props.item.timestamp;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
});

const formattedFields = computed(() => {
  if (Object.keys(props.item.fields).length === 0) return "";
  return JSON.stringify(props.item.fields, null, 2);
});
</script>

<template>
  <Collapsible v-model:open="isOpen">
    <div
      class="overflow-hidden rounded-md border border-border/70 bg-background/80 transition-colors hover:bg-muted/10"
    >
      <CollapsibleTrigger as-child>
        <button
          type="button"
          :class="
            isOpen
              ? 'flex w-full cursor-pointer flex-col gap-1 px-2.5 py-2 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-2.5'
              : 'flex w-full cursor-pointer flex-col gap-1 px-2.5 py-1.5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-2.5'
          "
        >
          <div class="flex min-w-0 flex-1 items-center gap-1.5">
            <component
              :is="isOpen ? ChevronDown : ChevronRight"
              class="size-3.5 shrink-0 text-muted-foreground"
            />
            <Badge
              variant="outline"
              :class="
                cn(
                  'h-5 shrink-0 rounded-sm px-1.5 font-mono text-[10px] leading-none',
                  levelClass,
                )
              "
            >
              {{ item.level }}
            </Badge>
            <Badge
              variant="secondary"
              class="h-5 max-w-28 shrink-0 rounded-sm px-1.5 font-mono text-[10px] leading-none sm:max-w-36"
            >
              {{ item.target }}
            </Badge>
            <div
              class="min-w-0 flex-1 truncate text-xs font-medium leading-[1.2rem]"
            >
              {{ item.message || "-" }}
            </div>
          </div>

          <div
            class="pl-5 font-mono text-[10px] leading-4 text-muted-foreground sm:w-auto sm:shrink-0 sm:pl-0"
          >
            {{ formattedTimestamp }}
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent
        v-if="isOpen"
        class="space-y-1.5 border-t bg-muted/10 px-2.5 pt-1.5 pb-2"
      >
        <div>
          <div class="mb-1 text-[11px] font-medium text-muted-foreground">
            {{ t("dashboard.logsPanel.details.fields") }}
          </div>
          <pre
            v-if="formattedFields"
            class="overflow-x-auto rounded-md bg-muted/70 p-1.5 text-[11px] leading-4"
            >{{ formattedFields }}</pre
          >
          <div
            v-else
            class="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground"
          >
            {{ t("common.noData") }}
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-[11px] font-medium text-muted-foreground">
            {{ t("dashboard.logsPanel.details.spans") }}
          </div>
          <template v-if="item.spans.length > 0">
            <div
              v-for="(span, index) in item.spans"
              :key="`${item.id}-span-${index}`"
              class="rounded-md border bg-background/70 px-2 py-1"
            >
              <div class="font-mono text-[11px] font-medium leading-4">
                {{ span.name || "-" }}
              </div>
              <div
                v-if="span.fields"
                class="mt-0.5 text-[11px] leading-4 text-muted-foreground"
              >
                {{ span.fields }}
              </div>
            </div>
          </template>
          <div
            v-else
            class="rounded-md border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground"
          >
            {{ t("common.noData") }}
          </div>
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
