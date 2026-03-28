<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Loader2, PackageOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
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
  const token = decodeURIComponent(
    (route.params as { backendId: string }).backendId,
  );
  return backends.value.find((b) => b.token === token) ?? null;
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

const editorExtensions = computed(() => [
  StreamLanguage.define(toml),
  ...(themeStore.isDark ? [oneDark] : []),
]);
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        @click="router.push('/dashboard/servers')"
      >
        {{ t("dashboard.servers.detail.back") }}
      </Button>
      <h1 class="text-2xl font-semibold">
        {{ backend?.name ?? t("dashboard.servers.detail.title") }}
      </h1>
      <Badge v-if="isActive" variant="default">
        {{ t("dashboard.servers.detail.infoActive") }}
      </Badge>
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
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoName") }}
            </span>
            <span class="text-sm font-medium">{{ backend?.name ?? "--" }}</span>
          </div>
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoId") }}
            </span>
            <span class="text-sm font-mono">{{ serverUuid ?? "--" }}</span>
          </div>
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoEndpoint") }}
            </span>
            <span class="text-sm font-mono">{{ backend?.url ?? "--" }}</span>
          </div>
          <div class="flex items-center px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0">
              {{ t("dashboard.servers.detail.infoVersion") }}
            </span>
            <span class="text-sm font-mono">{{ serverVersion ?? "--" }}</span>
          </div>
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
          <div class="flex items-start px-4 py-3 gap-4">
            <span class="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">
              {{ t("dashboard.servers.detail.infoToken") }}
            </span>
            <span class="text-sm font-mono break-all">{{
              backend?.token ?? "--"
            }}</span>
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
