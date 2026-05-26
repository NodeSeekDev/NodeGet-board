<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Search,
  Settings,
  ArrowUpFromLine,
  FolderInput,
  Copy,
  Loader2,
  RefreshCw,
  Plus,
  GripVertical,
  Menu,
  CloudDownload,
  Info,
  Router,
  LifeBuoy,
  LifeBuoyIcon,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import codeCopy from "@/components/node-manage/codeCopy.vue";

import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import AddAgentDialog from "@/components/agents/AddAgentDialog.vue";
import ShowAgentCommandDialog from "@/components/agents/ShowAgentCommandDialog.vue";
import { useAgentInfo } from "@/composables/useAgentInfo";
import VersionDialog from "@/components/node-manage/VersionDialog.vue";
import { PopConfirm } from "@/components/ui/pop-confirm";
import { useLifecycle } from "@/composables/useLifecycle";

import { compareVersions } from "compare-versions";
import { useTask } from "@/composables/useTask";
import { delay } from "@/lib/delay";
import { applyPostProces } from "@/lib/migration";

const { t } = useI18n();
const router = useRouter();
const { backends, currentBackend } = useBackendStore();
const currentAgentInfo = useAgentInfo(undefined, {
  withIP: true,
  withVersion: true,
});
const { afterAgentCreate } = useLifecycle();

const { createSelfUpdateTask } = useTask();

const { agents, loading, fetchAgents, fetchAgentVersion } = currentAgentInfo;

const searchQuery = ref("");
const selectedUuids = ref<Set<string>>(new Set());
const addAgentOpen = ref(false);
const showAgentCommandOpen = ref(false);
const showCommandAgentUuid = ref("");
const sortable = ref(false);

const changeVersionOpen = ref(false);
const availableVersions = ref<string[]>([]);
const pendingUpdateUUIDs = ref<string[]>([]);

const installScript = ref(
  `
grep -q 'allow_self_update' /etc/nodeget-agent.conf || \\
sed -i '/^allow_task = true$/a allow_self_update = true' /etc/nodeget-agent.conf
nohup bash <(curl -sL https://install.nodeget.com | sed  '/^set -e/a sleep 1') update-agent > /dev/null 2>&1 < /dev/null &
echo "升级成功"
`.trim(),
);

const filteredAgents = computed(() => {
  if (sortable.value) return agents.value;
  const q = searchQuery.value.toLowerCase();
  if (!q) return agents.value;
  return agents.value.filter(
    (a) =>
      (a.metadata?.customName &&
        a.metadata?.customName.toLowerCase().includes(q)) ||
      a.uuid.toLowerCase().includes(q),
  );
});

const onDragStart = (e: DragEvent, index: number) => {
  e.dataTransfer?.setData("text/plain", index.toString());
  e.dataTransfer!.effectAllowed = "move";
};

const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = "move";
};

const onDrop = (e: DragEvent, target: number) => {
  e.preventDefault();
  const fromStr = e.dataTransfer?.getData("text/plain");
  if (fromStr == null) return;
  const from = parseInt(fromStr, 10);
  if (isNaN(from) || from === target) return;
  const moved = agents.value.splice(from, 1)[0];
  if (moved) agents.value.splice(target, 0, moved);
};

const persistOrders = async () => {
  if (!currentBackend.value) return;
  const changed: { uuid: string; order: number }[] = [];
  agents.value.forEach((agent, i) => {
    const newOrder = i + 1;
    if (newOrder !== agent.metadata?.order) {
      if (agent.metadata) agent.metadata.order = newOrder;
      changed.push({ uuid: agent.uuid, order: newOrder });
    }
  });
  if (changed.length === 0) return;
  const conn = getWsConnection(currentBackend.value.url);
  try {
    await conn.callBatch(
      changed.map(({ uuid, order }) => ({
        method: "kv_set_value",
        params: {
          token: currentBackend.value!.token,
          namespace: uuid,
          key: "metadata_order",
          value: order,
        },
      })),
    );
    await fetchAgents();
    toast.success(t("dashboard.agents.sortSaved"));
  } catch (e: any) {
    toast.error(e?.message ?? "保存排序失败");
  }
};

watch(sortable, (v) => {
  if (!v) void persistOrders();
});

const allSelected = computed(() => {
  if (filteredAgents.value.length === 0) return false;
  return filteredAgents.value.every((a) => selectedUuids.value.has(a.uuid));
});

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    for (const agent of filteredAgents.value) {
      selectedUuids.value.add(agent.uuid);
    }
  } else {
    for (const agent of filteredAgents.value) {
      selectedUuids.value.delete(agent.uuid);
    }
  }
};

const toggleSelect = (uuid: string, checked: boolean) => {
  if (checked) {
    selectedUuids.value.add(uuid);
  } else {
    selectedUuids.value.delete(uuid);
  }
};

const hasSelection = computed(() => selectedUuids.value.size > 0);

const handleBatchAction = (_action: string) => {
  if (_action === "upgrade") {
    openChooseVersion(Array.from(selectedUuids.value));
    return;
  }
  toast.info(t("dashboard.agents.devInProgress"));
};

