<script setup lang="ts">
import { computed, h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { RefreshCw } from "lucide-vue-next";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import { usePermissionStore, type PermissionRule } from "@/stores/permission";
import { backendKey } from "../helpers";
import { maskToken } from "../rpcDebugStore";
import RpcDebugDataTable from "./RpcDebugDataTable.vue";

const emit = defineEmits<{
  copy: [text: string, message?: string];
}>();

const backendStore = useBackendStore();
const permissionStore = usePermissionStore();

const backendOptions = computed(() => backendStore.backends.value);

async function refreshPermission() {
  await permissionStore.refreshByBackend(backendStore.currentBackend.value);
}

function copyBackendToken(backend: Backend) {
  emit("copy", backend.token, "Token 已复制");
}

const backendColumns = computed<ColumnDef<Backend>[]>(() => [
  {
    id: "name",
    header: "名称",
    size: 86,
    cell: ({ row }) => row.original.name,
    meta: { cellClass: "max-w-[86px] truncate" },
  },
  {
    id: "url",
    header: "WebSocket",
    size: 260,
    cell: ({ row }) => row.original.url,
    meta: { cellClass: "max-w-[280px] truncate font-mono text-xs" },
  },
  {
    id: "token",
    header: "Token",
    size: 150,
    cell: ({ row }) => maskToken(row.original.token),
    meta: { cellClass: "max-w-[150px] truncate font-mono text-xs" },
  },
  {
    id: "actions",
    header: "操作",
    size: 70,
    cell: ({ row }) =>
      h(
        "button",
        {
          class:
            "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
          type: "button",
          onClick: (event: MouseEvent) => {
            event.stopPropagation();
            copyBackendToken(row.original);
          },
        },
        "复制",
      ),
  },
]);

const permissionColumns = computed<ColumnDef<PermissionRule>[]>(() => [
  {
    id: "scope",
    header: "作用域",
    size: 112,
    cell: ({ row }) => `${row.original.scopeType}:${row.original.scopeValue}`,
    meta: { cellClass: "max-w-[140px] truncate" },
  },
  {
    id: "resource",
    header: "资源",
    size: 104,
    cell: ({ row }) => row.original.resource,
    meta: { cellClass: "max-w-[120px] truncate" },
  },
  {
    id: "action",
    header: "动作",
    size: 120,
    cell: ({ row }) => row.original.action,
    meta: { cellClass: "max-w-[140px] truncate" },
  },
  {
    id: "target",
    header: "目标",
    size: 220,
    cell: ({ row }) => row.original.target ?? "-",
    meta: { cellClass: "max-w-[260px] truncate" },
  },
]);
</script>

<template>
  <div class="h-full p-6">
    <div
      class="mb-6 flex items-center justify-between rounded-lg border bg-muted/25 px-5 py-4"
    >
      <div>
        <h2 class="font-semibold">鉴权来源</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          调试面板直接读取项目中已保存的后端凭据，不额外维护 Token。
        </p>
      </div>
      <button
        class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
        type="button"
        @click="refreshPermission"
      >
        <RefreshCw class="size-4" />
        刷新权限
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-[520px_minmax(0,1fr)]">
      <section class="rounded-lg border p-5">
        <h2 class="font-semibold">可用调试凭据</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          来自 useBackendStore.backends
        </p>
        <RpcDebugDataTable
          class="mt-4"
          :columns="backendColumns"
          :data="backendOptions"
          empty-text="暂无可用调试凭证"
          :row-key="(backend) => backendKey(backend)"
        />
      </section>

      <section class="space-y-6">
        <div class="rounded-lg border p-5">
          <div class="flex items-center gap-2">
            <h2 class="font-semibold">当前 Token 信息</h2>
            <span
              v-if="permissionStore.isSuperToken"
              class="inline-flex h-6 items-center rounded bg-emerald-50 px-2 text-xs text-emerald-700 ring-1 ring-emerald-200"
            >
              SuperToken
            </span>
          </div>
          <div class="mt-4 grid gap-2 text-sm">
            <div>
              Token Key：{{ permissionStore.tokenInfo?.token_key ?? "-" }}
            </div>
            <div>用户名：{{ permissionStore.tokenInfo?.username ?? "-" }}</div>
            <div>权限数量：{{ permissionStore.rules.length }}</div>
            <div>状态：{{ permissionStore.status }}</div>
          </div>
        </div>

        <div class="rounded-lg border p-5">
          <h2 class="font-semibold">当前 Token 权限明细</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            SuperToken 专用方法不作为普通权限行展示；这里展示 token_limit
            可枚举权限。
          </p>
          <RpcDebugDataTable
            class="mt-4"
            :columns="permissionColumns"
            :data="permissionStore.rules"
            empty-text="暂无可枚举权限。若当前用户是 root，可使用 SuperToken 专用方法。"
            :row-key="
              (rule, index) =>
                `${rule.scopeType}:${rule.scopeValue}:${rule.resource}:${rule.action}:${rule.target ?? '-'}:${index}`
            "
          />
        </div>
      </section>
    </div>
  </div>
</template>
