import { useBackendStore } from "@/composables/useBackendStore";
import { wsRpcCall } from "@/composables/useWsRpc";

const { currentBackend } = useBackendStore();

// 预生成 token
export async function preGenerateToken(
  nodeUuid: string,
  backend = currentBackend,
) {
  if (!backend.value) return;
  try {
    const result = await wsRpcCall<{ key?: string; secret?: string }>(
      backend.value.url,
      "token_create",
      {
        father_token: backend.value.token,
        token_creation: {
          username: null,
          password: null,
          timestamp_from: null,
          timestamp_to: null,
          version: 1,
          token_limit: [
            {
              // scopes: [{ global: null }],
              scopes: [
                {
                  agent_uuid: nodeUuid,
                },
              ],
              permissions: [
                { static_monitoring: "write" },
                { dynamic_monitoring: "write" },
                { dynamic_monitoring_summary: "write" },
                { task: "listen" },
                { task: { write: "ping" } },
                { task: { write: "tcp_ping" } },
                { task: { write: "http_ping" } },
                { task: { write: "web_shell" } },
                { task: { write: "execute" } },
                { task: { write: "edit_config" } },
                { task: { write: "read_config" } },
                { task: { write: "ip" } },
              ],
            },
          ],
        },
      },
    );
    if (result?.key && result?.secret) {
      return `${result.key}:${result.secret}`;
    }
  } catch (e) {
    console.error("Token pre-generation failed:", e);
  }
}
