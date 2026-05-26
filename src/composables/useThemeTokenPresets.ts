import { useKv } from "@/composables/useKv";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import {
  createDefaultToken,
  DEFAULT_SCOPE,
  serializeTokenPayload,
} from "@/components/token/scopeCodec";
import { generatePassword } from "@/lib/password";
import type { PermissionEntry } from "@/components/token/type";
import type { ThemeToken } from "@/types/theme";
import { toast } from "vue-sonner";

export type TokenPreset = ThemeToken;

export const KV_NAMESPACE = "global";
export const KV_KEY = "theme_token";

export const BASE_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: { read: "cpu" } },
  { static_monitoring: { read: "system" } },
  { static_monitoring: { read: "gpu" } },
  { dynamic_monitoring_summary: "read" },
  { node_get: "list_all_agent_uuid" },
  { kv: { read: "metadata_*" } },
];

export const FULL_PERMISSIONS: PermissionEntry[] = [
  ...BASE_PERMISSIONS,
  { task: { read: "ping" } },
  { task: { read: "tcp_ping" } },
];

export function useThemeTokenPresets() {
  const kv = useKv();
  const backendStore = useBackendStore();

  const buildTokenPayload = (
    username: string,
    permissions: PermissionEntry[],
  ) =>
    serializeTokenPayload({
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

  const createTokenOnBackend = async (
    url: string,
    fatherToken: string,
    username: string,
    permissions: PermissionEntry[],
  ): Promise<string> => {
    const conn = getWsConnection(url);
    const listResult = await conn.call<{
      tokens?: Array<{ token_key: string; username: string | null }>;
    }>("token_list_all_tokens", { token: fatherToken });
    const existing = listResult.tokens?.find((t) => t.username === username);
    if (existing) {
      await conn.call("token_delete", {
        token: fatherToken,
        target_token: existing.token_key,
      });
    }
    const result = await conn.call<{
      key?: string;
      secret?: string;
      error?: { message?: string };
    }>("token_create", {
      father_token: fatherToken,
      token_creation: buildTokenPayload(username, permissions),
    });
    if (result.key && result.secret) return `${result.key}:${result.secret}`;
    throw new Error(result.error?.message ?? "服务端未返回 key/secret");
  };

  const initDefaultPresets = async (): Promise<TokenPreset[]> => {
    const backend = backendStore.currentBackend.value;
    if (!backend) return [];

    const settle = async (username: string, permissions: PermissionEntry[]) => {
      try {
        return await createTokenOnBackend(
          backend.url,
          backend.token,
          username,
          permissions,
        );
      } catch (e: unknown) {
        toast.warning(
          `${username}: ${e instanceof Error ? e.message : String(e)}`,
        );
        return "";
      }
    };

    const [t1, t2] = await Promise.all([
      settle("visitor_monitor_only", BASE_PERMISSIONS),
      settle("visitor_monitor_with_ping", FULL_PERMISSIONS),
    ]);

    return [
      { name: "本机 纯监控", backend_url: backend.url, token: t1 },
      { name: "本机 监控+ping", backend_url: backend.url, token: t2 },
    ];
  };

  // 从 KV 加载预设，若为空则自动初始化默认预设
  const loadOrInitPresets = async (): Promise<TokenPreset[]> => {
    kv.namespace.value = KV_NAMESPACE;
    const raw = await kv.getValue(KV_KEY);
    const saved: TokenPreset[] = Array.isArray(raw)
      ? (raw as TokenPreset[])
      : [];
    if (saved.length === 0 && backendStore.currentBackend.value) {
      const initialized = await initDefaultPresets();
      kv.namespace.value = KV_NAMESPACE;
      await kv.setValue(KV_KEY, initialized);
      return initialized;
    }
    return saved;
  };

  const savePresets = async (presets: TokenPreset[]): Promise<void> => {
    kv.namespace.value = KV_NAMESPACE;
    await kv.setValue(KV_KEY, presets);
  };

  return { initDefaultPresets, loadOrInitPresets, savePresets };
}
