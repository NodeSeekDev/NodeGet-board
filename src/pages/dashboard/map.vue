<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Earth } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import FlatWorldMap from "@/components/map/FlatWorldMap.vue";
import Globe3DMap from "@/components/map/Globe3DMap.vue";
import { getDisplayCountryName } from "@/components/map/countryName";
import { useOverviewData } from "@/composables/useOverviewData";
import { REGION_COORDS } from "@/data/mapRegionCoords";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

definePage({
  meta: {
    title: "router.map",
    icon: Earth,
    order: 8,
    group: "router.group.monitor",
  },
});

const { t, locale } = useI18n();
const activeView = ref("flat");
const showUserLinks = ref(false);
const showUnlockedCountries = ref(false);
const selectedNodeId = ref<string | null>(null);
const { servers, loading, error, start, stop } = useOverviewData();
const userLocation = ref<{
  name: string;
  value: [number, number, number];
} | null>(null);
const locationStatus = ref<
  "idle" | "loading" | "success" | "unavailable" | "denied"
>("idle");
const displayedUserLocation = computed(() => {
  if (!showUserLinks.value || !userLocation.value) return null;
  return {
    name: userLocation.value.name,
    value: [...userLocation.value.value] as [number, number, number],
  };
});
const locationStatusText = computed(() => {
  if (!showUserLinks.value) return "";
  if (locationStatus.value === "loading")
    return t("dashboard.map.locationStatus.loading");
  if (locationStatus.value === "success")
    return t("dashboard.map.locationStatus.success");
  if (locationStatus.value === "unavailable")
    return t("dashboard.map.locationStatus.unavailable");
  if (locationStatus.value === "denied")
    return t("dashboard.map.locationStatus.denied");
  return "";
});
let locationWatchId: number | null = null;
const regionDisplayNames =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
const regionNameFallback: Record<string, string> = {
  HK: "Hong Kong",
  MO: "Macao",
  TW: "Taiwan",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  ID: "Indonesia",
  IN: "India",
  US: "United States of America",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  RU: "Russia",
  TR: "Turkey",
  AU: "Australia",
  ZA: "South Africa",
};

function getCountryNameFromRegion(region?: string) {
  if (!region) return null;
  const normalized = region.trim().toUpperCase();
  if (!normalized) return null;
  return (
    regionNameFallback[normalized] ?? regionDisplayNames?.of(normalized) ?? null
  );
}

function stopUserLocationWatch() {
  if (
    locationWatchId !== null &&
    typeof navigator !== "undefined" &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(locationWatchId);
  }
  locationWatchId = null;
}

function startUserLocationWatch() {
  if (
    typeof navigator === "undefined" ||
    !navigator.geolocation ||
    locationWatchId !== null
  ) {
    locationStatus.value = "unavailable";
    return;
  }

  locationStatus.value = "loading";

  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      userLocation.value = {
        name: t("dashboard.map.myLocation"),
        value: [position.coords.longitude, position.coords.latitude, 1],
      };
      locationStatus.value = "success";
    },
    (geoError) => {
      userLocation.value = null;
      locationStatus.value =
        geoError.code === geoError.PERMISSION_DENIED ? "denied" : "unavailable";
      stopUserLocationWatch();
    },
    {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000,
    },
  );
}

onMounted(() => {
  start();
});

onUnmounted(() => {
  stop();
  stopUserLocationWatch();
});

watch(showUserLinks, (enabled) => {
  if (enabled) {
    startUserLocationWatch();
  } else {
    stopUserLocationWatch();
    locationStatus.value = "idle";
  }
});

const visibleServers = computed(() =>
  servers.value.filter((server) => !server.hidden),
);

