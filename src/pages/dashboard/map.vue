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
  // 大中华区
  HK: "Hong Kong",
  MO: "Macao",
  TW: "Taiwan",
  CN: "China",
  // 东亚
  JP: "Japan",
  KR: "South Korea",
  MN: "Mongolia",
  KP: "North Korea",
  // 东南亚
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  ID: "Indonesia",
  MM: "Myanmar",
  KH: "Cambodia",
  LA: "Laos",
  TL: "Timor-Leste",
  BN: "Brunei",
  // 南亚
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  NP: "Nepal",
  BT: "Bhutan",
  MV: "Maldives",
  AF: "Afghanistan",
  // 中亚
  KZ: "Kazakhstan",
  UZ: "Uzbekistan",
  TM: "Turkmenistan",
  TJ: "Tajikistan",
  KG: "Kyrgyzstan",
  // 高加索
  AZ: "Azerbaijan",
  AM: "Armenia",
  GE: "Georgia",
  // 中东
  TR: "Turkey",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
  PS: "Palestine",
  IQ: "Iraq",
  IR: "Iran",
  SY: "Syria",
  JO: "Jordan",
  LB: "Lebanon",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
  YE: "Yemen",
  // 北美
  US: "United States of America",
  CA: "Canada",
  MX: "Mexico",
  GL: "Greenland",
  PM: "Saint Pierre and Miquelon",
  // 中美洲
  GT: "Guatemala",
  BZ: "Belize",
  HN: "Honduras",
  SV: "El Salvador",
  NI: "Nicaragua",
  CR: "Costa Rica",
  PA: "Panama",
  // 加勒比
  CU: "Cuba",
  JM: "Jamaica",
  HT: "Haiti",
  DO: "Dominican Republic",
  PR: "Puerto Rico",
  TT: "Trinidad and Tobago",
  BB: "Barbados",
  LC: "Saint Lucia",
  VC: "Saint Vincent and the Grenadines",
  GD: "Grenada",
  AG: "Antigua and Barbuda",
  DM: "Dominica",
  KN: "Saint Kitts and Nevis",
  BS: "Bahamas",
  TC: "Turks and Caicos Islands",
  KY: "Cayman Islands",
  BM: "Bermuda",
  VG: "British Virgin Islands",
  VI: "United States Virgin Islands",
  AW: "Aruba",
  CW: "Curacao",
  SX: "Sint Maarten",
  MF: "Saint Martin",
  BL: "Saint Barthelemy",
  BQ: "Bonaire, Saint Eustatius and Saba",
  GP: "Guadeloupe",
  MQ: "Martinique",
  MS: "Montserrat",
  AI: "Anguilla",
  // 南美
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  VE: "Venezuela",
  EC: "Ecuador",
  BO: "Bolivia",
  PY: "Paraguay",
  UY: "Uruguay",
  GY: "Guyana",
  SR: "Suriname",
  GF: "French Guiana",
  FK: "Falkland Is.",
  // 西欧
  GB: "United Kingdom",
  IE: "Ireland",
  FR: "France",
  DE: "Germany",
  NL: "Netherlands",
  BE: "Belgium",
  LU: "Luxembourg",
  CH: "Switzerland",
  AT: "Austria",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  MC: "Monaco",
  AD: "Andorra",
  SM: "San Marino",
  VA: "Vatican",
  LI: "Liechtenstein",
  GI: "Gibraltar",
  // 北欧
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  DK: "Denmark",
  IS: "Iceland",
  FO: "Faroe Is.",
  AX: "Aland",
  SJ: "Svalbard and Jan Mayen",
  // 南欧
  GR: "Greece",
  CY: "Cyprus",
  MT: "Malta",
  // 英属皇家属地
  GG: "Guernsey",
  JE: "Jersey",
  IM: "Isle of Man",
  // 东欧
  RU: "Russia",
  UA: "Ukraine",
  BY: "Belarus",
  PL: "Poland",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  MD: "Moldova",
  LT: "Lithuania",
  LV: "Latvia",
  EE: "Estonia",
  // 巴尔干
  RS: "Serbia",
  XK: "Kosovo",
  HR: "Croatia",
  SI: "Slovenia",
  BA: "Bosnia and Herzegovina",
  ME: "Montenegro",
  AL: "Albania",
  MK: "North Macedonia",
  // 北非
  EG: "Egypt",
  LY: "Libya",
  TN: "Tunisia",
  DZ: "Algeria",
  MA: "Morocco",
  EH: "W. Sahara",
  SD: "Sudan",
  // 东非
  ET: "Ethiopia",
  ER: "Eritrea",
  DJ: "Djibouti",
  SO: "Somalia",
  KE: "Kenya",
  TZ: "Tanzania",
  UG: "Uganda",
  RW: "Rwanda",
  BI: "Burundi",
  SS: "S. Sudan",
  // 西非
  NG: "Nigeria",
  GH: "Ghana",
  SN: "Senegal",
  CI: "Ivory Coast",
  CM: "Cameroon",
  ML: "Mali",
  BF: "Burkina Faso",
  NE: "Niger",
  TD: "Chad",
  MR: "Mauritania",
  GM: "Gambia",
  GW: "Guinea-Bissau",
  GN: "Guinea",
  SL: "Sierra Leone",
  LR: "Liberia",
  TG: "Togo",
  BJ: "Benin",
  CV: "Cape Verde",
  ST: "Sao Tome and Principe",
  // 中非
  CF: "Central African Rep.",
  CG: "Congo",
  CD: "Dem. Rep. Congo",
  GA: "Gabon",
  GQ: "Eq. Guinea",
  AO: "Angola",
  // 南非洲
  ZA: "South Africa",
  NA: "Namibia",
  BW: "Botswana",
  ZW: "Zimbabwe",
  ZM: "Zambia",
  MW: "Malawi",
  MZ: "Mozambique",
  SZ: "Swaziland",
  LS: "Lesotho",
  // 印度洋岛屿
  MG: "Madagascar",
  MU: "Mauritius",
  SC: "Seychelles",
  KM: "Comoros",
  RE: "Reunion",
  YT: "Mayotte",
  SH: "Saint Helena",
  IO: "Br. Indian Ocean Ter.",
  // 大洋洲
  AU: "Australia",
  NZ: "New Zealand",
  PG: "Papua New Guinea",
  FJ: "Fiji",
  SB: "Solomon Is.",
  VU: "Vanuatu",
  NC: "New Caledonia",
  WS: "Samoa",
  TO: "Tonga",
  KI: "Kiribati",
  FM: "Micronesia",
  MH: "Marshall Is.",
  PW: "Palau",
  NR: "Nauru",
  TV: "Tuvalu",
  CK: "Cook Islands",
  NU: "Niue",
  WF: "Wallis and Futuna",
  PF: "Fr. Polynesia",
  GU: "Guam",
  MP: "N. Mariana Is.",
  AS: "American Samoa",
  NF: "Norfolk Island",
  CC: "Cocos (Keeling) Islands",
  CX: "Christmas Island",
  TK: "Tokelau",
  PN: "Pitcairn Is.",
  // 大西洋 & 偏远领地
  GS: "S. Georgia and S. Sandwich Isl.",
  BV: "Bouvet Island",
  HM: "Heard I. and McDonald Is.",
  TF: "Fr. S. Antarctic Lands",
  UM: "United States Minor Outlying Islands",
  // 极地
  AQ: "Antarctica",
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
        isoCode: server.region?.trim().toUpperCase(),
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
        isoCode: node.isoCode,
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
        .map((server) => server.region?.trim().toUpperCase())
        .filter((r): r is string => Boolean(r)),
    ),
  );
});

