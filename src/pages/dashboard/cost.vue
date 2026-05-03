<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  TrendingUp,
} from "lucide-vue-next";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useKv } from "@/composables/useKv";
import { useNodeMetadata } from "@/composables/useNodeMetadata";
import type { NodeItem } from "@/types/node";
import {
  aggregateCosts,
  buildFrankfurterUrl,
  createFxSnapshot,
  currencyFromPriceUnit,
  currencySymbol,
  DEFAULT_BASE_CURRENCY,
  FX_PROVIDER,
  formatDateOnly,
  GLOBAL_KV_COST_BASE_CURRENCY,
  GLOBAL_KV_COST_FX_CACHE,
  getCycleProgress,
  getRemainingDays,
  isFxSnapshotFresh,
  normalizeBaseCurrency,
  parseFxSnapshot,
  supportedCurrenciesForNodes,
  SUPPORTED_BASE_CURRENCIES,
  type BaseCurrency,
  type EvaluatedCostNode,
  type FrankfurterLatestResponse,
  type FxSnapshot,
} from "@/utils/costSummary";

definePage({
  meta: {
    title: "router.cost",
    icon: CreditCard,
    order: 7,
    group: "router.group.tools",
  },
});

const kv = useKv();
const { initDefaultMetadata, parseMetadataFields } = useNodeMetadata(kv);

const nodes = ref<NodeItem[]>([]);
const loading = ref(false);
const fxLoading = ref(false);
const fxState = ref<"idle" | "loading" | "live" | "cached" | "grouped">("idle");
const fxMessage = ref<string | null>(null);
const baseCurrency = ref<BaseCurrency>(DEFAULT_BASE_CURRENCY);
const fxSnapshot = ref<FxSnapshot | null>(null);

type SortField = "price" | "remaining";
type SortDir = "asc" | "desc";

const sortField = ref<SortField | null>(null);
const sortDir = ref<SortDir>("asc");

const globalNamespace = "global";

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

function formatAmount(symbol: string, value: number): string {
  return `${symbol}${value.toFixed(2)}`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNodeNames(names: string[], limit = 5): string {
  if (names.length <= limit) return names.join("、");
  return `${names.slice(0, limit).join("、")} 等 ${names.length} 台`;
}

async function ensureGlobalNamespace() {
  await kv.fetchNamespaces();
  if (!kv.namespaces.value.includes(globalNamespace)) {
    await kv.createNamespace(globalNamespace);
    kv.namespaces.value.push(globalNamespace);
  }
}

async function loadNodes() {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const match = message.match(/Namespace '([^']+)' not found/);
      if (match && attempt < uuids.length) {
        await kv.createNamespace(match[1]!);
        continue;
      }
      throw error;
    }
  }

  const namespacesWithData = new Set(results.map((row) => row.namespace));
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
  for (const row of results) {
    if (!grouped.has(row.namespace)) grouped.set(row.namespace, []);
    grouped.get(row.namespace)!.push({ key: row.key, value: row.value });
  }

  const parsed: NodeItem[] = [];
  for (const [namespace, entries] of grouped) {
    parsed.push({ id: namespace, ...parseMetadataFields(entries, namespace) });
  }
  nodes.value = parsed;
}

async function loadCostSettings() {
  await ensureGlobalNamespace();
  kv.namespace.value = globalNamespace;

  const [rawBaseCurrency, rawFxCache] = await Promise.all([
    kv.getValue(GLOBAL_KV_COST_BASE_CURRENCY).catch(() => null),
    kv.getValue(GLOBAL_KV_COST_FX_CACHE).catch(() => null),
  ]);

  const parsedBaseCurrency =
    normalizeBaseCurrency(rawBaseCurrency) ?? DEFAULT_BASE_CURRENCY;
  baseCurrency.value = parsedBaseCurrency;
  fxSnapshot.value = parseFxSnapshot(rawFxCache);

  if (normalizeBaseCurrency(rawBaseCurrency) !== parsedBaseCurrency) {
    await kv.setValue(GLOBAL_KV_COST_BASE_CURRENCY, parsedBaseCurrency);
  }
}

async function saveBaseCurrency(value: BaseCurrency) {
  await ensureGlobalNamespace();
  kv.namespace.value = globalNamespace;
  await kv.setValue(GLOBAL_KV_COST_BASE_CURRENCY, value);
}

