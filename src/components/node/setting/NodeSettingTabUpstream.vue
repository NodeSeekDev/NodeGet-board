<script setup lang="ts">
import { ref, onMounted } from "vue";
import { toast } from "vue-sonner";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { PopConfirm } from "@/components/ui/pop-confirm";
import {
  useAgentConfig,
  type AgentConfig,
  type BasicAgentConfig,
  type UpstreamServer,
  type splitConfig,
} from "@/composables/useAgentConfig";
import { delay } from "@/lib/delay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "vue-i18n";
import { useBackendStore } from "@/composables/useBackendStore";
import { useBackendExtra } from "@/composables/useBackendExtra";
import { getWsConnection } from "@/composables/useWsConnection";
import { useThemeStore } from "@/stores/theme";
import {
  PackageOpen,
  ArrowLeft,
  Copy,
  Check,
  Pencil,
  RefreshCw,
  CirclePlus,
  Wrench,
  Plus,
  Trash2,
} from "lucide-vue-next";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import UpstreamFormDialog from "@/components/node/setting/UpstreamDetailDialog.vue";

const props = defineProps<{ uuid: string }>();

const { currentBackendInfo } = useBackendExtra();
const agentConfig = ref<splitConfig | null>(null);
const { t } = useI18n();
const { getAgentConfigExtra, writeAgentConfig } = useAgentConfig();

async function refresh() {
  loading.value = true;
  try {
    const config = await getAgentConfigExtra(props.uuid);
    agentConfig.value = config;
  } catch (e: unknown) {
    toast.error(
      e instanceof Error ? e.message : t("dashboard.node.config.loadFailed"),
    );
  } finally {
    loading.value = false;
  }
}

// --- Config ---
const currentUpstreamIndex = ref(0);

const copiedKey = ref<string | null>(null);
const copyText = (
  key: string,
  index: number,
  text: string | null | undefined,
) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  copiedKey.value = key;
  currentUpstreamIndex.value = index;
  setTimeout(() => (copiedKey.value = null), 1500);
};

const loading = ref(false);
const saveLoading = ref(false);

/**
 * 加载 Agent 配置
 */
onMounted(refresh);

// Form dialog
const emptyForm: UpstreamServer = {
  name: "",
  server_uuid: "",
  ws_url: "",
  token: "",
};

const formOpen = ref(false);
const editingUpstream = ref<UpstreamServer>(emptyForm);
const formMode = ref<"create" | "edit">("create");
const saving = ref(false);

const openCreate = () => {
  formMode.value = "create";
  editingUpstream.value = JSON.parse(JSON.stringify(emptyForm));
  formOpen.value = true;
};

const openEdit = (index: number) => {
  if (Array.isArray(agentConfig.value?.upstreams)) {
    formMode.value = "edit";
    editingUpstream.value = JSON.parse(
      JSON.stringify(agentConfig.value.upstreams[index]),
    );
    currentUpstreamIndex.value = index;
    formOpen.value = true;
  }
};

const handleSave = async (newUpstream: UpstreamServer) => {
  if (saveLoading.value) return;
  const server = JSON.parse(
    JSON.stringify(agentConfig.value?.upstreams || []),
  ) as Array<UpstreamServer>;

  if (formMode.value === "edit") {
    const index = currentUpstreamIndex.value;
    server[index] = {
      ...server[index],
      ...newUpstream,
    };
  } else {
    server.push(newUpstream);
  }

  const newAgentConfig: AgentConfig = {
    ...(agentConfig.value?.basicConfig as BasicAgentConfig),
    server,
  };
  saveLoading.value = true;
  try {
    await writeAgentConfig(props.uuid, newAgentConfig);
    toast.success(t("dashboard.cron.createSuccess"));
    formOpen.value = false;
    editingUpstream.value = newUpstream;

    await delay(1500);
    await refresh();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saveLoading.value = false;
  }
};

const handleDelete = async (index: number) => {
  if (saveLoading.value) return;
  let server: Array<any> = JSON.parse(
    JSON.stringify(agentConfig.value?.upstreams || []),
  );
  if (server.length <= 1) {
    toast.error("Must have at least one upstreams");
    return;
  }

  server = server.filter((_, i) => i !== index);

  const newAgentConfig: AgentConfig = {
    ...(agentConfig.value?.basicConfig as BasicAgentConfig),
    server,
  };
  saveLoading.value = true;
  try {
    await writeAgentConfig(props.uuid, newAgentConfig);
    toast.success(t("dashboard.cron.deleteSuccess"));
    formOpen.value = false;
    await delay(1500);
    await refresh();
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : String(e));
  } finally {
    saveLoading.value = false;
  }
};
</script>

