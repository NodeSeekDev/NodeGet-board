<script setup lang="ts">
import { DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { computed, ref, watch } from "vue";
import {
  CheckCircle2,
  XCircle,
  Hash,
  Clock,
  Activity,
  Terminal,
  AlertCircle,
  Inbox,
  Loader2,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  useCronHistory,
  type CrontabResult,
  type TaskQueryResult,
} from "@/composables/useCronHistory";
import {
  useAgentConfig,
  type AgentConfig,
  type BasicAgentConfig,
  type UpstreamServer,
  type splitConfig,
} from "@/composables/useAgentConfig";
import { useI18n } from "vue-i18n";
import {
  useBackendExtra,
  type ServerInfo,
} from "@/composables/useBackendExtra";
import { preGenerateToken } from "@/components/agents/generateToken";

const props = defineProps<{
  open: boolean;
  saving: boolean;
  formMode: "edit" | "create";
  nodeUUID: string;
  upstream: UpstreamServer;
}>();

const form = ref<UpstreamServer>(props.upstream);

const errors = ref<Record<string, string>>({});
const { t } = useI18n();

const { serverInfo } = useBackendExtra();

const customKey = crypto.randomUUID();

const availableServerInfo = computed(() => {
  const upstreams = Array.from(Object.values(serverInfo.value));
  upstreams.push({
    name: "custom",
    url: "",
    token: "",
    uuid: customKey,
    version: null,
    ip: null,
    agentConfigWsUrl: null,
  });
  return upstreams;
});

const upstreamSelected = ref<string>(
  availableServerInfo.value[0]?.uuid as string,
);

watch(
  upstreamSelected,
  async (val) => {
    if (val === customKey) {
      form.value.name = "";
      form.value.ws_url = "";
      form.value.server_uuid = "";
      form.value.token = "";
      return;
    }
    const target = availableServerInfo.value.find((v) => v.uuid === val);
    form.value.name = target?.name || "";
    form.value.ws_url = target?.agentConfigWsUrl || "";
    form.value.server_uuid = target?.uuid || "";
    form.value.token =
      (await preGenerateToken(props.nodeUUID, ref(target as ServerInfo))) || "";
  },
  {
    immediate: true,
  },
);

const validateForm = (): boolean => {
  errors.value = {};

  if (!form.value.name.trim()) {
    errors.value.name = t("dashboard.scripts.nameRequired");
  } else if (props.upstream.name.includes("*")) {
    errors.value.name = t("dashboard.scripts.nameCannotContainAsterisk");
  }

  if (!form.value.server_uuid.trim()) {
    errors.value.uuid = "UUID cant't be empty";
  }
  if (!form.value.ws_url.trim()) {
    errors.value.ws = "ws cant't be empty";
  }
  if (!form.value.token.trim()) {
    errors.value.token = "token cant't be empty";
  }
  console.log(Object.keys(errors.value).length);
  return Object.keys(errors.value).length === 0;
};

const handleSave = async () => {
  if (!validateForm()) return;
  emit("save", {
    name: form.value.name,
    server_uuid: form.value.server_uuid,
    token: form.value.token,
    ws_url: form.value.ws_url,
  });
};

const emit = defineEmits<{
  (e: "update:open", val: boolean): void;
  (e: "save", val: UpstreamServer): void;
}>();

watch(
  () => props.upstream,
  (val) => {
    form.value = JSON.parse(JSON.stringify(props.upstream));
    errors.value = {};
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{
            formMode === "edit" ? "Edit Upstream Server" : "Add Upstream Server"
          }}
        </DialogTitle>
        <!-- <DialogDescription>
        </DialogDescription> -->
      </DialogHeader>
      <div class="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
        <div class="space-y-1.5" v-if="formMode === 'create'">
          <Label>Select Upstream Server</Label>
          <Select v-model="upstreamSelected">
            <SelectTrigger class="w-full" :disabled="saving">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="upstream in availableServerInfo"
                :value="upstream.uuid"
                >{{ upstream.name }}</SelectItem
              >
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.servers.detail.infoName") }}</Label>
          <Input v-model="form.name" />
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.servers.detail.infoId") }}</Label>
          <Input v-model="form.server_uuid" />
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.servers.detail.infoEndpoint") }}</Label>
          <Input v-model="form.ws_url" />
        </div>
        <div class="space-y-1.5">
          <Label>{{ t("dashboard.servers.detail.infoToken") }}</Label>
          <Input v-model="form.token" />
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          :disabled="saving"
          @click="emit('update:open', false)"
          >{{ t("dashboard.scripts.cancel") }}</Button
        >
        <Button :disabled="saving" @click="handleSave">
          <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />
          {{ saving ? t("dashboard.saving") : t("dashboard.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