async function saveFxSnapshot(snapshot: FxSnapshot) {
  await ensureGlobalNamespace();
  kv.namespace.value = globalNamespace;
  await kv.setValue(GLOBAL_KV_COST_FX_CACHE, snapshot);
}

const effectiveFxSnapshot = computed(() => {
  if (!fxSnapshot.value) return null;
  return fxSnapshot.value.base === baseCurrency.value ? fxSnapshot.value : null;
});

async function refreshFxRates(showToast = false) {
  const hasSupportedCurrency = nodes.value.some((node) =>
    currencyFromPriceUnit(node.priceUnit),
  );

  const targets = supportedCurrenciesForNodes(nodes.value, baseCurrency.value);
  if (!hasSupportedCurrency) {
    fxState.value = "grouped";
    fxMessage.value = "当前节点价格单位均不支持折算，已退化为按币种分组汇总。";
    fxSnapshot.value = null;
    return;
  }

  fxLoading.value = true;
  fxState.value = "loading";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(buildFrankfurterUrl(baseCurrency.value, targets), {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`汇率接口返回 ${response.status}`);
    }
    const data = (await response.json()) as FrankfurterLatestResponse;
    const snapshot = createFxSnapshot(baseCurrency.value, data);
    fxSnapshot.value = snapshot;
    fxState.value = "live";
    fxMessage.value = null;
    await saveFxSnapshot(snapshot);
    if (showToast) {
      toast.success("汇率已刷新");
    }
  } catch (error: unknown) {
    const cachedSnapshot = effectiveFxSnapshot.value;
    if (cachedSnapshot) {
      fxState.value = "cached";
      fxSnapshot.value = cachedSnapshot;
      fxMessage.value = isFxSnapshotFresh(cachedSnapshot)
        ? `实时汇率拉取失败，当前使用最近一次缓存汇率（${formatTimestamp(
            cachedSnapshot.fetched_at,
          )}）。`
        : `实时汇率拉取失败，当前使用已过期缓存汇率（${formatTimestamp(
            cachedSnapshot.fetched_at,
          )}）。`;
    } else {
      fxState.value = "grouped";
      fxSnapshot.value = null;
      fxMessage.value =
        "实时汇率暂不可用，当前退化为按币种分组汇总，不显示跨币种总额。";
    }

    if (showToast) {
      toast.error(error instanceof Error ? error.message : "汇率刷新失败");
    }
  } finally {
    clearTimeout(timeout);
    fxLoading.value = false;
  }
}

async function handleBaseCurrencyChange(value: unknown) {
  const normalized = normalizeBaseCurrency(value);
  if (!normalized || normalized === baseCurrency.value) return;

  baseCurrency.value = normalized;
  try {
    await saveBaseCurrency(normalized);
    await refreshFxRates();
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : "保存基准币种失败");
  }
}

const stats = computed(() =>
  aggregateCosts(
    nodes.value,
    baseCurrency.value,
    fxState.value === "grouped" ? null : effectiveFxSnapshot.value,
  ),
);

const sortedNodes = computed<EvaluatedCostNode[]>(() => {
  const field = sortField.value;
  const dir = sortDir.value;
  const list = [...stats.value.evaluatedNodes];
  if (!field) return list;

  return list.sort((left, right) => {
    let diff = 0;
    if (field === "price") {
      if (left.monthlyCostBase === null && right.monthlyCostBase === null) diff = 0;
      else if (left.monthlyCostBase === null) diff = 1;
      else if (right.monthlyCostBase === null) diff = -1;
      else diff = left.monthlyCostBase - right.monthlyCostBase;
    } else {
      const leftRemaining = getRemainingDays(left.expireTime);
      const rightRemaining = getRemainingDays(right.expireTime);
      if (leftRemaining === null && rightRemaining === null) diff = 0;
      else if (leftRemaining === null) diff = 1;
      else if (rightRemaining === null) diff = -1;
      else diff = leftRemaining - rightRemaining;
    }
    if (diff !== 0) return dir === "asc" ? diff : -diff;
    return left.name.localeCompare(right.name);
  });
});

