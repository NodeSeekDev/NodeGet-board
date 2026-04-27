import { useBackendStore } from "@/composables/useBackendStore";
import { wsRpcCall } from "@/composables/useWsRpc";
import { AGENT_PERMISSIONS } from "@/components/token/tokenPermissionTemplates";

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
              permissions: AGENT_PERMISSIONS,
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