const handleSettings = (uuid: string) => {
  router.push(`/dashboard/node/${uuid}/setting`);
};

defineExpose({ fetchAgents });

function openChooseVersion(uuids: string[]) {
  pendingUpdateUUIDs.value = uuids;
  changeVersionOpen.value = true;
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

function extractVersion(version: string) {
  return version.split("-")[0] || "";
}

const upgradeStatus = ref<Map<string, "waiting" | "upgrading" | "confirming">>(
  new Map(),
);
async function confirmVersion(version: string) {
  version = version.replace(/^v/g, "");

  changeVersionOpen.value = false;

  if (typeof version !== "string") {
    return;
  }
  const uuids = pendingUpdateUUIDs.value.filter((uuid) => {
    let oldVersion = agents.value.find((v) => v.uuid === uuid)?.version;
    if (!oldVersion) {
      return false;
    }
    oldVersion = extractVersion(oldVersion);
    if (compareVersions(oldVersion, "0.1.3") < 0) {
      return false;
    }
    return compareVersions(version, oldVersion) !== 0;
  });

  if (uuids.length === 0) {
    toast.error("未发现可升级的在线节点");
    return;
  }

  upgradeStatus.value = new Map();

  for (let i = 0, len = uuids.length; i < len; i++) {
    const uuid = uuids[i] as string;
    upgradeStatus.value.set(uuid, "waiting");
  }

  for (let i = 0, len = uuids.length; i < len; i++) {
    const uuid = uuids[i] as string;
    const agent = agents.value.find((v) => v.uuid === uuid);
    if (!agent) {
      continue;
    }
    const oldVersion = extractVersion(agent.version || "");

    upgradeStatus.value.set(uuid, "upgrading");
    await createSelfUpdateTask(uuid, "v" + version, false);
    await delay(800);
    console.debug("confirming");
    upgradeStatus.value.set(uuid, "confirming");

    const waitInterval = 1000,
      maxWait = 12000;
    let finished = false;
    for (let j = 0; j < maxWait; j += waitInterval) {
      try {
        await fetchAgentVersion(agent, waitInterval);
        // console.debug({
        //   currentVersion: extractVersion(agent.version || ""),
        //   targetVersion: version,
        // });
        if (extractVersion(agent.version || "") === version) {
          upgradeStatus.value.delete(uuid);
          finished = true;

          try {
            await applyPostProces(uuid, oldVersion, version);
          } catch (error) {
            console.error("升级后处理失败", error);
            toast.error(
              `agent ${agent.metadata?.customName || agent.uuid} 升级后处理失败`,
            );
          }

          break;
        }
      } catch (error) {
        console.error(error);
      } finally {
        await delay(waitInterval);
      }
    }
    upgradeStatus.value.delete(uuid);
    if (!finished) {
      toast.success(
        `agent ${agent.metadata?.customName || agent.uuid} 升级失败, 请尝试手动升级`,
      );
    }
  }

  toast.success("agent升级完成");
}

async function reinitAgent(uuid: string) {
  await afterAgentCreate(
    uuid,
    {
      cronList: [],
      metadata: {},
      databaseLimit: {},
    },
    currentBackend,
  );
  await refresh();
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
      toast.error(`获取GitHub releases失败，检查 api.github.com 是否可访问`);
    });
}

function refresh() {
  fetchAgents();
  fetchVersion();
}

