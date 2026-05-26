<script setup lang="ts">
import { ref } from "vue";
import { Key } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import TokenList from "@/components/token/token-list/tokenListCard.vue";
import { useCreatTokenHook } from "@/composables/token/useCreateToken";
import { useBackendStore } from "@/composables/useBackendStore";
import {
  createDefaultToken,
  DEFAULT_SCOPE,
} from "@/components/token/scopeCodec";
import {
  VISITOR_PERMISSIONS,
  VISITOR_WITH_PING_PERMISSIONS,
} from "@/components/token/tokenPermissionTemplates";
import { generatePassword } from "@/lib/password";

const { t } = useI18n();
const createTokenHook = useCreatTokenHook();
const { currentBackend, addBackend } = useBackendStore();
const tokenListRef = ref<InstanceType<typeof TokenList> | null>(null);
let autoCreatePending = false;

const autoCreateDefaultTokens = async () => {
  if (autoCreatePending) return;
  autoCreatePending = true;

  const backendUrl = currentBackend.value?.url ?? "";
  const buildToken = (
    username: string,
    permissions: typeof VISITOR_PERMISSIONS,
  ) => ({
    ...createDefaultToken(),
    username,
    password: generatePassword(16),
    token_limit: [
      {
        scopes: [...DEFAULT_SCOPE],
        permissions: permissions.map((p) => ({ ...p })),
      },
    ],
  });

  const [r1, r2] = await Promise.all([
    createTokenHook.createToken(
      buildToken("visitor_monitor_only", VISITOR_PERMISSIONS),
    ),
    createTokenHook.createToken(
      buildToken("visitor_monitor_with_ping", VISITOR_WITH_PING_PERMISSIONS),
    ),
  ]);

  if (r1.key && backendUrl)
    addBackend({ name: "本机 纯监控", url: backendUrl, token: r1.key });
  if (r2.key && backendUrl)
    addBackend({ name: "本机 监控+ping", url: backendUrl, token: r2.key });

  autoCreatePending = false;
  tokenListRef.value?.refresh();
};

definePage({
  meta: {
    title: "router.token",
    icon: Key,
    order: 10,
    group: "router.group.advanced",
  },
});
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          {{ t("dashboard.token.list.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ t("dashboard.token.list.description") }}
        </p>
      </div>
    </div>

    <div>
      <TokenList
        ref="tokenListRef"
        @first-load-empty="autoCreateDefaultTokens"
      />
    </div>
  </div>
</template>
