<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronDown, Eye, ScanEye } from "lucide-vue-next";
import type {
  PermissionEntry,
  Token,
  TokenDetail,
  TokenLimitEntry,
} from "../type";
import {
  detectTokenPermissionTemplate,
  getTokenPermissionTemplateOptions,
} from "../tokenPermissionTemplates";
import { detectScopeTab } from "../scopeUi";
import { createPermissionBuckets } from "./permissions/permissionsState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const { t, locale } = useI18n();

const templateLabelMap = computed(() => {
  locale.value;
  return new Map(
    getTokenPermissionTemplateOptions(t).map((item) => [
      item.value,
      item.label,
    ]),
  );
});

const displayText = (
  value: string | number | null | undefined,
  fallback = "-",
) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  return String(value);
};

const formatTimestamp = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) {
    return t("dashboard.token.detail.preview.notSet");
  }
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return t("dashboard.token.detail.preview.notSet");
  }
  return date.toLocaleString(locale.value === "zh_cn" ? "zh-CN" : "en-US", {
    hour12: false,
  });
};

const formatScopeLabels = (limit: TokenLimitEntry) => {
  if (!Array.isArray(limit.scopes) || limit.scopes.length === 0) {
    return [t("dashboard.token.detail.preview.notSet")];
  }

  return limit.scopes.map((item) => {
    if ("global" in item) {
      return t("dashboard.token.detail.preview.globalScope");
    }
    if ("agent_uuid" in item) {
      return t("dashboard.token.detail.preview.agentScope", {
        value: item.agent_uuid,
      });
    }
    if ("kv_namespace" in item) {
      return t("dashboard.token.detail.preview.kvScope", {
        value: item.kv_namespace,
      });
    }
    if ("js_worker" in item) {
      return t("dashboard.token.detail.preview.jsWorkerScope", {
        value: item.js_worker,
      });
    }
    return t("dashboard.token.detail.preview.unknownScope");
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
    {
      title: t("dashboard.token.detail.preview.staticMonitoringTitle"),
      entries: buckets.staticMonitoringPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.dynamicMonitoringTitle"),
      entries: buckets.dynamicMonitoringPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.dynamicMonitoringSummaryTitle"),
      entries: buckets.dynamicMonitoringSummaryPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.taskTitle"),
      entries: buckets.taskPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.crontabTitle"),
      entries: buckets.crontabPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.crontabResultTitle"),
      entries: buckets.crontabResultPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.kvTitle"),
      entries: buckets.kvPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.terminalTitle"),
      entries: buckets.terminalPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.nodeGetTitle"),
      entries: buckets.nodeGetPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.jsWorkerTitle"),
      entries: buckets.jsWorkerPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.jsResultTitle"),
      entries: buckets.jsResultPermissions,
    },
    {
      title: t("dashboard.token.detail.preview.unknownPermissions"),
      entries: buckets.unknownPermissions,
    },
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
      templateLabel:
        templateLabelMap.value.get(template) ??
        t("dashboard.token.detail.preview.customTemplate"),
    };
  });
});

const previewJson = computed(() =>
  JSON.stringify(props.rawDetail ?? props.token ?? {}, null, 2),
);

const openedPermissionCards = ref<boolean[]>([]);

watch(
  tokenLimitDetails,
  (details) => {
    openedPermissionCards.value = details.map((_, index) => index === 0);
  },
  { immediate: true },
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
    <div class="text-sm text-muted-foreground">
      {{ t("dashboard.token.detail.detailLoading") }}
    </div>
  </div>

  <div v-else class="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
    <div class="min-w-0 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Eye class="h-5 w-5" />
            {{ t("dashboard.token.detail.preview.baseInfoTitle") }}
          </CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">
              {{ t("dashboard.token.detail.preview.tokenKey") }}
            </div>
            <div class="font-mono text-sm break-all">
              {{ displayText(rawSummary.token_key) }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">
              {{ t("dashboard.token.detail.preview.version") }}
            </div>
            <div class="text-sm">
              {{ displayText(rawSummary.version ?? token.version) }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">
              {{ t("dashboard.token.detail.preview.username") }}
            </div>
            <div class="text-sm">
              {{
                displayText(
                  rawSummary.username ?? token.username,
                  t("dashboard.token.detail.preview.notSet"),
                )
              }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">
              {{ t("dashboard.token.detail.preview.tokenLimitCount") }}
            </div>
            <div class="text-sm">{{ token.token_limit.length }}</div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">
              {{ t("dashboard.token.detail.preview.startTime") }}
            </div>
            <div class="text-sm">
              {{
                formatTimestamp(
                  rawSummary.timestamp_from ?? token.timestamp_from,
                )
              }}
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-xs text-muted-foreground">
              {{ t("dashboard.token.detail.preview.endTime") }}
            </div>
            <div class="text-sm">
              {{
                formatTimestamp(rawSummary.timestamp_to ?? token.timestamp_to)
              }}
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <Collapsible
          v-for="limit in tokenLimitDetails"
          :key="`token-limit-${limit.index}`"
          v-model:open="openedPermissionCards[limit.index]"
        >
          <Card>
            <CardHeader>
              <CollapsibleTrigger as-child>
                <button
                  type="button"
                  class="flex w-full flex-col gap-3 rounded-md text-left transition-colors hover:bg-muted/40 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[1px] lg:flex-row lg:items-center lg:justify-between"
                >
                  <div class="flex items-center gap-2">
                    <CardTitle>{{
                      t("dashboard.token.detail.preview.permissionsTitle", {
                        index: limit.index + 1,
                      })
                    }}</CardTitle>
                    <span
                      class="inline-flex size-8 items-center justify-center rounded-md"
                    >
                      <ChevronDown
                        class="h-4 w-4 transition-transform duration-200"
                        :class="{
                          'rotate-180': openedPermissionCards[limit.index],
                        }"
                      />
                    </span>
                    <span class="sr-only">{{
                      t("dashboard.token.permissionsConfig.toggleAriaLabel")
                    }}</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{{
                      t("dashboard.token.detail.preview.templateLabel", {
                        template: limit.templateLabel,
                      })
                    }}</Badge>
                    <Badge variant="outline">{{
                      t("dashboard.token.detail.preview.permissionsCount", {
                        count: limit.permissionsCount,
                      })
                    }}</Badge>
                  </div>
                </button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent class="space-y-5">
                <div class="space-y-2">
                  <div class="text-xs text-muted-foreground">
                    {{ t("dashboard.token.detail.preview.scope") }}
                  </div>
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
                    <div class="mb-3 text-sm font-medium">
                      {{ section.title }}
                    </div>
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
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>

    <Card class="h-fit min-w-0 max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ScanEye class="h-5 w-5" />
          {{ t("dashboard.token.detail.preview.rawJsonTitle") }}
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