refresh();
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <div class="relative max-w-sm flex-1">
        <Search
          class="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          :placeholder="t('dashboard.agents.searchPlaceholder')"
          class="pl-8"
        />
      </div>
      <div class="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="loading || !hasSelection"
          @click="handleBatchAction('upgrade')"
        >
          <CloudDownload class="mr-1.5 h-4 w-4" />
          {{ t("dashboard.agents.batchUpgrade") }}
        </Button>
        <!-- temp disabled -->
        <Button
          size="sm"
          variant="outline"
          @click="handleBatchAction('move')"
          v-if="false"
        >
          <FolderInput class="mr-1.5 h-4 w-4" />
          {{ t("dashboard.agents.batchMove") }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button size="sm" variant="outline" v-if="false">
              <Copy class="mr-1.5 h-4 w-4" />
              {{ t("dashboard.agents.batchCopy") }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              v-for="backend in backends"
              :key="backend.url"
              @click="handleBatchAction('copy')"
            >
              {{ backend.name }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="loading"
        class="ml-auto"
        @click="fetchAgents"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        :disabled="loading || agents.length < 2"
        @click="sortable = !sortable"
      >
        <Menu class="mr-1.5 h-4 w-4" />
        {{
          sortable
            ? t("dashboard.agents.sortSave")
            : t("dashboard.agents.sortEdit")
        }}
      </Button>
      <Button @click="addAgentOpen = true">
        <Plus class="mr-1.5 h-4 w-4" />
        {{ t("dashboard.agents.addAgent") }}
      </Button>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-12 text-muted-foreground"
    >
      <Loader2 class="mr-2 h-5 w-5 animate-spin" />
      {{ t("common.loading") }}
    </div>

    <div
      v-else-if="agents.length === 0"
      class="py-12 text-center text-sm text-muted-foreground"
    >
      {{ t("dashboard.agents.noAgents") }}
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[40px]">
              <Checkbox
                :modelValue="allSelected"
                @update:modelValue="(v) => toggleSelectAll(!!v)"
              />
            </TableHead>
            <TableHead>{{ t("dashboard.agents.colName") }}</TableHead>
            <TableHead>{{ t("dashboard.agents.colId") }}</TableHead>
            <TableHead>{{ t("dashboard.agents.colIp") }}</TableHead>
            <TableHead>{{ t("dashboard.agents.colVersion") }}</TableHead>
            <TableHead class="text-right">{{
              t("dashboard.agents.colActions")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="filteredAgents.length === 0" :colspan="6">
            {{ t("dashboard.agents.noAgents") }}
          </TableEmpty>
          <TableRow
            v-for="(agent, index) in filteredAgents"
            :key="agent.uuid"
            :draggable="sortable"
            :class="sortable ? 'cursor-move select-none' : ''"
            @dragstart="(e: DragEvent) => onDragStart(e, index)"
            @dragover="onDragOver"
            @drop="(e: DragEvent) => onDrop(e, index)"
          >
            <TableCell>
              <GripVertical
                v-if="sortable"
                class="h-4 w-4 text-muted-foreground"
              />
              <Checkbox
                v-else
                :modelValue="selectedUuids.has(agent.uuid)"
                @update:modelValue="
                  (v: any) => {
                    toggleSelect(agent.uuid, !!v);
                  }
                "
              />
            </TableCell>
            <TableCell class="font-medium">
              <RouterLink
                :to="`/dashboard/node/${agent.uuid}`"
                class="hover:underline"
              >
                {{ agent?.metadata?.customName || "--" }}
              </RouterLink>
            </TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ agent.uuid.slice(0, 8) }}
            </TableCell>
            <TableCell class="min-w-20">
              <Loader2
                v-if="agent.ip === undefined"
                class="h-3.5 w-3.5 animate-spin text-muted-foreground"
              />
              <span v-else-if="agent.ip" class="font-mono text-xs">{{
                agent.ip
              }}</span>
              <span v-else class="text-muted-foreground">--</span>
            </TableCell>
            <TableCell
              class="text-muted-foreground"
              v-if="!upgradeStatus.has(agent.uuid)"
            >
              <span :title="agent.version || ''">
                {{ agent.version?.slice(0, 20) || "--" }}
              </span>
              <template v-if="agent.version">
                <TooltipProvider
                  v-if="
                    compareVersions(extractVersion(agent.version), '0.1.3') < 0
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
                        <article class="prose prose-sm mb-2">
                          <h4 class="mb-1">
                            版本太老，不支持 API
                            更新，只能通过脚本来更新到新版本
                          </h4>
                          <p>
                            你可以下面的命令，到
                            <a href="#/dashboard/batch-exec"> 批量执行</a>
                            面板上批量更新使用 Linux 系统的 Agent 节点
                          </p>
                        </article>
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
                        extractVersion(agent.version),
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
            </TableCell>
            <TableCell v-else>
              Agent升级
              <Badge variant="outline" class="ml-1">
                <Spinner data-icon="inline-start" />
                {{ upgradeStatus.get(agent.uuid) }}
              </Badge>
            </TableCell>
            <TableCell class="text-right">
              <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                title="升级"
                @click="openChooseVersion([agent.uuid])"
              >
                <CloudDownload class="h-4 w-4" />
              </Button>
              <PopConfirm
                title="重新初始化agent？"
                description="是否重新初始化agent，这会初始化agent的名称，经纬度，费用等等信息"
                :confirm-text="t('dashboard.servers.refreshConfirm')"
                :cancel-text="t('dashboard.servers.deleteCancel')"
                @confirm="reinitAgent(agent.uuid)"
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
              <PopConfirm
                title="重新连接agent？(危险操作)"
                description="会关闭已授权此agent的token，并生成新的连接命令和token，已连接的agent（如果存在）会被强制断开连接，直至使用新的连接命令重新连接，适用于重装系统后恢复连接"
                confirm-text="确定"
                :cancel-text="t('dashboard.servers.deleteCancel')"
                @confirm="
                  showCommandAgentUuid = agent.uuid;
                  showAgentCommandOpen = true;
                "
              >
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8"
                  title="重新显示连接命令"
                >
                  <LifeBuoyIcon class="h-4 w-4" />
                </Button>
              </PopConfirm>
              <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                title="设置"
                @click="handleSettings(agent.uuid)"
              >
                <Settings class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <AddAgentDialog
      v-if="addAgentOpen"
      v-model:open="addAgentOpen"
      @added="refresh()"
    />
    <ShowAgentCommandDialog
      v-if="showAgentCommandOpen"
      v-model:open="showAgentCommandOpen"
      :uuid="showCommandAgentUuid"
      @added="refresh()"
    />
    <VersionDialog
      v-if="changeVersionOpen"
      :availableVersions="availableVersions"
      v-model:open="changeVersionOpen"
      @select-version="confirmVersion"
    ></VersionDialog>
  </div>
</template>