const summaryAlerts = computed(() => {
  const alerts: string[] = [];
  if (fxMessage.value) {
    alerts.push(fxMessage.value);
  }
  if (stats.value.unsupportedNodeNames.length > 0) {
    alerts.push(
      `以下节点币种暂不支持折算，已从统一总额排除：${formatNodeNames(
        stats.value.unsupportedNodeNames,
      )}。`,
    );
  }
  if (stats.value.missingRateNodeNames.length > 0) {
    alerts.push(
      `以下节点缺少 ${baseCurrency.value} 汇率，已从统一总额排除：${formatNodeNames(
        stats.value.missingRateNodeNames,
      )}。`,
    );
  }
  return alerts;
});

const baseCurrencySymbol = computed(() => currencySymbol(baseCurrency.value));

const adjustLoading = ref<string | null>(null);

async function adjustExpire(
  node: Pick<NodeItem, "id" | "expireTime" | "priceCycle">,
  direction: 1 | -1,
) {
  const key = `${node.id}:${direction}`;
  adjustLoading.value = key;
  try {
    const current = node.expireTime ? new Date(`${node.expireTime}T00:00:00`) : new Date();
    current.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + direction * node.priceCycle);
    const newExpire = formatDateOnly(current);

    kv.namespace.value = node.id;
    await kv.setValue("metadata_expire_time", newExpire);

    nodes.value = nodes.value.map((item) =>
      item.id === node.id ? { ...item, expireTime: newExpire } : item,
    );
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : "更新失败");
  } finally {
    adjustLoading.value = null;
  }
}

