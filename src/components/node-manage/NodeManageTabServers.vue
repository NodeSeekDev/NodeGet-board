<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Wrench, Plus, Trash2, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PopConfirm } from "@/components/ui/pop-confirm";
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
import { useBackendExtra } from "@/composables/useBackendExtra";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { backends, selectBackend, removeBackend, addBackend } =
  useBackendStore();
const { refreshAll, isActive, serverInfo, serverInfoLoading } =
  useBackendExtra();

const addOpen = ref(false);
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
  router.push(
    `/dashboard/servers-detail/${encodeURIComponent(backend.url)}:::${encodeURIComponent(backend.token)}`,
  );
};

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
      }
    } catch {
      // 解码或解析失败时静默忽略
    }
  },
  { immediate: true },
);
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
              <div class="flex items-center justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8"
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
  </div>
</template>
