import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { AGENT_TEMPLATE_PERMISSIONS } from "@/components/token/tokenTemplates.ts";
import { generatePassword } from "@/lib/password";
import { makeRpcFunction } from "@/composables/useWsConnection";
import {
  decodeTokenUsername,
  encodeTokenUsername,
} from "@/components/token/scopeCodec";

const { currentBackend } = useBackendStore();

// 主控自 2026-07-29 起拒绝包含 ':' 或 '|' 的 username（这两个字符用于区分
// "key:secret" / "username|password" 两种鉴权格式），因此发往后端时统一 URI 编码。
export const agentUsername = (nodeUuid: string) =>
  encodeTokenUsername(`[agent]:${nodeUuid}`);

// 展示层用：把后端存储的 username 安全解码为可读原文。
export const displayTokenUsername = (
  username: string | null | undefined,
): string => (username ? decodeTokenUsername(username) : "");

function makeTokenObject(nodeUuid: string) {
  return {
    username: agentUsername(nodeUuid),
    password: generatePassword(16),
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
        permissions: AGENT_TEMPLATE_PERMISSIONS,
      },
    ],
  };
}

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
      token_creation: makeTokenObject(nodeUuid),
    });
    if (result?.key && result?.secret) {
      return `${result.key}:${result.secret}`;
    }
  } catch (e) {
    console.error("Token pre-generation failed:", e);
  }
}

export async function reGenerateToken(
  nodeUuid: string,
  backend = currentBackend,
) {
  if (!backend.value) return;
  try {
    try {
      await getWsConnection(backend.value.url).call<{
        key?: string;
        secret?: string;
      }>("token_delete", {
        token: backend.value.token,
        target_token: agentUsername(nodeUuid),
      });
    } catch {}

    return preGenerateToken(nodeUuid, backend);
  } catch (e) {
    console.error("Token re-generation failed:", e);
  }
}

export async function upgradeTokenLimit(
  nodeUuid: string,
  backend = currentBackend,
) {
  if (!backend.value) return;
  const rpc = makeRpcFunction();
  try {
    rpc("token_edit", {
      token: backend.value.token,
      target_token: agentUsername(nodeUuid),
      limit: makeTokenObject(nodeUuid).token_limit,
    });
  } catch (e) {
    console.error("Token update failed:", e);
  }
}
