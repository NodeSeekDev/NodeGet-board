<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import SidebarItem, { type SidebarRoute } from "./SidebarItem.vue";

const props = defineProps<{
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const router = useRouter();

function buildMenuTree(parentPath: string): SidebarRoute[] {
  return router
    .getRoutes()
    .filter((r) => {
      if (!r.path.startsWith(parentPath + "/")) return false;
      const remaining = r.path.slice(parentPath.length + 1);
      return !remaining.includes("/");
    })
    .filter((r) => !r.meta?.hidden)
    .sort(
      (a, b) =>
        ((a.meta?.order as number) ?? 99) - ((b.meta?.order as number) ?? 99),
    )
    .map((r) => ({
      path: r.path,
      meta: r.meta,
      children: buildMenuTree(r.path),
    }));
}

const groupedRoutes = computed<[string, SidebarRoute[]][]>(() => {
  const routes = buildMenuTree("/dashboard");
  const map = new Map<string, SidebarRoute[]>();

  for (const route of routes) {
    const key = (route.meta?.group as string) ?? "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(route);
  }

  return [...map.entries()];
});
</script>

<template>
  <aside
    :class="[
      'flex flex-col border-r bg-background transition-[width] duration-200 ease-in-out shrink-0',
      props.collapsed ? 'w-16' : 'w-60',
    ]"
  >
    <!-- Logo & toggle -->
    <div
      class="flex h-14 shrink-0 items-center border-b px-3"
      :class="props.collapsed ? 'justify-center' : 'justify-between'"
    >
      <span v-if="!props.collapsed" class="text-base font-bold truncate"
        >NodeGet</span
      >
      <Button variant="ghost" size="icon" @click="emit('toggle')">
        <PanelLeftClose v-if="!props.collapsed" class="h-4 w-4" />
        <PanelLeftOpen v-else class="h-4 w-4" />
        <span class="sr-only">{{
          props.collapsed ? "展开侧边栏" : "收起侧边栏"
        }}</span>
      </Button>
    </div>

    <!-- Menu -->
    <nav class="flex-1 flex flex-col overflow-y-auto p-2 gap-y-3">
      <div v-for="([group, routes], index) in groupedRoutes" :key="group">
        <!-- 分组标签 -->
        <div
          v-if="group && !props.collapsed"
          class="px-2 pt-1 text-sm font-semibold text-muted-foreground/60 uppercase tracking-wider select-none"
        >
          {{ group }}
        </div>
        <!-- 折叠时用分隔线代替标签，第一个分组不显示 -->
        <div
          v-else-if="group && props.collapsed && index > 0"
          class="mx-2 border-t"
        />

        <div
          class="flex flex-col gap-y-0.5"
          :class="{ 'mt-1': group && !props.collapsed }"
        >
          <SidebarItem
            v-for="route in routes"
            :key="route.path"
            :route="route"
            :collapsed="props.collapsed"
            :level="0"
          />
        </div>
      </div>
    </nav>
  </aside>
</template>
