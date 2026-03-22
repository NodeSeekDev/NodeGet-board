<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import FlatWorldMap from "@/components/map/FlatWorldMap.vue";
import Globe3DMap from "@/components/map/Globe3DMap.vue";
import { useOverviewData } from "@/composables/useOverviewData";
import { REGION_COORDS } from "@/data/mapRegionCoords";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const { t } = useI18n();
const activeView = ref("flat");
const showUserLinks = ref(false);
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

const mapPoints = computed(() => {
  const grouped = new Map<
    string,
    {
      name: string;
      region: string;
      count: number;
      nodes: string[];
      value: [number, number, number];
    }
  >();

  for (const server of servers.value) {
    if (server.hidden) continue;

    const hasCustomCoord =
      Number.isFinite(server.longitude) && Number.isFinite(server.latitude);
    const regionMeta = server.region ? REGION_COORDS[server.region] : undefined;
    const coord: [number, number] | null = hasCustomCoord
      ? [server.longitude as number, server.latitude as number]
      : (regionMeta?.coord ?? null);

    if (!coord) continue;

    const regionLabel =
      regionMeta?.name || server.region || t("dashboard.map.unknownRegion");
    const nodeName = server.customName || server.uuid.slice(0, 8);
    const key = `${coord[0]},${coord[1]}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      existing.nodes.push(nodeName);
      existing.value[2] = existing.count;
      existing.name = `${regionLabel} · ${existing.count}`;
    } else {
      grouped.set(key, {
        name: nodeName,
        region: regionLabel,
        count: 1,
        nodes: [nodeName],
        value: [coord[0], coord[1], 1],
      });
    }
  }

  return Array.from(grouped.values());
});
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
            : t("dashboard.map.nodeCount", { count: mapPoints.length })
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
              class="flex items-center gap-3 text-sm text-muted-foreground sm:justify-end"
            >
              <span
                v-if="locationStatusText"
                class="text-xs text-muted-foreground/80"
              >
                {{ locationStatusText }}
              </span>
              <Checkbox
                :model-value="showUserLinks"
                @update:model-value="(checked) => (showUserLinks = !!checked)"
              />
              <span>{{ t("dashboard.map.showMyLocationLinks") }}</span>
            </div>
          </div>

          <TabsContent value="flat">
            <FlatWorldMap
              :points="mapPoints"
              :user-location="displayedUserLocation"
            />
          </TabsContent>

          <TabsContent value="globe">
            <Globe3DMap
              :points="mapPoints"
              :user-location="displayedUserLocation"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  </div>
</template>
