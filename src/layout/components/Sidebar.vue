<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ArrowLeft,
  Radar,
  Terminal,
  Settings,
  Antenna,
  CloudDownload,
  ArrowUpDown,
  Monitor,
  BrickWallFire,
  Package,
  ChartNoAxesGantt,
  HardDrive,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import SidebarItem, { type SidebarRoute } from "./SidebarItem.vue";

const props = defineProps<{
  collapsed: boolean;
  isMobileSidebarOpen?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  closeMobile: [];
}>();

const router = useRouter();
const route = useRoute();

watch(
  () => route.path,
  () => {
    emit("closeMobile");
  },
);

const isNodeRoute = computed(() => route.path.startsWith("/dashboard/node/"));
const nodeUuid = computed(() => {
  if (isNodeRoute.value) {
    const parts = route.path.split("/");
    return parts[3] || "";
  }
  return "";
});

const nodeRoutes = computed<SidebarRoute[]>(() => {
  if (!nodeUuid.value) return [];
  return [
    {
      path: "/dashboard/overview",
      name: "/dashboard/overview",
      meta: {
        title: "router.node.backToServers",
        icon: ArrowLeft,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/status`,
      name: "/dashboard/node/[uuid]/status",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.status",
        icon: Monitor,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/latency`,
      name: "/dashboard/node/[uuid]/latency",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.latency",
        icon: Antenna,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/traffic`,
      name: "/dashboard/node/[uuid]/traffic",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.traffic",
        icon: ArrowUpDown,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/ping`,
      name: "/dashboard/node/[uuid]/ping",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.ping",
        icon: Radar,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/webshell`,
      name: "/dashboard/node/[uuid]/webshell",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.webshell",
        icon: Terminal,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/files`,
      name: "/dashboard/node/[uuid]/files",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.files",
        icon: HardDrive,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/docker`,
      name: "/dashboard/node/[uuid]/docker",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.docker",
        icon: Package,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/firewall`,
      name: "/dashboard/node/[uuid]/firewall",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.firewall",
        icon: BrickWallFire,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/process`,
      name: "/dashboard/node/[uuid]/process",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.process",
        icon: ChartNoAxesGantt,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/update`,
      name: "/dashboard/node/[uuid]/update",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.update",
        icon: CloudDownload,
      },
    },
    {
      path: `/dashboard/node/${nodeUuid.value}/setting`,
      name: "/dashboard/node/[uuid]/setting",
      params: { uuid: nodeUuid.value },
      meta: {
        title: "router.node.setting",
        icon: Settings,
      },
    },
  ];
});

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
      name: typeof r.name === "string" ? r.name : undefined,
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
      'flex flex-col border-r bg-background transition-all duration-300 ease-in-out shrink-0 z-50',
      'fixed inset-y-0 left-0 h-full md:relative',
      props.isMobileSidebarOpen
        ? 'translate-x-0 shadow-lg md:shadow-none'
        : '-translate-x-full md:translate-x-0',
      props.collapsed ? 'md:w-16 w-60' : 'w-60',
    ]"
  >
    <div
      class="flex h-14 shrink-0 items-center border-b px-3"
      :class="
        props.collapsed
          ? 'md:justify-center justify-between'
          : 'justify-between'
      "
    >
      <span
        class="text-base font-bold truncate block"
        :class="props.collapsed ? 'md:hidden' : ''"
        >NodeGet</span
      >
      <Button
        variant="ghost"
        size="icon"
        @click="emit('toggle')"
        class="hidden md:flex"
      >
        <PanelLeftClose v-if="!props.collapsed" class="h-4 w-4" />
        <PanelLeftOpen v-else class="h-4 w-4" />
        <span class="sr-only">{{
          props.collapsed
            ? $t("common.expandSidebar")
            : $t("common.collapseSidebar")
        }}</span>
      </Button>
      <!-- Mobile Close Button -->
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 md:hidden"
        v-if="props.isMobileSidebarOpen"
        @click="emit('closeMobile')"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>

    <nav class="flex-1 flex flex-col overflow-y-auto p-2 gap-y-3">
      <div v-if="isNodeRoute">
        <div class="flex flex-col gap-y-0.5 mt-1">
          <div :class="props.collapsed ? 'md:hidden contents' : 'contents'">
            <SidebarItem
              v-for="item in nodeRoutes"
              :key="item.path + '-full'"
              :route="item"
              :collapsed="false"
              :is-open="!route.meta?.isClosed"
              :level="0"
            />
          </div>
          <div :class="props.collapsed ? 'hidden md:contents' : 'hidden'">
            <SidebarItem
              v-for="item in nodeRoutes"
              :key="item.path + '-collapsed'"
              :route="item"
              :collapsed="true"
              :is-open="!route.meta?.isClosed"
              :level="0"
            />
          </div>
        </div>
      </div>
      <div
        v-else
        v-for="([group, routes], index) in groupedRoutes"
        :key="group"
      >
        <div
          v-if="group"
          class="px-2 pt-1 text-sm font-semibold text-muted-foreground/60 uppercase tracking-wider select-none"
          :class="props.collapsed ? 'md:hidden' : ''"
        >
          {{ $t(group) }}
        </div>
        <div
          v-if="group && index > 0"
          class="mx-2 border-t hidden"
          :class="props.collapsed ? 'md:block' : ''"
        />

        <div
          class="flex flex-col gap-y-0.5"
          :class="{ 'mt-1': group && !props.collapsed }"
        >
          <div :class="props.collapsed ? 'md:hidden contents' : 'contents'">
            <SidebarItem
              v-for="route in routes"
              :key="route.path + '-full'"
              :route="route"
              :collapsed="false"
              :is-open="!route.meta?.isClosed"
              :level="0"
            />
          </div>
          <div :class="props.collapsed ? 'hidden md:contents' : 'hidden'">
            <SidebarItem
              v-for="route in routes"
              :key="route.path + '-collapsed'"
              :route="route"
              :collapsed="true"
              :is-open="!route.meta?.isClosed"
              :level="0"
            />
          </div>
        </div>
      </div>
    </nav>
  </aside>
</template>