async function initialize() {
  loading.value = true;
  try {
    await loadNodes();
    await loadCostSettings();
    await refreshFxRates();
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : "加载成本数据失败");
    nodes.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(initialize);
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden p-1">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm text-muted-foreground">基准币种：</span>
      <Select
        :model-value="baseCurrency"
        @update:model-value="handleBaseCurrencyChange"
      >
        <SelectTrigger class="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="currency in SUPPORTED_BASE_CURRENCIES"
            :key="currency"
            :value="currency"
          >
            {{ currency }} ({{ currencySymbol(currency) }})
          </SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        :disabled="fxLoading || loading"
        @click="refreshFxRates(true)"
      >
        <Loader2 v-if="fxLoading" class="h-3.5 w-3.5 animate-spin" />
        <template v-else>刷新汇率</template>
      </Button>
      <Badge v-if="fxState === 'live'" variant="secondary">实时汇率</Badge>
      <Badge v-else-if="fxState === 'cached'" variant="secondary">缓存汇率</Badge>
      <Badge v-else-if="fxState === 'grouped'" variant="secondary">
        按币种分组
      </Badge>
      <span
        v-if="effectiveFxSnapshot"
        class="text-xs text-muted-foreground"
      >
        汇率来源：{{ FX_PROVIDER }}，更新于
        {{ formatTimestamp(effectiveFxSnapshot.fetched_at) }}
      </span>
    </div>

    <Alert v-if="summaryAlerts.length > 0">
      <AlertTriangle class="h-4 w-4" />
      <AlertTitle>成本汇总说明</AlertTitle>
      <AlertDescription class="space-y-1">
        <p v-for="message in summaryAlerts" :key="message">
          {{ message }}
        </p>
      </AlertDescription>
    </Alert>

    <div
      v-if="stats.unified"
      class="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      <div class="rounded-lg border bg-card p-4 flex items-center gap-3">
        <div class="p-2 rounded-md bg-primary/10">
          <CreditCard class="h-5 w-5 text-primary" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">折算月成本</p>
          <p class="text-xl font-semibold font-mono">
            {{ formatAmount(baseCurrencySymbol, stats.totalMonthlyCost) }}
          </p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-center gap-3">
        <div class="p-2 rounded-md bg-blue-500/10">
          <TrendingUp class="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">平均每台 / 月</p>
          <p class="text-xl font-semibold font-mono">
            {{ formatAmount(baseCurrencySymbol, stats.avgMonthlyCost) }}
          </p>
        </div>
      </div>

      <div class="rounded-lg border bg-card p-4 flex items-center gap-3">
        <div class="p-2 rounded-md bg-green-500/10">
          <TrendingUp class="h-5 w-5 text-green-500" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">折算剩余价值</p>
          <p class="text-xl font-semibold font-mono">
            {{ formatAmount(baseCurrencySymbol, stats.totalRemainingValue) }}
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

    <div
      v-else
      class="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      <div
        v-for="group in stats.groupedMonthlyTotals"
        :key="group.currency"
        class="rounded-lg border bg-card p-4 flex items-center gap-3"
      >
        <div class="p-2 rounded-md bg-primary/10">
          <CreditCard class="h-5 w-5 text-primary" />
        </div>
        <div>
          <p class="text-xs text-muted-foreground">{{ group.currency }} 月成本</p>
          <p class="text-xl font-semibold font-mono">
            {{ formatAmount(group.symbol, group.monthlyCost) }}
          </p>
          <p class="text-xs text-muted-foreground">
            剩余价值 {{ formatAmount(group.symbol, group.remainingValue) }} ·
            {{ group.count }} 台
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
        折算月成本
      </Button>
    </div>

    <div
      v-if="loading"
      class="flex items-center justify-center py-16 text-muted-foreground"
    >
      <Loader2 class="h-5 w-5 animate-spin mr-2" />
      加载中...
    </div>

    <div
      v-else-if="nodes.length === 0"
      class="py-16 text-center text-muted-foreground text-sm"
    >
      暂无节点数据
    </div>

    <div
      v-else
      class="flex-1 min-h-0 rounded-md border bg-card overflow-auto cost-table-wrap"
    >
      <Table>
        <TableHeader class="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead>节点名称</TableHead>
            <TableHead class="text-right">价格 / 周期</TableHead>
            <TableHead>到期时间</TableHead>
            <TableHead class="text-right">折算剩余价值</TableHead>
            <TableHead class="w-48">剩余时间占比</TableHead>
            <TableHead class="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="node in sortedNodes" :key="node.id">
            <TableCell>
              <RouterLink
                :to="`/dashboard/node/${node.id}/setting`"
                class="font-medium hover:underline"
              >
                {{ node.name }}
              </RouterLink>
              <div class="text-xs text-muted-foreground font-mono">
                {{ node.id.slice(-8) }}
              </div>
            </TableCell>

            <TableCell class="text-right font-mono">
              <div>
                {{ node.priceUnit }}{{ node.price.toFixed(2) }}
                <span class="text-xs text-muted-foreground">
                  / {{ node.priceCycle }}天
                </span>
              </div>
              <div
                v-if="node.monthlyCostBase !== null"
                class="text-xs text-muted-foreground"
              >
                ≈ {{ formatAmount(baseCurrencySymbol, node.monthlyCostBase) }} / 30天
              </div>
            </TableCell>

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

            <TableCell class="text-right font-mono">
              <template v-if="node.remainingValueBase !== null">
                <div>{{ formatAmount(baseCurrencySymbol, node.remainingValueBase) }}</div>
                <div class="text-xs text-muted-foreground">按当前汇率折算</div>
              </template>
              <template v-else-if="node.excludedReason === 'unsupported_currency'">
                <span class="text-muted-foreground">不支持该币种</span>
              </template>
              <template v-else>
                <span class="text-muted-foreground">等待汇率</span>
              </template>
            </TableCell>

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
                  <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="
                        getRemainingDays(node.expireTime) === null ||
                        getRemainingDays(node.expireTime)! > 30
                          ? 'bg-green-500'
                          : getRemainingDays(node.expireTime)! > 15
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                      "
                      :style="`width: ${getCycleProgress(node.expireTime, node.priceCycle)}%`"
                    />
                  </div>
                </div>
              </template>
              <span v-else class="text-muted-foreground text-sm">未设置</span>
            </TableCell>

            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="adjustLoading === `${node.id}:1`"
                  title="到期时间 +1 周期"
                  @click="adjustExpire(node, 1)"
                >
                  <Loader2
                    v-if="adjustLoading === `${node.id}:1`"
                    class="h-3.5 w-3.5 animate-spin"
                  />
                  <Plus v-else class="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  class="h-7 w-7"
                  :disabled="adjustLoading === `${node.id}:-1`"
                  title="到期时间 -1 周期"
                  @click="adjustExpire(node, -1)"
                >
                  <Loader2
                    v-if="adjustLoading === `${node.id}:-1`"
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

<style scoped>
.cost-table-wrap :deep([data-slot="table-container"]) {
  overflow: visible;
}
</style>