const nodeList = computed(() => {
  const coordGroupCount = new Map<string, number>();
  const coordGroupIndex = new Map<string, number>();
  const baseNodes = visibleServers.value
    .map((server) => {
      const hasCustomCoord =
        Number.isFinite(server.longitude) && Number.isFinite(server.latitude);
      const regionMeta = server.region
        ? REGION_COORDS[server.region]
        : undefined;
      const coord: [number, number] | null = hasCustomCoord
        ? [server.longitude as number, server.latitude as number]
        : (regionMeta?.coord ?? null);

      if (!coord) return null;

      const coordKey = `${coord[0]},${coord[1]}`;
      coordGroupCount.set(coordKey, (coordGroupCount.get(coordKey) ?? 0) + 1);

      return {
        id: server.uuid,
        nodeName: server.customName || server.uuid.slice(0, 8),
        countryName: getCountryNameFromRegion(server.region),
        region:
          (getCountryNameFromRegion(server.region)
            ? getDisplayCountryName(
                getCountryNameFromRegion(server.region)!,
                locale.value,
              )
            : null) ||
          regionMeta?.name ||
          server.region ||
          t("dashboard.map.unknownRegion"),
        coord,
        coordKey,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return baseNodes
    .map((node) => {
      const index = coordGroupIndex.get(node.coordKey) ?? 0;
      coordGroupIndex.set(node.coordKey, index + 1);
      const total = coordGroupCount.get(node.coordKey) ?? 1;
      const angle = total > 1 ? (Math.PI * 2 * index) / total : 0;
      const distance = total > 1 ? 0.9 : 0;
      const longitudeOffset = Math.cos(angle) * distance;
      const latitudeOffset = Math.sin(angle) * distance * 0.55;

      return {
        id: node.id,
        name: node.nodeName,
        region: node.region,
        countryName: node.countryName,
        count: 1,
        nodes: [node.nodeName],
        value: [
          node.coord[0] + longitudeOffset,
          node.coord[1] + latitudeOffset,
          1,
        ] as [number, number, number],
      };
    })
    .sort((a, b) =>
      `${a.region}-${a.name}`.localeCompare(`${b.region}-${b.name}`, "zh-CN"),
    );
});

const selectedNode = computed(
  () => nodeList.value.find((node) => node.id === selectedNodeId.value) ?? null,
);

const unlockedCountries = computed(() => {
  if (!showUnlockedCountries.value) return [];
  return Array.from(
    new Set(
      visibleServers.value
        .map((server) => getCountryNameFromRegion(server.region))
        .filter((country): country is string => Boolean(country)),
    ),
  );
});

const mapPoints = computed(() => nodeList.value);

watch(
  nodeList,
  (nodes) => {
    if (!nodes.length) {
      selectedNodeId.value = null;
      return;
    }
    if (
      !selectedNodeId.value ||
      !nodes.some((node) => node.id === selectedNodeId.value)
    ) {
      selectedNodeId.value = nodes[0]?.id ?? null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-bold tracking-tight">
        {{ t("dashboard.map.title") }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{
          loading
            ? t("common.loading")
            : t("dashboard.map.nodeCount", { count: nodeList.length })
        }}
      </p>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <Card class="overflow-hidden border-sky-100/70">
      <CardContent class="px-4 sm:px-6">
        <Tabs v-model="activeView" class="gap-3">
          <div
            class="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <TabsList>
              <TabsTrigger value="flat">
                {{ t("dashboard.map.tabs.flat") }}
              </TabsTrigger>
              <TabsTrigger value="globe">
                {{ t("dashboard.map.tabs.globe") }}
              </TabsTrigger>
            </TabsList>

            <div
              class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:justify-end"
            >
              <span
                v-if="locationStatusText"
                class="text-xs text-muted-foreground/80"
              >
                {{ locationStatusText }}
              </span>
              <label class="flex cursor-pointer items-center gap-2">
                <Checkbox
                  id="show-unlocked-countries"
                  :model-value="showUnlockedCountries"
                  @update:model-value="
                    (checked) => (showUnlockedCountries = !!checked)
                  "
                />
                <span>{{ t("dashboard.map.showUnlockedCountries") }}</span>
              </label>
              <label class="flex cursor-pointer items-center gap-2">
                <Checkbox
                  id="show-user-links"
                  :model-value="showUserLinks"
                  @update:model-value="(checked) => (showUserLinks = !!checked)"
                />
                <span>{{ t("dashboard.map.showMyLocationLinks") }}</span>
              </label>
            </div>
          </div>

          <TabsContent value="flat">
            <FlatWorldMap
              :points="mapPoints"
              :user-location="displayedUserLocation"
              :selected-node-id="selectedNodeId"
              :unlocked-countries="unlockedCountries"
              @select-node="(nodeId) => (selectedNodeId = nodeId)"
            />
          </TabsContent>

          <TabsContent value="globe">
            <Globe3DMap
              :points="mapPoints"
              :user-location="displayedUserLocation"
              :selected-node-id="selectedNodeId"
              :unlocked-countries="unlockedCountries"
              @select-node="(nodeId) => (selectedNodeId = nodeId)"
            />
          </TabsContent>
        </Tabs>

        <div
          class="mt-4 rounded-2xl border border-sky-100/80 bg-background/70 p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">
                {{ t("dashboard.map.nodeListTitle") }}
              </h2>
              <p class="text-sm text-muted-foreground">
                {{ t("dashboard.map.nodeListDescription") }}
              </p>
            </div>
            <Badge v-if="selectedNode" variant="secondary">
              {{ t("dashboard.map.selectedNode") }}: {{ selectedNode.name }}
            </Badge>
          </div>

          <div
            v-if="nodeList.length"
            class="mt-4 grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3"
          >
            <button
              v-for="node in nodeList"
              :key="node.id"
              type="button"
              :class="
                cn(
                  'flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors',
                  selectedNodeId === node.id
                    ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-500/10'
                    : 'border-border/70 bg-background hover:border-sky-200 hover:bg-sky-50/60 dark:hover:border-sky-400/30 dark:hover:bg-sky-500/10',
                )
              "
              @click="selectedNodeId = node.id"
            >
              <div class="min-w-0">
                <div class="truncate font-medium text-foreground">
                  {{ node.name }}
                </div>
                <div class="truncate text-xs text-muted-foreground">
                  {{ node.region }}
                </div>
              </div>
              <span
                class="ml-4 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.14)] transition-colors"
                :class="
                  selectedNodeId === node.id
                    ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]'
                    : ''
                "
              />
            </button>
          </div>

          <p v-else class="mt-4 text-sm text-muted-foreground">
            {{ t("dashboard.map.noNodes") }}
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
