<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  Loader2,
  PackageOpen,
  ArrowLeft,
  Copy,
  Check,
  Pencil,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useThemeStore } from "@/stores/theme";
import { Codemirror } from "vue-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { oneDark } from "@codemirror/theme-one-dark";

definePage({
  meta: { title: "router.servers", hidden: true },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { backends, currentBackend } = useBackendStore();
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
};

const activeTab = ref("info");

const copiedKey = ref<string | null>(null);
const copyText = (key: string, text: string | null | undefined) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  copiedKey.value = key;
  setTimeout(() => (copiedKey.value = null), 1500);
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
  editingField.value = null;
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
        @click="router.push('/dashboard/servers')"
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
        <TabsTrigger value="config">{{
          t("dashboard.servers.detail.tabConfig")
        }}</TabsTrigger>
        <TabsTrigger value="version">{{
          t("dashboard.servers.detail.tabVersion")
        }}</TabsTrigger>
      </TabsList>

      <!-- Tab: 基本信息 -->
      <TabsContent value="info" class="mt-4">
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
          <!-- API 地址 -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoEndpoint") }}
            </span>
            <template v-if="editingField === 'url'">
              <Input v-model="editValue" class="h-8 w-64" />
              <Button size="sm" variant="outline" @click="saveEdit('url')">
                {{ t("dashboard.servers.detail.infoSave") }}
              </Button>
              <Button size="sm" variant="ghost" @click="cancelEdit">
                {{ t("dashboard.servers.detail.infoCancel") }}
              </Button>
            </template>
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
              </div>
            </template>
          </div>
          <!-- 版本号 -->
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoVersion") }}
            </span>
            <span class="text-sm font-mono">{{ serverVersion ?? "--" }}</span>
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