const mapPoints = computed(() => {
  const byCountry = new Map<
    string,
    {
      isoCode: string;
      region: string;
      coord: [number, number];
      nodeIds: string[];
      nodeNames: string[];
    }
  >();

  for (const server of visibleServers.value) {
    const iso = server.region?.trim().toUpperCase();
    if (!iso) continue;
    const hasCustomCoord =
      Number.isFinite(server.longitude) && Number.isFinite(server.latitude);
    const regionMeta = REGION_COORDS[iso];
    const coord: [number, number] | null = hasCustomCoord
      ? [server.longitude as number, server.latitude as number]
      : (regionMeta?.coord ?? null);
    if (!coord) continue;

    if (!byCountry.has(iso)) {
      byCountry.set(iso, {
        isoCode: iso,
        region:
          (getCountryNameFromRegion(iso)
            ? getDisplayCountryName(
                getCountryNameFromRegion(iso)!,
                locale.value,
              )
            : null) ||
          regionMeta?.name ||
          iso,
        coord,
        nodeIds: [],
        nodeNames: [],
      });
    }
    const entry = byCountry.get(iso)!;
    entry.nodeIds.push(server.uuid);
    entry.nodeNames.push(server.customName || server.uuid.slice(0, 8));
  }

  return [...byCountry.values()].map((entry) => ({
    id: entry.nodeIds[0]!,
    name: entry.nodeNames[0]!,
    region: entry.region,
    isoCode: entry.isoCode,
    nodeIds: entry.nodeIds,
    count: entry.nodeIds.length,
    nodes: entry.nodeNames,
    value: [...entry.coord, entry.nodeIds.length] as [number, number, number],
  }));
});

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
                <div class="text-xs text-muted-foreground">
                  <span class="truncate">{{ node.region }}</span>
                  <span v-if="node.isoCode" class="ml-1 font-mono opacity-50">{{
                    node.isoCode
                  }}</span>
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
