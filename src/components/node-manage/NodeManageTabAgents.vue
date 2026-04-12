<script setup lang="ts">
import { ref, computed, watch } from "vue";
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
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

const { t } = useI18n();
const router = useRouter();
const { backends, currentBackend } = useBackendStore();

interface AgentInfo {
  uuid: string;
  customName: string;
  serverCount: number;
}

const agents = ref<AgentInfo[]>([]);
const loading = ref(true);
const searchQuery = ref("");
const selectedUuids = ref<Set<string>>(new Set());

const fetchAgents = async () => {
  loading.value = true;

  if (!currentBackend.value) {
    agents.value = [];
    loading.value = false;
    return;
  }

  // 只从当前主控获取 agent UUID 列表
  const conn = getWsConnection(currentBackend.value.url);
  const result = await conn.call<{ uuids: string[] }>(
    "nodeget-server_list_all_agent_uuid",
    { token: currentBackend.value.token },
  );
  const uuids = result?.uuids ?? [];

  // 仍然从所有主控获取 metadata_name
  const nameMap = new Map<string, string>();

  if (uuids.length > 0) {
    const namespaceKeys = uuids.map((uuid) => ({
      namespace: uuid,
      key: "metadata_name",
    }));

    const nameResults = await Promise.allSettled(
      backends.value.map(async (backend) => {
        const conn = getWsConnection(backend.url);
        try {
          const result = await conn.call<
            { namespace: string; key: string; value: unknown }[]
          >("kv_get_multi_value", {
            token: backend.token,
            namespace_key: namespaceKeys,
          });
          return Array.isArray(result) ? result : [];
        } catch {
          return [];
        }
      }),
    );

    for (const res of nameResults) {
      if (res.status !== "fulfilled") continue;
      for (const entry of res.value) {
        if (
          entry.key === "metadata_name" &&
          entry.value &&
          !nameMap.has(entry.namespace)
        ) {
          nameMap.set(entry.namespace, String(entry.value));
        }
      }
    }
  }

  agents.value = uuids.map((uuid) => ({
    uuid,
    customName: nameMap.get(uuid) ?? uuid.slice(0, 8),
    serverCount: 1,
  }));

  loading.value = false;
};

watch(currentBackend, fetchAgents, { immediate: true });

const filteredAgents = computed(() => {
  const q = searchQuery.value.toLowerCase();
  if (!q) return agents.value;
  return agents.value.filter(
    (a) =>
      a.customName.toLowerCase().includes(q) ||
      a.uuid.toLowerCase().includes(q),
  );
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
  toast.info(t("dashboard.agents.devInProgress"));
};

const handleSettings = (uuid: string) => {
  router.push(`/dashboard/node/${uuid}/setting`);
};

defineExpose({ fetchAgents });
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <div class="relative flex-1 max-w-sm">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        />
        <Input
          v-model="searchQuery"
          :placeholder="t('dashboard.agents.searchPlaceholder')"
          class="pl-8"
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="fetchAgents"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
      </Button>
      <div v-if="hasSelection" class="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          @click="handleBatchAction('upgrade')"
        >
          <ArrowUpFromLine class="h-4 w-4 mr-1.5" />
          {{ t("dashboard.agents.batchUpgrade") }}
        </Button>
        <Button size="sm" variant="outline" @click="handleBatchAction('move')">
          <FolderInput class="h-4 w-4 mr-1.5" />
          {{ t("dashboard.agents.batchMove") }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button size="sm" variant="outline">
              <Copy class="h-4 w-4 mr-1.5" />
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
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-12 text-muted-foreground"
    >
      <Loader2 class="h-5 w-5 animate-spin mr-2" />
      {{ t("common.loading") }}
    </div>

    <div
      v-else-if="agents.length === 0"
      class="py-12 text-center text-muted-foreground text-sm"
    >
      {{ t("dashboard.agents.noAgents") }}
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[40px]">
              <Checkbox
                :checked="allSelected"
                @update:checked="toggleSelectAll"
              />
            </TableHead>
            <TableHead>{{ t("dashboard.agents.colId") }}</TableHead>
            <TableHead>{{ t("dashboard.agents.colName") }}</TableHead>
            <TableHead>{{ t("dashboard.agents.colVersion") }}</TableHead>
            <TableHead class="text-right">{{
              t("dashboard.agents.colActions")
            }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableEmpty v-if="filteredAgents.length === 0" :colspan="5">
            {{ t("dashboard.agents.noAgents") }}
          </TableEmpty>
          <TableRow v-for="agent in filteredAgents" :key="agent.uuid">
            <TableCell>
              <Checkbox
                :checked="selectedUuids.has(agent.uuid)"
                @update:checked="(v: boolean) => toggleSelect(agent.uuid, v)"
              />
            </TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ agent.uuid.slice(0, 8) }}
            </TableCell>
            <TableCell class="font-medium">{{ agent.customName }}</TableCell>
            <TableCell class="text-muted-foreground">--</TableCell>
            <TableCell class="text-right">
              <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                @click="handleSettings(agent.uuid)"
              >
                <Settings class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
