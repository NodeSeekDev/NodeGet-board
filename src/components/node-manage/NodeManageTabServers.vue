<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Wrench,
  Plus,
  Trash2,
  RefreshCw,
  CloudDownload,
  Loader2,
  Info,
  Share2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PopConfirm } from "@/components/ui/pop-confirm";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "vue-sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import BackendSwitcher from "@/components/BackendSwitcher.vue";
import {
  useBackendExtra,
  getSingleBackendProperty,
} from "@/composables/useBackendExtra";
import type { ServerVersionInfo } from "@/composables/useBackendExtra";
import { useLifecycle } from "@/composables/useLifecycle";
import { useTask } from "@/composables/useTask";
import { delay } from "@/lib/delay";
import VersionDialog from "@/components/node-manage/VersionDialog.vue";
import ShareDialog from "@/components/node-manage/ShareDialog.vue";
import { compareVersions } from "compare-versions";
import { getWsConnection } from "@/composables/useWsConnection";
import codeCopy from "@/components/node-manage/codeCopy.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { backends, selectBackend, removeBackend, addBackend } =
  useBackendStore();
const {
  refreshAll,
  isActive,
  serverInfo,
  serverInfoLoading,
  updateServer,
  fetchServerInfo,
} = useBackendExtra();
const { afterServerCreate } = useLifecycle();

const installScript = ref(
  `
bash <(curl -sL https://install.nodeget.com) update-server
`.trim(),
);

const addOpen = ref(false);
const changeVersionOpen = ref(false);
const shareOpen = ref(false);
const shareBackend = ref<Backend | null>(null);
const availableVersions = ref<string[]>([]);
const pendingUpdateUrl = ref<string>("");
const upgradeStatus = ref<Map<string, "waiting" | "upgrading" | "confirming">>(
  new Map(),
);
const initForm = ref<{
  newName: string;
  newUrl: string;
  newToken: string;
}>({
  newName: "",
  newUrl: "",
  newToken: "",
});

const handleManage = (backend: Backend) => {
  router.push(`/dashboard/servers-detail/${backend.name}`);
};

const handleSelect = async (backend: Backend) => {
  selectBackend(backend);
  await delay(10);
  location.reload();
};

function extractVersion(version: string) {
  return version.split("-")[0] || "";
}

const latestVersion = computed(() => {
  if (availableVersions.value.length === 0) {
    return "";
  }
  const sorted = availableVersions.value
    .map((v) => v.replace(/^v/g, ""))
    .sort(compareVersions);

  return sorted[sorted.length - 1] as string;
});

function openChooseVersion(url: string) {
  pendingUpdateUrl.value = url;
  changeVersionOpen.value = true;
}

async function confirmVersion(version: string) {
  version = version.replace(/^v/g, "");
  changeVersionOpen.value = false;

  if (!pendingUpdateUrl.value || typeof version !== "string") {
    return;
  }

  const backend = serverInfo.value[pendingUpdateUrl.value];
  if (!backend) {
    toast.error("Server not found");
    return;
  }

  const oldVersion = extractVersion(backend.version || "");
  if (compareVersions(oldVersion, "0.1.3") < 0) {
    toast.error("Server version is too old, not supported");
    return;
  }

  if (compareVersions(version, oldVersion) === 0) {
    toast.info("Already using this version");
    return;
  }

  upgradeStatus.value.set(backend.url, "waiting");

  try {
    upgradeStatus.value.set(backend.url, "upgrading");
    await updateServer(backend, "v" + version);
    await delay(800);

    upgradeStatus.value.set(backend.url, "confirming");
    const waitInterval = 1000;
    const maxWait = 12000;
    let finished = false;

    for (let j = 0; j < maxWait; j += waitInterval) {
      try {
        // await getSingleBackendProperty(backend)
        const conn = getWsConnection(backend.url);
        const currentVersion = await conn
          .call<ServerVersionInfo>("nodeget-server_version", [])
          .then((ver) => ver.cargo_version);

        console.debug({
          currentVersion,
          targetVersion: version,
        });
        if (currentVersion === version) {
          await fetchServerInfo(backend);
          upgradeStatus.value.delete(backend.url);
          finished = true;
          break;
        }
      } catch (error) {
        console.error(error);
      } finally {
        await delay(waitInterval);
      }
    }

    upgradeStatus.value.delete(backend.url);
    if (!finished) {
      toast.error("Server upgrade failed, please try manual upgrade");
    } else {
      toast.success("Server upgrade completed");
    }
  } catch (error) {
    upgradeStatus.value.delete(backend.url);
    toast.error(error instanceof Error ? error.message : "Upgrade failed");
  }
}

function fetchVersion() {
  const repo = import.meta.env.VITE_RELEASE_REPO;
  return fetch(`https://api.github.com/repos/${repo}/releases`)
    .then((r) => r.json())
    .then((r) =>
      (r as { tag_name: string }[])
        .map((v) => v.tag_name)
        .filter((v) => v.startsWith("v")),
    )
    .then((r) => {
      availableVersions.value = r;
    })
    .catch((e) => {
      console.error(e);
      toast.error(
        "Failed to fetch GitHub releases, check if api.github.com is accessible",
      );
    });
}

watch(
  () => route.query.fill,
  (raw) => {
    if (!raw || typeof raw !== "string") return;

    if (raw === "empty") {
      addOpen.value = true;
      return;
    }

    try {
      const decoded = JSON.parse(atob(raw)) as Backend;
      if (!decoded.url || !decoded.token || !decoded.name) return;

      const exists = backends.value.some(
        (b) => b.url === decoded.url && b.token === decoded.token,
      );
      if (!exists) {
        initForm.value.newName = decoded.name;
        initForm.value.newUrl = decoded.url;
        initForm.value.newToken = decoded.token;
        addOpen.value = true;
      } else {
        toast.warning("Server already exists, no need to add again");
      }
    } catch {
      // 解码或解析失败时静默忽略
    }
  },
  { immediate: true },
);

