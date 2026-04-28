<script setup lang="ts">
import { ref, type Ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Loader2,
  PackageOpen,
  ArrowLeft,
  Copy,
  Check,
  Pencil,
  Cable,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// import { RadioGroup, RadioGroupItem, } from '@/components/ui/radio-group'
import { useBackendStore } from "@/composables/useBackendStore";
import { useBackendExtra } from "@/composables/useBackendExtra";
import { getWsConnection } from "@/composables/useWsConnection";
import { useThemeStore } from "@/stores/theme";
import { Codemirror } from "vue-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { oneDark } from "@codemirror/theme-one-dark";
import { Skeleton } from "@/components/ui/skeleton";
import DatabaseStorageTab from "@/components/servers-detail/DatabaseStorageTab.vue";

definePage({
  meta: { title: "router.servers", hidden: true },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { backends, currentBackend } = useBackendStore();
const { serverInfo, saveAgentConfigWsUrl, refreshAll, serverInfoLoading } =
  useBackendExtra();
const themeStore = useThemeStore();

const backend = computed(() => {
  const raw = (route.params as { backendId: string }).backendId;
  const sep = raw.indexOf(":::");
  if (sep === -1) {
    const token = decodeURIComponent(raw);
    return backends.value.find((b) => b.token === token) ?? null;
  }
  const url = decodeURIComponent(raw.slice(0, sep));
  const token = decodeURIComponent(raw.slice(sep + 3));
  return backends.value.find((b) => b.url === url && b.token === token) ?? null;
});

const isActive = computed(
  () =>
    currentBackend.value?.url === backend.value?.url &&
    currentBackend.value?.token === backend.value?.token,
);

// --- Basic Info ---
const serverUuid = ref<string | null>(null);
const serverVersion = ref<string | null>(null);

interface ServerVersionInfo {
  cargo_version: string;
  git_commit_sha: string;
}

const fetchBasicInfo = async () => {
  if (!backend.value) return;
  const conn = getWsConnection(backend.value.url);
  try {
    const [uuid, ver] = await Promise.all([
      conn.call<string>("nodeget-server_uuid", []),
      conn.call<ServerVersionInfo>("nodeget-server_version", []),
    ]);
    serverUuid.value = uuid;
    serverVersion.value = `${ver.cargo_version}-${ver.git_commit_sha}`;
  } catch {}
};

// --- Config ---
const configContent = ref("");
const configLoading = ref(false);
const configSaving = ref(false);
const configLoaded = ref(false);

const fetchConfig = async () => {
  if (!backend.value || configLoaded.value) return;
  configLoading.value = true;
  try {
    const result = await getWsConnection(backend.value.url).call<unknown>(
      "nodeget-server_read_config",
      { token: backend.value.token },
    );
    configContent.value =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);
    configLoaded.value = true;
  } catch {
  } finally {
    configLoading.value = false;
  }
};

fetchConfig();

// --- Database storage ---
const storageData = ref<{
  tables: Record<string, number>;
  total: number;
} | null>(null);
const storageLoading = ref(false);

const fetchStorage = async () => {
  if (!backend.value) return;
  storageLoading.value = true;
  try {
    storageData.value = await getWsConnection(backend.value.url).call(
      "nodeget-server_database_storage",
      { token: backend.value.token },
    );
  } finally {
    storageLoading.value = false;
  }
};

const local_ws_port = computed(() => {
  const line =
    configContent.value
      .split("\n")
      .map((v) => v.trim())
      .find((v) => v.startsWith("ws_listener")) || "";
  if (!line) {
    return "";
  }
  const sep = line.split(":");
  const port = parseInt(sep[sep.length - 1] as string);
  return port;
});

const saveConfig = async () => {
  if (!backend.value || configSaving.value) return;
  configSaving.value = true;
  try {
    await getWsConnection(backend.value.url).call(
      "nodeget-server_edit_config",
      { token: backend.value.token, config_string: configContent.value },
    );
  } catch {
  } finally {
    configSaving.value = false;
  }
};

watch(
  backend,
  (b) => {
    if (b) fetchBasicInfo();
  },
  { immediate: true },
);

const handleTabChange = (tab: string) => {
  activeTab.value = tab;
  if (tab === "config") fetchConfig();
  if (tab === "storage" && !storageData.value) fetchStorage();
};

const activeTab = ref("info");

const copiedKey = ref<string | null>(null);
const copyText = (key: string, text: string | null | undefined) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  copiedKey.value = key;
  setTimeout(() => (copiedKey.value = null), 1500);
};
const setAgentConfigWsUrl = (key: string, text: string | null | undefined) => {
  if (!text) return;
  if (!backend.value) return;

  copiedKey.value = key;

  let url = "";
  if (key === "ip-select") {
    url = serverInfo.value[backend.value.url]?.ip || "";
    if (local_ws_port.value) {
      url = "ws://" + url + ":" + local_ws_port.value;
    }
  } else if (key === "url-select") {
    url = backend.value.url;
  }
  saveAgentConfigWsUrl(ref(backend.value), url)
    .then(() => {
      return refreshAll();
    })
    .then(() => {
      editingField.value = null;
    })
    .catch((e) => {
      console.error(e);
      editingField.value = null;
    });
  setTimeout(() => (copiedKey.value = null), 2500);
};

const editorExtensions = computed(() => [
  StreamLanguage.define(toml),
  ...(themeStore.isDark ? [oneDark] : []),
]);

// --- Edit state ---
const editingField = ref<string | null>(null);
const editValue = ref("");

function startEdit(field: string, currentValue: string | undefined) {
  editingField.value = field;
  editValue.value = currentValue ?? "";
}

function cancelEdit() {
  editingField.value = null;
  editValue.value = "";
}

function saveEdit(field: string) {
  if (!backend.value) return;
  const idx = backends.value.findIndex(
    (b) => b.url === backend.value!.url && b.token === backend.value!.token,
  );
  if (idx === -1) return;

  if (field === "name") {
    backends.value[idx]!.name = editValue.value;
  } else if (field === "url") {
    backends.value[idx]!.url = editValue.value;
  } else if (field === "token") {
    backends.value[idx]!.token = editValue.value;
  }
  if (field === "agent-url") {
    saveAgentConfigWsUrl(ref(backend.value), editValue.value)
      .then(() => {
        return refreshAll();
      })
      .then(() => {
        editingField.value = null;
      })
      .catch((e) => {
        console.error(e);
        editingField.value = null;
      });
  } else {
    editingField.value = null;
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        @click="router.push('/dashboard/node-manage?tab=servers')"
      >
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <h1 class="text-2xl font-semibold">
        {{ backend?.name ?? t("dashboard.servers.detail.title") }}
      </h1>
    </div>

    <!-- Tabs -->
    <Tabs
      :model-value="activeTab"
      @update:model-value="handleTabChange($event as string)"
    >
      <TabsList>
        <TabsTrigger value="info">{{
          t("dashboard.servers.detail.tabInfo")
        }}</TabsTrigger>
        <TabsTrigger value="storage">{{
          t("dashboard.servers.detail.tabStorage")
        }}</TabsTrigger>
        <TabsTrigger value="config">{{
          t("dashboard.servers.detail.tabConfig")
        }}</TabsTrigger>
        <TabsTrigger value="version">{{
          t("dashboard.servers.detail.tabVersion")
        }}</TabsTrigger>
      </TabsList>

      <!-- Tab: 基本信息 -->
      <TabsContent value="info" class="mt-4">
        <h2 class="mb-2">浏览器本地信息</h2>
        <div class="rounded-md border divide-y">
          <!-- 名称 -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoName") }}
            </span>
            <template v-if="editingField === 'name'">
              <Input v-model="editValue" class="h-8 w-48" />
              <Button size="sm" variant="outline" @click="saveEdit('name')">
                {{ t("dashboard.servers.detail.infoSave") }}
              </Button>
              <Button size="sm" variant="ghost" @click="cancelEdit">
                {{ t("dashboard.servers.detail.infoCancel") }}
              </Button>
            </template>
            <template v-else>
              <span class="text-sm font-medium">{{
                backend?.name ?? "--"
              }}</span>
              <Button
                size="icon"
                variant="ghost"
                class="h-6 w-6 shrink-0"
                @click="copyText('name', backend?.name)"
              >
                <Check
                  v-if="copiedKey === 'name'"
                  class="h-3.5 w-3.5 text-green-500"
                />
                <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="h-6 w-6 shrink-0"
                @click="startEdit('name', backend?.name)"
              >
                <Pencil class="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </template>
          </div>
          <!-- API 地址 -->
          <div class="flex flex-wrap items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoEndpoint") }}
            </span>
            <div
              v-if="editingField === 'url'"
              class="flex flex-wrap items-center py-1 gap-x-4 gap-y-1"
            >
              <Input v-model="editValue" class="h-8 w-64" />
              <Button size="sm" variant="outline" @click="saveEdit('url')">
                {{ t("dashboard.servers.detail.infoSave") }}
              </Button>
              <Button size="sm" variant="ghost" @click="cancelEdit">
                {{ t("dashboard.servers.detail.infoCancel") }}
              </Button>
              <!-- <div class="w-full"></div>
              <RadioGroup default-value="backend-also" class="flex mt-2">
                <div class="flex items-center space-x-2">
                  <RadioGroupItem id="r2" value="backend-also" />
                  <Label for="r2" class="text-sm font-mono">Change agent config too</Label>
                </div>
                <div class="flex items-center space-x-2">
                  <RadioGroupItem id="r1" value="frontend-only" />
                  <Label for="r1" class="text-sm font-mono">Only frontend</Label>
                </div>
              </RadioGroup> -->
            </div>
            <template v-else>
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-sm font-mono">{{
                  backend?.url ?? "--"
                }}</span>
                <Button
                  v-if="backend?.url"
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0"
                  @click="copyText('url', backend?.url)"
                >
                  <Check
                    v-if="copiedKey === 'url'"
                    class="h-3.5 w-3.5 text-green-500"
                  />
                  <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0"
                  @click="startEdit('url', backend?.url)"
                >
                  <Pencil class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  v-if="serverUuid"
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0"
                  title="select as agent config address"
                  @click="setAgentConfigWsUrl('url-select', backend?.url || '')"
                >
                  <template v-if="copiedKey === 'url-select'">
                    <Check
                      v-if="serverInfoLoading"
                      class="h-3.5 w-3.5 text-green-500"
                    />
                    <Loader2 v-else class="h-3.5 w-3.5 animate-spin"></Loader2>
                  </template>
                  <Cable
                    v-else
                    class="h-3.5 w-3.5 text-muted-foreground"
                    title="select as agent config address"
                  />
                </Button>
              </div>
            </template>
          </div>

          <!-- 状态 -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoStatus") }}
            </span>
            <Badge v-if="isActive" variant="default">
              {{ t("dashboard.servers.detail.infoActive") }}
            </Badge>
            <Badge v-else variant="secondary">
              {{ t("dashboard.servers.detail.infoInactive") }}
            </Badge>
          </div>
          <!-- Token -->
          <div class="flex items-start px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">
              {{ t("dashboard.servers.detail.infoToken") }}
            </span>
            <template v-if="editingField === 'token'">
              <div class="flex flex-col gap-2 min-w-0">
                <Input v-model="editValue" class="h-8 w-64 font-mono text-xs" />
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    @click="saveEdit('token')"
                  >
                    {{ t("dashboard.servers.detail.infoSave") }}
                  </Button>
                  <Button size="sm" variant="ghost" @click="cancelEdit">
                    {{ t("dashboard.servers.detail.infoCancel") }}
                  </Button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-start gap-1.5 min-w-0">
                <span class="text-sm font-mono break-all">{{
                  backend?.token ?? "--"
                }}</span>
                <Button
                  v-if="backend?.token"
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0 mt-0.5"
                  @click="copyText('token', backend?.token)"
                >
                  <Check
                    v-if="copiedKey === 'token'"
                    class="h-3.5 w-3.5 text-green-500"
                  />
                  <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0 mt-0.5"
                  @click="startEdit('token', backend?.token)"
                >
                  <Pencil class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </template>
          </div>
        </div>

        <h2 class="my-2">远程信息</h2>
        <div class="rounded-md border divide-y relative">
          <div
            v-if="serverInfoLoading"
            class="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-md"
          >
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
          <!-- UUID -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoId") }}
            </span>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-sm font-mono">{{ serverUuid ?? "--" }}</span>
              <Button
                v-if="serverUuid"
                size="icon"
                variant="ghost"
                class="h-6 w-6 shrink-0"
                @click="copyText('uuid', serverUuid)"
              >
                <Check
                  v-if="copiedKey === 'uuid'"
                  class="h-3.5 w-3.5 text-green-500"
                />
                <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <!-- IP -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              IP
            </span>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-sm font-mono">{{
                (typeof backend?.url === "string" &&
                  serverInfo[backend?.url]?.ip) ??
                "--"
              }}</span>
              <span class="text-sm font-mono" v-if="local_ws_port"
                >(:{{ local_ws_port }})</span
              >
              <Button
                v-if="serverUuid"
                size="icon"
                variant="ghost"
                class="h-6 w-6 shrink-0"
                @click="
                  copyText(
                    'ip',
                    (typeof backend?.url === 'string' &&
                      serverInfo[backend?.url]?.ip) ||
                      '',
                  )
                "
              >
                <Check
                  v-if="copiedKey === 'ip'"
                  class="h-3.5 w-3.5 text-green-500"
                />
                <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                v-if="serverUuid"
                size="icon"
                variant="ghost"
                class="h-6 w-6 shrink-0"
                title="select as agent config address"
                @click="
                  setAgentConfigWsUrl(
                    'ip-select',
                    (typeof backend?.url === 'string' &&
                      serverInfo[backend?.url]?.ip) ||
                      '',
                  )
                "
              >
                <template v-if="copiedKey === 'ip-select'">
                  <Check
                    v-if="serverInfoLoading"
                    class="h-3.5 w-3.5 text-green-500"
                  />
                  <Loader2 v-else class="h-3.5 w-3.5 animate-spin"></Loader2>
                </template>
                <Cable
                  v-else
                  class="h-3.5 w-3.5 text-muted-foreground"
                  title="select as agent config address"
                />
              </Button>
            </div>
          </div>

          <!-- Agent Config API 地址 -->
          <div class="flex flex-wrap items-center px-4 py-3 gap-4 gap-y-0.5">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoEndpoint") }} <br />[ for agent
              ]
            </span>
            <div
              v-if="editingField === 'agent-url'"
              class="flex flex-wrap items-center py-1 gap-x-4 gap-y-1"
            >
              <Input v-model="editValue" class="h-8 w-64" />
              <Button
                size="sm"
                variant="outline"
                @click="saveEdit('agent-url')"
              >
                {{ t("dashboard.servers.detail.infoSave") }}
              </Button>
              <Button size="sm" variant="ghost" @click="cancelEdit">
                {{ t("dashboard.servers.detail.infoCancel") }}
              </Button>
            </div>
            <template v-else>
              <div
                class="flex items-center gap-1.5 min-w-0"
                v-if="typeof backend?.url === 'string'"
              >
                <span class="text-sm font-mono">{{
                  serverInfo[backend?.url]?.agentConfigWsUrl || "--"
                }}</span>
                <Button
                  v-if="serverInfo[backend?.url]?.agentConfigWsUrl"
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0"
                  @click="
                    copyText(
                      'agent-url',
                      serverInfo[backend?.url]?.agentConfigWsUrl,
                    )
                  "
                >
                  <Check
                    v-if="copiedKey === 'agent-url'"
                    class="h-3.5 w-3.5 text-green-500"
                  />
                  <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-6 w-6 shrink-0"
                  @click="
                    startEdit(
                      'agent-url',
                      serverInfo[backend?.url]?.agentConfigWsUrl || '',
                    )
                  "
                >
                  <Pencil class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </template>
            <div class="w-full"></div>
            <div class="text-xs font-mono text-muted-foreground ml-32">
              添加新的 agent 时使用的 ws_url 配置
            </div>
          </div>

          <!-- 版本号 -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoVersion") }}
            </span>
            <span class="text-sm font-mono">{{ serverVersion ?? "--" }}</span>
          </div>
        </div>
      </TabsContent>

      <!-- Tab: 数据库占用 -->
      <TabsContent value="storage" class="mt-4">
        <DatabaseStorageTab
          :data="storageData"
          :loading="storageLoading"
          @refresh="fetchStorage"
        />
      </TabsContent>

      <!-- Tab: 配置管理 -->
      <TabsContent value="config" class="mt-4">
        <div class="space-y-3">
          <div
            v-if="configLoading"
            class="text-sm text-muted-foreground py-8 text-center"
          >
            {{ t("dashboard.servers.detail.configLoading") }}
          </div>
          <template v-else>
            <div class="rounded-md border overflow-hidden">
              <Codemirror
                v-model="configContent"
                :extensions="editorExtensions"
                :style="{ height: '480px', fontSize: '13px' }"
              />
            </div>
            <div class="flex justify-end">
              <Button :disabled="configSaving" @click="saveConfig">
                <Loader2 v-if="configSaving" class="h-4 w-4 animate-spin" />
                {{ t("dashboard.servers.detail.configSave") }}
              </Button>
            </div>
          </template>
        </div>
      </TabsContent>

      <!-- Tab: 版本升级 -->
      <TabsContent value="version" class="mt-4">
        <div
          class="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground"
        >
          <PackageOpen class="h-16 w-16 opacity-30" />
          <p class="text-sm">
            {{ t("dashboard.servers.detail.versionComingSoon") }}
          </p>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
