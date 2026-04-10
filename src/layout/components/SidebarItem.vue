<script setup lang="ts">
import { computed, ref } from "vue";
import type { RouteLocationRaw, RouteMeta } from "vue-router";
import { RouterLink } from "vue-router";
import { ChevronDown } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface SidebarRoute {
  path: string;
  name?: string;
  params?: Record<string, string>;
  meta?: RouteMeta;
  children?: SidebarRoute[];
}

const props = withDefaults(
  defineProps<{
    route: SidebarRoute;
    collapsed: boolean;
    isOpen: boolean;
    level?: number;
  }>(),
  {
    level: 0,
    isOpen: false,
  },
);

const hasVisibleChildren = computed(
  () => !!props.route.children && props.route.children.length > 0,
);

const isOpen = ref(props.isOpen);

const visibleChildren = computed(() =>
  (props.route.children ?? [])
    .filter((c) => !c.meta?.hidden)
    .sort(
      (a, b) =>
        ((a.meta?.order as number) ?? 99) - ((b.meta?.order as number) ?? 99),
    ),
);

const routeTo = computed<RouteLocationRaw>(() =>
  props.route.name
    ? ({
        name: props.route.name,
        params: props.route.params,
      } as RouteLocationRaw)
    : props.route.path,
);
const { t } = useI18n();

const isIconUrl = computed(() => typeof props.route.meta?.icon === "string");
</script>

<template>
  <template v-if="hasVisibleChildren">
    <Collapsible v-if="!collapsed || level > 0" v-model:open="isOpen">
      <CollapsibleTrigger as-child>
        <button
          :class="
            cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
            )
          "
        >
          <img
            v-if="isIconUrl && route.meta?.icon && level === 0"
            :src="route.meta.icon as string"
            alt=""
            class="h-4 w-4 shrink-0 rounded-sm object-contain"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <component
            :is="route.meta?.icon"
            v-else-if="route.meta?.icon && level === 0"
            class="h-4 w-4 shrink-0"
          />
          <span class="flex-1 truncate text-left">{{
            route.meta?.title ? t(route.meta.title as string) : ""
          }}</span>
          <ChevronDown
            class="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
            :class="{ '-rotate-90': !isOpen }"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="relative mt-0.5 flex flex-col gap-y-0.5 pl-6">
          <div class="absolute inset-y-1 left-5 w-px bg-border" />
          <SidebarItem
            v-for="child in visibleChildren"
            :key="child.path"
            :route="child"
            :collapsed="false"
            :level="level + 1"
            :isOpen="isOpen"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
    <div v-else class="px-2 py-1">
      <button
        class="flex w-full items-center justify-center rounded-md p-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="isOpen = !isOpen"
      >
        <img
          v-if="isIconUrl && route.meta?.icon"
          :src="route.meta.icon as string"
          alt=""
          class="h-4 w-4 rounded-sm object-contain"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
        <component
          :is="route.meta?.icon"
          v-else-if="route.meta?.icon"
          class="h-4 w-4"
        />
      </button>
    </div>
  </template>

  <template v-else>
    <Tooltip v-if="collapsed && level === 0" :delay-duration="0">
      <TooltipTrigger as-child>
        <RouterLink :to="routeTo" class="block px-2 py-1">
          <span
            class="flex items-center justify-center rounded-md p-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <img
              v-if="isIconUrl && route.meta?.icon"
              :src="route.meta.icon as string"
              class="h-4 w-4 rounded-sm object-contain"
            />
            <component
              :is="route.meta?.icon"
              v-else-if="route.meta?.icon"
              class="h-4 w-4"
            />
          </span>
        </RouterLink>
      </TooltipTrigger>
      <TooltipContent side="right">{{
        route.meta?.title ? t(route.meta.title as string) : ""
      }}</TooltipContent>
    </Tooltip>
    <RouterLink
      v-else
      :to="routeTo"
      :class="
        cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
        )
      "
      active-class="bg-accent text-accent-foreground font-medium"
    >
      <img
        v-if="isIconUrl && route.meta?.icon && level === 0"
        :src="route.meta.icon as string"
        class="h-4 w-4 shrink-0 rounded-sm object-contain"
      />
      <component
        :is="route.meta?.icon"
        v-else-if="route.meta?.icon && level === 0"
        class="h-4 w-4 shrink-0"
      />
      <span class="truncate">{{
        route.meta?.title ? t(route.meta.title as string) : ""
      }}</span>
    </RouterLink>
  </template>
</template>