// Fetch available versions on mount
fetchVersion();
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" @click="refreshAll">
        <RefreshCw
          class="h-4 w-4"
          :class="{ 'animate-spin': serverInfoLoading }"
        />
      </Button>
      <Button size="sm" @click="addOpen = true">
        <Plus class="mr-1.5 h-4 w-4" />
        {{ t("dashboard.servers.addServer") }}
      </Button>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{{ t("dashboard.servers.colName") }}</TableHead>
            <TableHead>{{ t("dashboard.servers.colId") }}</TableHead>
            <TableHead>{{ t("dashboard.servers.colEndpoint") }}</TableHead>
            <TableHead>{{ t("dashboard.servers.colVersion") }}</TableHead>
            <TableHead>{{ t("dashboard.servers.colStatus") }}</TableHead>
            <TableHead class="text-right">{{
              t("dashboard.servers.colActions")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="backends.length === 0" :colspan="6">
            {{ t("dashboard.servers.noServers") }}
          </TableEmpty>
          <TableRow v-for="backend in backends" :key="backend.url">
            <TableCell class="font-medium" @click="handleManage(backend)">
              <RouterLink
                :to="`/dashboard/servers-detail/${encodeURIComponent(backend.url)}:::${encodeURIComponent(backend.token)}`"
                class="hover:underline"
              >
                {{ backend.name }}
              </RouterLink>
            </TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ serverInfo[backend.url]?.uuid ?? "--" }}
            </TableCell>
            <TableCell
              class="max-w-[200px] truncate font-mono text-xs"
              :title="backend.url"
            >
              {{ backend.url }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              <template v-if="!upgradeStatus.has(backend.url)">
                <span :title="serverInfo[backend.url]?.version || ''">
                  {{ (serverInfo[backend.url]?.version ?? "--").slice(0, 20) }}
                </span>
                <template v-if="serverInfo[backend.url]?.version">
                  <TooltipProvider
                    v-if="
                      compareVersions(
                        extractVersion(serverInfo[backend.url]?.version || ''),
                        '0.1.3',
                      ) < 0
                    "
                  >
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Badge
                          variant="outline"
                          class="ml-2 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        >
                          脚本更新
                          <Info data-icon="inline-start" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div class="w-150">
                          <h2 class="my-2 text-base">
                            版本太老，不支持 API
                            更新，只能通过在终端运行脚本来更新到新版本
                          </h2>
                          <codeCopy :code="installScript"></codeCopy>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <template v-else-if="availableVersions.length">
                    <Badge
                      variant="outline"
                      v-if="
                        compareVersions(
                          extractVersion(
                            serverInfo[backend.url]?.version || '',
                          ),
                          latestVersion,
                        ) < 0
                      "
                      class="ml-2 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      >可更新</Badge
                    >
                    <Badge
                      variant="outline"
                      v-else
                      class="ml-2 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                      >最新版本</Badge
                    >
                  </template>
                </template>
              </template>
              <template v-else>
                Server升级
                <Badge variant="outline" class="ml-1">
                  <Spinner data-icon="inline-start" />
                  {{ upgradeStatus.get(backend.url) }}
                </Badge>
              </template>
            </TableCell>
            <TableCell>
              <Badge v-if="isActive(backend)" variant="default">
                {{ t("dashboard.servers.active") }}
              </Badge>
              <Button
                v-else
                size="sm"
                variant="secondary"
                @click="handleSelect(backend)"
              >
                {{ t("dashboard.servers.select") }}
              </Button>
            </TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8"
                  title="升级"
                  @click="openChooseVersion(backend.url)"
                >
                  <CloudDownload class="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8"
                  title="分享"
                  @click="
                    shareBackend = backend;
                    shareOpen = true;
                  "
                >
                  <Share2 class="h-4 w-4" />
                </Button>
                <PopConfirm
                  :title="t('dashboard.servers.refreshConfirmTitle')"
                  :description="t('dashboard.servers.refreshConfirmDesc')"
                  :confirm-text="t('dashboard.servers.refreshConfirm')"
                  :cancel-text="t('dashboard.servers.deleteCancel')"
                  @confirm="afterServerCreate(backend, true)"
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    class="h-8 w-8"
                    title="重新初始化"
                  >
                    <RefreshCw class="h-4 w-4" />
                  </Button>
                </PopConfirm>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8"
                  title="manage"
                  @click="handleManage(backend)"
                >
                  <Wrench class="h-4 w-4" />
                </Button>
                <PopConfirm
                  :title="t('dashboard.servers.deleteConfirmTitle')"
                  :description="t('dashboard.servers.deleteConfirmDesc')"
                  :confirm-text="t('dashboard.servers.deleteConfirm')"
                  :cancel-text="t('dashboard.servers.deleteCancel')"
                  @confirm="removeBackend(backend)"
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    class="h-8 w-8 text-destructive hover:text-destructive/90"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </PopConfirm>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <BackendSwitcher
      v-model:open="addOpen"
      :init-form="initForm"
      :show-list="false"
    />
    <VersionDialog
      v-if="changeVersionOpen"
      :availableVersions="availableVersions"
      v-model:open="changeVersionOpen"
      @select-version="confirmVersion"
    ></VersionDialog>
    <ShareDialog
      v-if="shareOpen"
      :backend="shareBackend as Backend"
      v-model:open="shareOpen"
    ></ShareDialog>
  </div>
</template>
