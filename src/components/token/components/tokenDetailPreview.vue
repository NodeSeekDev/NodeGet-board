<script setup lang="ts">
import { computed } from "vue";
import { Eye, ScanEye } from "lucide-vue-next";
import type {
  PermissionEntry,
  Token,
  TokenDetail,
  TokenLimitEntry,
} from "../type";
import {
  detectTokenPermissionTemplate,
  TOKEN_PERMISSION_TEMPLATE_OPTIONS,
} from "../tokenPermissionTemplates";
import { detectScopeTab } from "../scopeUi";
import { createPermissionBuckets } from "./permissions/permissionsState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type PermissionSection = {
  title: string;
  items: string[];
};

const props = withDefaults(
  defineProps<{
    token: Token;
    rawDetail?: TokenDetail | Record<string, unknown> | null;
    loading?: boolean;
  }>(),
  {
    rawDetail: null,
    loading: false,
  },
);

const templateLabelMap = new Map(
  TOKEN_PERMISSION_TEMPLATE_OPTIONS.map((item) => [item.value, item.label]),
);

const displayText = (
  value: string | number | null | undefined,
  fallback = "-",
) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  return String(value);
};

const formatTimestamp = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return "未设置";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "未设置";
  return date.toLocaleString("zh-CN", { hour12: false });
};

const formatScopeLabels = (limit: TokenLimitEntry) => {
  if (!Array.isArray(limit.scopes) || limit.scopes.length === 0) {
    return ["未设置"];
  }

  return limit.scopes.map((item) => {
    if ("global" in item) return "Global";
    if ("agent_uuid" in item) return `Agent: ${item.agent_uuid}`;
    if ("kv_namespace" in item) return `Kv: ${item.kv_namespace}`;
    return "未知作用域";
  });
};

const formatPermissionEntry = (entry: PermissionEntry) => {
  const [resource, rawValue] = Object.entries(entry)[0] ?? [];
  if (!resource) return JSON.stringify(entry);

  if (typeof rawValue === "string") {
    return rawValue.charAt(0).toUpperCase() + rawValue.slice(1);
  }

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return JSON.stringify(rawValue);
  }

  const [action, target] = Object.entries(rawValue)[0] ?? [];
  if (!action) return JSON.stringify(rawValue);
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  return target ? `${actionLabel}: ${target}` : actionLabel;
};

const buildPermissionSections = (permissions: PermissionEntry[]) => {
  const buckets = createPermissionBuckets(permissions);
  const sections: Array<{ title: string; entries: PermissionEntry[] }> = [
    { title: "静态监控", entries: buckets.staticMonitoringPermissions },
    { title: "动态监控", entries: buckets.dynamicMonitoringPermissions },
    { title: "Task", entries: buckets.taskPermissions },
    { title: "Crontab", entries: buckets.crontabPermissions },
    { title: "CrontabResult", entries: buckets.crontabResultPermissions },
    { title: "Kv", entries: buckets.kvPermissions },
    { title: "Terminal", entries: buckets.terminalPermissions },
    { title: "NodeGet", entries: buckets.nodeGetPermissions },
    { title: "未识别权限", entries: buckets.unknownPermissions },
  ];

  return sections
    .map<PermissionSection>((section) => ({
      title: section.title,
      items: section.entries.map(formatPermissionEntry),
    }))
    .filter((section) => section.items.length > 0);
};

const tokenLimitDetails = computed(() => {
  return (props.token.token_limit ?? []).map((limit, index) => {
    const scopeTab = detectScopeTab(limit.scopes, "Global");
    const template = detectTokenPermissionTemplate(limit, scopeTab);
    return {
      index,
      scopes: formatScopeLabels(limit),
      permissions: buildPermissionSections(limit.permissions ?? []),
      permissionsCount: (limit.permissions ?? []).length,
      templateLabel: templateLabelMap.get(template) ?? "自定义",
    };
  });
});

const previewJson = computed(() =>
  JSON.stringify(props.rawDetail ?? props.token ?? {}, null, 2),
);

const rawSummary = computed(() => {
  const detail = props.rawDetail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return {};
  }

  return detail as Partial<TokenDetail>;
});
</script>

<template>
  <div
    v-if="loading"
    class="flex min-h-[320px] flex-col items-center justify-center gap-3"
  >
    <Spinner />
    <div class="text-sm text-muted-foreground">正在加载 Token 详情...</div>
  </div>

  <div v-else class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
    <div class="min-w-0 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Eye class="h-5 w-5" />
            基础信息
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">Token Key</div>
            <div class="font-mono text-sm break-all">
              {{ displayText(rawSummary.token_key) }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">Version</div>
            <div class="text-sm">
              {{ displayText(rawSummary.version ?? token.version) }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">Username</div>
            <div class="text-sm">
              {{ displayText(rawSummary.username ?? token.username, "未设置") }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">Token Limit 数量</div>
            <div class="text-sm">{{ token.token_limit.length }}</div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">生效时间</div>
            <div class="text-sm">
              {{
                formatTimestamp(
                  rawSummary.timestamp_from ?? token.timestamp_from,
                )
              }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">失效时间</div>
            <div class="text-sm">
              {{
                formatTimestamp(rawSummary.timestamp_to ?? token.timestamp_to)
              }}
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <Card
          v-for="limit in tokenLimitDetails"
          :key="`token-limit-${limit.index}`"
        >
          <CardHeader>
            <div
              class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
            >
              <CardTitle>权限 {{ limit.index + 1 }}</CardTitle>
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant="secondary"
                  >模版: {{ limit.templateLabel }}</Badge
                >
                <Badge variant="outline"
                  >权限数: {{ limit.permissionsCount }}</Badge
                >
              </div>
            </div>
          </CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <div class="text-xs text-muted-foreground">作用域</div>
              <div class="flex flex-wrap gap-2">
                <Badge
                  v-for="scope in limit.scopes"
                  :key="`${limit.index}-${scope}`"
                  variant="secondary"
                >
                  {{ scope }}
                </Badge>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div
                v-for="section in limit.permissions"
                :key="`${limit.index}-${section.title}`"
                class="rounded-lg border p-3"
              >
                <div class="mb-3 text-sm font-medium">{{ section.title }}</div>
                <div class="flex flex-wrap gap-2">
                  <Badge
                    v-for="item in section.items"
                    :key="`${limit.index}-${section.title}-${item}`"
                    variant="outline"
                  >
                    {{ item }}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <Card class="h-fit min-w-0 max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ScanEye class="h-5 w-5" />
          原始 JSON
        </CardTitle>
      </CardHeader>
      <CardContent class="min-w-0 max-w-full">
        <div class="w-full max-w-full overflow-x-auto rounded-lg bg-muted/40">
          <pre
            class="max-h-[720px] w-max min-w-full overflow-y-auto p-4 text-xs leading-6"
            >{{ previewJson }}</pre
          >
        </div>
      </CardContent>
    </Card>
  </div>
</template>
