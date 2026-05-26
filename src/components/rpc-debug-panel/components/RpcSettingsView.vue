<script setup lang="ts">
import { Download, Trash2 } from "lucide-vue-next";
import { useRpcDebugStore } from "../rpcDebugStore";
import { downloadText } from "../helpers";

const debugStore = useRpcDebugStore();

function exportRecords() {
  downloadText(
    `nodeget-rpc-debug-${Date.now()}.json`,
    debugStore.exportRecords(),
  );
}
</script>

<template>
  <div class="h-full p-6">
    <section class="rounded-lg border p-5">
      <div class="divide-y">
        <label class="flex min-h-16 items-center justify-between gap-6 py-4">
          <span>
            <span class="block font-medium">最大保留消息数</span>
            <span class="text-sm text-muted-foreground"
              >超过后自动丢弃最旧记录</span
            >
          </span>
          <input
            v-model.number="debugStore.settings.maxRecords"
            class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 w-28"
            type="number"
            min="50"
          />
        </label>
        <label class="flex min-h-16 items-center justify-between gap-6 py-4">
          <span>
            <span class="block font-medium">Token 脱敏</span>
            <span class="text-sm text-muted-foreground"
              >展示和导出时隐藏 token/password/secret 字段</span
            >
          </span>
          <input
            v-model="debugStore.settings.maskTokens"
            type="checkbox"
            class="size-4"
          />
        </label>
        <label class="flex min-h-16 items-center justify-between gap-6 py-4">
          <span>
            <span class="block font-medium">捕获订阅推送</span>
            <span class="text-sm text-muted-foreground"
              >记录无 id 的 JSON-RPC notification</span
            >
          </span>
          <input
            v-model="debugStore.settings.captureNotifications"
            type="checkbox"
            class="size-4"
          />
        </label>
        <label class="flex min-h-16 items-center justify-between gap-6 py-4">
          <span>
            <span class="block font-medium">捕获原始 WS 帧</span>
            <span class="text-sm text-muted-foreground"
              >终端等非 JSON-RPC 帧可能较多，默认关闭</span
            >
          </span>
          <input
            v-model="debugStore.settings.captureRawFrames"
            type="checkbox"
            class="size-4"
          />
        </label>
        <label class="flex min-h-16 items-center justify-between gap-6 py-4">
          <span>
            <span class="block font-medium">格式化 JSON</span>
            <span class="text-sm text-muted-foreground"
              >详情、导出和响应区使用缩进展示</span
            >
          </span>
          <input
            v-model="debugStore.settings.formatJson"
            type="checkbox"
            class="size-4"
          />
        </label>
      </div>
      <div class="mt-6 flex gap-2">
        <button
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          type="button"
          @click="exportRecords"
        >
          <Download class="size-4" />
          导出会话
        </button>
        <button
          class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          type="button"
          @click="debugStore.clear"
        >
          <Trash2 class="size-4" />
          清空存储
        </button>
      </div>
    </section>
  </div>
</template>
