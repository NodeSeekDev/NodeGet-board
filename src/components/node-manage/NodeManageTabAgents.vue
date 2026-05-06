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
  Plus,
  GripVertical,
  Menu,
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
import { useBackendExtra } from "@/composables/useBackendExtra";
import { getWsConnection } from "@/composables/useWsConnection";
import AddAgentDialog from "@/components/agents/AddAgentDialog.vue";
import { useAgentInfo } from "@/composables/useAgentInfo";

const { t } = useI18n();
const router = useRouter();
const { backends, currentBackend } = useBackendStore();
const currentAgentInfo = useAgentInfo(undefined, {
  withIP: true,
  withVersion: true,
});

const { agents, loading, fetchAgents } = currentAgentInfo;

const searchQuery = ref("");
const selectedUuids = ref<Set<string>>(new Set());
const addAgentOpen = ref(false);
const sortable = ref(false);

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
      <div v-if="hasSelection" class="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          @click="handleBatchAction('upgrade')"
        >
          <ArrowUpFromLine class="h-4 w-4 mr-1.5" />
          {{ t("dashboard.agents.batchUpgrade") }}
        </Button>
        <!-- temp disabled -->
        <Button
          size="sm"
          variant="outline"
          @click="handleBatchAction('move')"
          v-if="false"
        >
          <FolderInput class="h-4 w-4 mr-1.5" />
          {{ t("dashboard.agents.batchMove") }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button size="sm" variant="outline" v-if="false">
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
        <Menu class="h-4 w-4 mr-1.5" />
        {{
          sortable
            ? t("dashboard.agents.sortSave")
            : t("dashboard.agents.sortEdit")
        }}
      </Button>
      <Button @click="addAgentOpen = true">
        <Plus class="h-4 w-4 mr-1.5" />
        {{ t("dashboard.agents.addAgent") }}
      </Button>
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
                :modelValue="allSelected"
                @update:modelValue="(v) => toggleSelectAll(!!v)"
              />
            </TableHead>
            <TableHead>{{ t("dashboard.agents.colId") }}</TableHead>
            <TableHead>{{ t("dashboard.agents.colName") }}</TableHead>
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
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ agent.uuid.slice(0, 8) }}
            </TableCell>
            <TableCell class="font-medium">{{
              agent?.metadata?.customName || "--"
            }}</TableCell>
            <TableCell>
              <Loader2
                v-if="agent.ip === undefined"
                class="h-3.5 w-3.5 animate-spin text-muted-foreground"
              />
              <span v-else-if="agent.ip" class="font-mono text-xs">{{
                agent.ip
              }}</span>
              <span v-else class="text-muted-foreground">--</span>
            </TableCell>
            <TableCell class="text-muted-foreground">{{
              agent.version || "--"
            }}</TableCell>
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
    <AddAgentDialog
      v-if="addAgentOpen"
      v-model:open="addAgentOpen"
      @added="fetchAgents()"
    />
  </div>
</template>
