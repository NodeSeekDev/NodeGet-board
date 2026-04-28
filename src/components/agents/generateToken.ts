import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { AGENT_PERMISSIONS } from "@/components/token/tokenPermissionTemplates";

const { currentBackend } = useBackendStore();
// 预生成 token
export async function preGenerateToken(
  nodeUuid: string,
  backend = currentBackend,
) {
  if (!backend.value) return;
  try {
    const result = await getWsConnection(backend.value.url).call<{
      key?: string;
      secret?: string;
    }>("token_create", {
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
    });
    if (result?.key && result?.secret) {
      return `${result.key}:${result.secret}`;
    }
  } catch (e) {
    console.error("Token pre-generation failed:", e);
  }
}
