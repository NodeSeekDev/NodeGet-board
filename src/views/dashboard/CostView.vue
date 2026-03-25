<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { toast } from "vue-sonner";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Plus,
  Minus,
} from "lucide-vue-next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { NodeItem } from "@/types/node";
import { useKv } from "@/composables/useKv";
import { useNodeMetadata } from "@/composables/useNodeMetadata";

const kv = useKv();
const { parseMetadataFields, initDefaultMetadata } = useNodeMetadata(kv);

const nodes = ref<NodeItem[]>([]);
const loading = ref(false);
// 排序状态：字段 + 方向，null 表示无排序
type SortField = "price" | "remaining";
type SortDir = "asc" | "desc";
const sortField = ref<SortField | null>(null);
const sortDir = ref<SortDir>("asc");

// 三态切换：asc → desc → 取消
function toggleSort(field: SortField) {
  if (sortField.value !== field) {
    sortField.value = field;
    sortDir.value = "asc";
  } else if (sortDir.value === "asc") {
    sortDir.value = "desc";
  } else {
    sortField.value = null;
  }
}

// 计算距今天剩余天数（负数表示已过期）
function getRemainingDays(expireTime: string): number | null {
  if (!expireTime) return null;
  const expire = new Date(expireTime);
  if (isNaN(expire.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expire.setHours(0, 0, 0, 0);
  return Math.round((expire.getTime() - today.getTime()) / 86400000);
}

// 进度条：当前周期已使用百分比（0~100），到期时倒推 priceCycle 天为起始
function getCycleProgress(expireTime: string, priceCycle: number): number {
  const remaining = getRemainingDays(expireTime);
  if (remaining === null) return 0;
  const total = priceCycle || 30;
  // 已过期显示 100
  if (remaining <= 0) return 100;
  // 剩余比超过1个周期视为刚续费
  if (remaining >= total) return 0;
  return Math.round(((total - remaining) / total) * 100);
}

const sortedNodes = computed(() => {
  const field = sortField.value;
  const dir = sortDir.value;
  if (!field) return [...nodes.value];

  return [...nodes.value].sort((a, b) => {
    let diff = 0;
    if (field === "price") {
      diff = a.price - b.price;
    } else {
      const ra = getRemainingDays(a.expireTime);
      const rb = getRemainingDays(b.expireTime);
      if (ra === null && rb === null) diff = 0;
      else if (ra === null) diff = 1;
      else if (rb === null) diff = -1;
      else diff = ra - rb;
    }
    if (diff !== 0) return dir === "asc" ? diff : -diff;
    return a.name.localeCompare(b.name);
  });
});

// 统计数据
const stats = computed(() => {
  const total = nodes.value.reduce((sum, n) => sum + n.price, 0);
  const avg = nodes.value.length ? total / nodes.value.length : 0;
  const expiringSoon = nodes.value.filter((n) => {
    const r = getRemainingDays(n.expireTime);
    return r !== null && r >= 0 && r <= 30;
  }).length;
  const priceUnit = nodes.value[0]?.priceUnit ?? "$";
  return { total, avg, expiringSoon, priceUnit };
});

async function loadNodes() {
  loading.value = true;
  try {
    const uuids = await kv.listAgentUuids();
    if (!uuids.length) {
      nodes.value = [];
      return;
    }

    const namespaceKeys = uuids.map((uuid) => ({
      namespace: uuid,
      key: "metadata_*",
    }));
    let results: { namespace: string; key: string; value: unknown }[] = [];

    for (let attempt = 0; attempt <= uuids.length; attempt++) {
      try {
        results = await kv.getMultiValue(namespaceKeys);
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const match = msg.match(/Namespace '([^']+)' not found/);
        if (match && attempt < uuids.length) {
          await kv.createNamespace(match[1]!);
          continue;
        }
        throw e;
      }
    }

    const namespacesWithData = new Set(results.map((r) => r.namespace));
    const emptyUuids = uuids.filter((uuid) => !namespacesWithData.has(uuid));
    for (const emptyUuid of emptyUuids) {
      await initDefaultMetadata(emptyUuid);
    }
    if (emptyUuids.length > 0) {
      const newResults = await kv.getMultiValue(
        emptyUuids.map((uuid) => ({ namespace: uuid, key: "metadata_*" })),
      );
      results = [...results, ...newResults];
    }

    const grouped = new Map<string, { key: string; value: unknown }[]>();
    for (const r of results) {
      if (!grouped.has(r.namespace)) grouped.set(r.namespace, []);
      grouped.get(r.namespace)!.push({ key: r.key, value: r.value });
    }

    const parsed: NodeItem[] = [];
    for (const [ns, entries] of grouped) {
      parsed.push({ id: ns, ...parseMetadataFields(entries, ns) });
    }
    nodes.value = parsed;
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "加载节点失败");
    nodes.value = [];
  } finally {
    loading.value = false;
  }
}

// 调整到期时间：+/- 一个计费周期
const adjustLoading = ref<string | null>(null);

async function adjustExpire(node: NodeItem, direction: 1 | -1) {
  const key = node.id + direction;
  adjustLoading.value = key;
  try {
    const current = node.expireTime ? new Date(node.expireTime) : new Date();
    current.setDate(current.getDate() + direction * node.priceCycle);
    const newExpire = current.toISOString().slice(0, 10);

    kv.namespace.value = node.id;
    await kv.setValue("metadata_expire_time", newExpire);

    // 整体重新赋值触发响应式更新
    nodes.value = nodes.value.map((n) =>
      n.id === node.id ? { ...n, expireTime: newExpire } : n,
    );
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "更新失败");
  } finally {
    adjustLoading.value = null;
  }
}

