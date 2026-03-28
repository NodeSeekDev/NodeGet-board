<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Router, Wrench, Plus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { getWsConnection } from "@/composables/useWsConnection";

definePage({
  meta: {
    title: "router.servers",
    icon: Router,
    order: 3,
    group: "router.group.nodeManage",
  },
});

const { t } = useI18n();
const router = useRouter();
const { backends, currentBackend, selectBackend } = useBackendStore();

const addOpen = ref(false);

interface ServerVersionInfo {
  cargo_version: string;
  git_commit_sha: string;
  binary_type: string;
}

interface ServerInfo {
  uuid: string | null;
  version: string | null;
}

const serverInfo = ref<Record<string, ServerInfo>>({});

const fetchServerInfo = (backend: Backend) => {
  const conn = getWsConnection(backend.url);
  Promise.all([
    conn.call<string>("nodeget-server_uuid", []),
    conn.call<ServerVersionInfo>("nodeget-server_version", []),
  ])
    .then(([uuid, ver]) => {
      serverInfo.value[backend.url] = {
        uuid,
        version: `${ver.cargo_version}-${ver.git_commit_sha}`,
      };
    })
    .catch(() => {
      serverInfo.value[backend.url] = { uuid: null, version: null };
    });
};

watch(backends, (list) => list.forEach(fetchServerInfo), { immediate: true });

const isActive = (backend: Backend) =>
  currentBackend.value?.url === backend.url &&
  currentBackend.value?.token === backend.token;

const handleManage = (backend: Backend) => {
  router.push(`/dashboard/servers-detail/${encodeURIComponent(backend.token)}`);
};
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">
          {{ t("dashboard.servers.title") }}
        </h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t("dashboard.servers.desc") }}
        </p>
      </div>
      <Button @click="addOpen = true">
        <Plus class="h-4 w-4 mr-1.5" />
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
            <TableCell class="font-medium">{{ backend.name }}</TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ serverInfo[backend.url]?.uuid ?? "--" }}
            </TableCell>
            <TableCell
              class="font-mono text-xs max-w-[200px] truncate"
              :title="backend.url"
            >
              {{ backend.url }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ serverInfo[backend.url]?.version ?? "--" }}
            </TableCell>
            <TableCell>
              <Badge v-if="isActive(backend)" variant="default">
                {{ t("dashboard.servers.active") }}
              </Badge>
              <Button
                v-else
                size="sm"
                variant="secondary"
                @click="selectBackend(backend)"
              >
                {{ t("dashboard.servers.select") }}
              </Button>
            </TableCell>
            <TableCell class="text-right">
              <Button
                size="icon"
                variant="ghost"
                class="h-8 w-8"
                @click="handleManage(backend)"
              >
                <Wrench class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <BackendSwitcher v-model:open="addOpen" />
  </div>
</template>