<template>
  <div class="max-w-lg space-y-5">
    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" @click="refresh">
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </Button>
      <Button size="sm" @click="openCreate">
        <Plus class="h-4 w-4 mr-1.5" />
        {{ t("dashboard.servers.addServer") }}
      </Button>
    </div>
    <Skeleton class="w-full h-[300px]" v-if="loading" />
    <div
      class="rounded-md border divide-y"
      v-for="(upstream, index) in agentConfig?.upstreams || []"
      v-else
    >
      <!-- 名称 -->
      <div class="flex items-center px-4 py-3 gap-4">
        <span class="text-sm text-muted-foreground w-28 shrink-0">
          {{ t("dashboard.servers.detail.infoName") }}
        </span>
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm font-mono">{{ upstream.name ?? "--" }}</span>
          <Button
            size="icon"
            variant="ghost"
            class="h-6 w-6 shrink-0"
            @click="copyText('name', index, upstream.name)"
          >
            <Check
              v-if="currentUpstreamIndex === index && copiedKey === 'name'"
              class="h-3.5 w-3.5 text-green-500"
            />
            <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <!-- UUID -->
      <div class="flex items-center px-4 py-3 gap-4">
        <span class="text-sm text-muted-foreground w-28 shrink-0">
          {{ t("dashboard.servers.detail.infoId") }}
        </span>
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm font-mono">{{
            upstream.server_uuid ?? "--"
          }}</span>
          <Button
            size="icon"
            variant="ghost"
            class="h-6 w-6 shrink-0"
            @click="copyText('uuid', index, upstream.server_uuid)"
          >
            <Check
              v-if="currentUpstreamIndex === index && copiedKey === 'uuid'"
              class="h-3.5 w-3.5 text-green-500"
            />
            <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <!-- API 地址 -->
      <div class="flex flex-wrap items-center px-4 py-3 gap-4">
        <span class="text-sm text-muted-foreground w-28 shrink-0">
          {{ t("dashboard.servers.detail.infoEndpoint") }}
        </span>
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm font-mono">{{ upstream.ws_url ?? "--" }}</span>
          <Button
            v-if="upstream.ws_url"
            size="icon"
            variant="ghost"
            class="h-6 w-6 shrink-0"
            @click="copyText('url', index, upstream.ws_url)"
          >
            <Check
              v-if="currentUpstreamIndex === index && copiedKey === 'url'"
              class="h-3.5 w-3.5 text-green-500"
            />
            <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <!-- 状态 -->
      <div class="flex items-center px-4 py-3 gap-4">
        <span class="text-sm text-muted-foreground w-28 shrink-0">
          {{ t("dashboard.servers.detail.infoStatus") }}
        </span>
        <Badge
          v-if="upstream.server_uuid === currentBackendInfo?.uuid"
          variant="default"
        >
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
        <div class="flex items-start gap-1.5 min-w-0">
          <span class="text-sm font-mono break-all">{{
            upstream.token ?? "--"
          }}</span>
          <Button
            v-if="upstream.token"
            size="icon"
            variant="ghost"
            class="h-6 w-6 shrink-0 mt-0.5"
            @click="copyText('token', index, upstream.token)"
          >
            <Check
              v-if="currentUpstreamIndex === index && copiedKey === 'token'"
              class="h-3.5 w-3.5 text-green-500"
            />
            <Copy v-else class="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <!-- Operation -->
      <div class="flex items-start px-4 py-3 gap-2 justify-end">
        <Button v-if="upstream.token" @click="openEdit(index)">
          <Pencil class="h-3.5 w-3.5" />
          编辑
        </Button>
        <PopConfirm
          v-if="
            (agentConfig?.upstreams || []).length >= 2 &&
            upstream.token &&
            upstream.server_uuid !== currentBackendInfo?.uuid
          "
          description="confirm delete upstream?"
          @confirm="() => handleDelete(index)"
        >
          <Button variant="destructive">
            <Trash2 class="h-3.5 w-3.5" />
            删除
          </Button>
        </PopConfirm>
      </div>
    </div>

    <UpstreamFormDialog
      v-model:open="formOpen"
      :upstream="editingUpstream"
      :saving="saving"
      :formMode="formMode"
      :nodeUUID="uuid"
      @save="handleSave"
    ></UpstreamFormDialog>

    <!-- <div v-if="agentConfig?.upstreams" class="flex gap-2">
      <pre v-for="upstream in agentConfig.upstreams"
        style="background-color: azure; padding: 10px; border: 1px solid rgba(0,0,0,0.1)">
    {{ JSON.stringify(upstream, null, 4) }}
  </pre>
    </div>
    <div class="pt-2">
      <Button :disabled="saveLoading" @click="handleSave" class="mr-2">
        <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
        Refresh
      </Button>
      <template v-if="agentConfig?.upstreams">
        <Button :disabled="saveLoading" @click="handleSave">
          <Loader2 v-if="saveLoading" class="h-4 w-4 animate-spin mr-2" />
          {{ saveLoading ? $t("dashboard.saving") : $t("dashboard.save") }}
        </Button>
      </template>
    </div> -->
  </div>
</template>