onMounted(loadNodes);
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-auto p-1">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 gap-4">
      <div class="rounded-lg border bg-card p-4 flex items-center gap-3">
        <div class="p-2 rounded-md bg-primary/10">
          <CreditCard class="h-5 w-5 text-primary" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">总费用 / 周期</p>
          <p class="text-xl font-semibold font-mono">
            {{ stats.priceUnit }}{{ stats.total.toFixed(2) }}
          </p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-center gap-3">
        <div class="p-2 rounded-md bg-blue-500/10">
          <TrendingUp class="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">平均每台</p>
          <p class="text-xl font-semibold font-mono">
            {{ stats.priceUnit }}{{ stats.avg.toFixed(2) }}
          </p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-center gap-3">
        <div class="p-2 rounded-md bg-orange-500/10">
          <AlertTriangle class="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">30 天内到期</p>
          <p class="text-xl font-semibold">
            {{ stats.expiringSoon }}
            <span class="text-sm font-normal text-muted-foreground">台</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 排序按钮 -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">排序：</span>
      <Button
        size="sm"
        :variant="sortField === 'remaining' ? 'default' : 'outline'"
        @click="toggleSort('remaining')"
      >
        <ArrowUp
          v-if="sortField === 'remaining' && sortDir === 'asc'"
          class="h-3.5 w-3.5"
        />
        <ArrowDown
          v-else-if="sortField === 'remaining' && sortDir === 'desc'"
          class="h-3.5 w-3.5"
        />
        <ArrowUpDown v-else class="h-3.5 w-3.5" />
        剩余天数
      </Button>
      <Button
        size="sm"
        :variant="sortField === 'price' ? 'default' : 'outline'"
        @click="toggleSort('price')"
      >
        <ArrowUp
          v-if="sortField === 'price' && sortDir === 'asc'"
          class="h-3.5 w-3.5"
        />
        <ArrowDown
          v-else-if="sortField === 'price' && sortDir === 'desc'"
          class="h-3.5 w-3.5"
        />
        <ArrowUpDown v-else class="h-3.5 w-3.5" />
        价格
      </Button>
    </div>

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-16 text-muted-foreground"
    >
      <Loader2 class="h-5 w-5 animate-spin mr-2" />
      加载中...
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="nodes.length === 0"
      class="py-16 text-center text-muted-foreground text-sm"
    >
      暂无节点数据
    </div>

    <!-- 节点列表 -->
    <div v-else class="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>节点名称</TableHead>
            <TableHead class="text-right">价格 / 周期</TableHead>
            <TableHead>到期时间</TableHead>
            <TableHead class="w-48">剩余时间</TableHead>
            <TableHead class="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="node in sortedNodes" :key="node.id">
            <!-- 名称 -->
            <TableCell>
              <RouterLink
                :to="`/dashboard/node/${node.id}/status`"
                class="font-medium hover:underline"
              >
                {{ node.name }}
              </RouterLink>
              <div class="text-xs text-muted-foreground font-mono">
                {{ node.id.slice(-8) }}
              </div>
            </TableCell>

            <!-- 价格 -->
            <TableCell class="text-right font-mono">
              {{ node.priceUnit }}{{ node.price }}
              <span class="text-xs text-muted-foreground">
                / {{ node.priceCycle }}天
              </span>
            </TableCell>

            <!-- 到期时间 -->
            <TableCell>
              <template v-if="node.expireTime">
                <span
                  :class="[
                    'font-mono text-sm',
                    getRemainingDays(node.expireTime) !== null &&
                    getRemainingDays(node.expireTime)! <= 7
                      ? 'text-red-500'
                      : getRemainingDays(node.expireTime) !== null &&
                          getRemainingDays(node.expireTime)! <= 30
                        ? 'text-orange-500'
                        : '',
                  ]"
                >
                  {{ node.expireTime }}
                </span>
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>

            <!-- 剩余时间 + 进度条 -->
            <TableCell>
              <template
                v-if="
                  node.expireTime && getRemainingDays(node.expireTime) !== null
                "
              >
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between text-xs">
                    <template v-if="getRemainingDays(node.expireTime)! < 0">
                      <Badge variant="destructive" class="text-xs px-1.5 py-0">
                        已过期
                        {{ Math.abs(getRemainingDays(node.expireTime)!) }} 天
                      </Badge>
                    </template>
                    <template v-else>
                      <span
                        :class="
                          getRemainingDays(node.expireTime)! <= 7
                            ? 'text-red-500 font-medium'
                            : getRemainingDays(node.expireTime)! <= 30
                              ? 'text-orange-500'
                              : 'text-muted-foreground'
                        "
                      >
                        剩余 {{ getRemainingDays(node.expireTime) }} 天
                      </span>
                    </template>
                  </div>
                  <Progress
                    :model-value="
                      getCycleProgress(node.expireTime, node.priceCycle)
                    "
                    class="h-1.5"
                  />
                </div>
              </template>
              <span v-else class="text-muted-foreground text-sm">未设置</span>
            </TableCell>

            <!-- 操作 -->
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="adjustLoading === node.id + 1"
                  title="到期时间 +1 周期"
                  @click="adjustExpire(node, 1)"
                >
                  <Loader2
                    v-if="adjustLoading === node.id + 1"
                    class="h-3.5 w-3.5 animate-spin"
                  />
                  <Plus v-else class="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="adjustLoading === node.id + -1"
                  title="到期时间 -1 周期"
                  @click="adjustExpire(node, -1)"
                >
                  <Loader2
                    v-if="adjustLoading === node.id + -1"
                    class="h-3.5 w-3.5 animate-spin"
                  />
                  <Minus v-else class="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
