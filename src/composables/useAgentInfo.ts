/*
  Agent infomation, include:
    - uuid
    - metadata
    - version
    - ip
*/

import { ref, watch, computed, type Ref, version } from "vue";
import { toast } from "vue-sonner";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useKv } from "@/composables/useKv";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { delay } from "@/lib/delay";
import {
  useTask,
  type CreateTaskBlockingResponse,
  type IpResult,
  type VersionResult,
} from "@/composables/useTask";

import { useNodeMetadata } from "@/composables/useNodeMetadata";
import { useLifecycle } from "@/composables/useLifecycle";

import { metaKey2Attr, type NodeMetadata } from "@/types/agent";
import { groupBy } from "@/utils/groupBy";

interface AgentInfo {
  uuid: string;
  version: string | null | undefined;
  ip: string | null | undefined;

  metadata?: NodeMetadata;
}

function nodeSortFunc(a: AgentInfo, b: AgentInfo) {
  const ao = a?.metadata?.order;
  const bo = b?.metadata?.order;

  const aHas = ao != null;
  const bHas = bo != null;

  // 1. 一个有 order，一个没有
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;

  // 2. 都有 order
  if (aHas && bHas) {
    return ao - bo;
  }

  // 3. 都没有 order → 按 uuid
  return a.uuid.localeCompare(b.uuid);
}

export function useAgentInfo(
  backend = useBackendStore().currentBackend,
  { withIP = false, withVersion = false } = {},
) {
  const agents = ref<AgentInfo[]>([]);
  const loading = ref(false);

  const kv = useKv(backend);
  const task = useTask(backend);
  // const metadata = useNodeMetadata(kv)
  const { afterAgentCreate } = useLifecycle();
  const { parseMetadataFields } = useNodeMetadata(kv);

  let fetchPromise = Promise.resolve();
  async function fetchAgents() {
    if (loading.value) {
      return fetchPromise;
    }
    fetchPromise = _fetchAgents();
    return fetchPromise;
  }

  async function _fetchAgents() {
    if (!backend.value) {
      return;
    }

    try {
      loading.value = true;

      const conn = getWsConnection(backend.value.url);

      const [result, _] = await Promise.all([
        conn.call<{ uuids: string[] }>("nodeget-server_list_all_agent_uuid", {
          token: backend.value.token,
        }),
        kv.fetchNamespaces(),
      ]);
      const uuids = result?.uuids ?? [];

      const emptyAgentNS = uuids.filter(
        (v) => !kv.namespaces.value.includes(v),
      );

      await Promise.all(emptyAgentNS.map((uuid) => fixAgentNamespace(uuid)));

      const metaMap = new Map<string, NodeMetadata>();

      if (uuids.length > 0) {
        const namespaceKeys = uuids
          .filter((v) => kv.namespaces.value.includes(v))
          .map((uuid) => ({ namespace: uuid, key: "metadata_*" }));

        const result = await conn.call<
          { namespace: string; key: string; value: unknown }[]
        >("kv_get_multi_value", {
          token: backend.value.token,
          namespace_key: namespaceKeys,
        });

        const grouped = groupBy(result, "namespace");

        Object.keys(grouped).forEach((uuid) => {
          const arr =
            grouped[uuid]?.map(({ key, value }) => ({ key, value })) ?? [];
          const metadata = parseMetadataFields(arr, "节点" + uuid.slice(-6));
          metaMap.set(uuid, metadata);
        });
      }

      agents.value = uuids
        .map((uuid) => ({
          uuid,
          ip: undefined as string | null | undefined,
          version: undefined as string | null | undefined,
          serverCount: 1,
          // customName: nameMap.get(uuid) ?? uuid.slice(0, 8),
          metadata: metaMap.get(uuid) || undefined,
        }))
        .sort(nodeSortFunc);

      loading.value = false;

      // 每个 agent 单独发任务，谁先回来谁先刷新自己那行；不阻塞列表渲染。
      for (const agent of agents.value) {
        if (withIP) void fetchAgentIp(agent);
        if (withVersion) void fetchAgentVersion(agent);
      }
    } catch (error) {
      console.error(error);
      toast.error(`获取agent信息失败`);
    } finally {
      loading.value = false;
    }
  }

  const fixAgentNamespace = async (agentUUID: string) => {
    if (!backend.value) {
      return;
    }
    await afterAgentCreate(
      agentUUID,
      {
        cronList: [],
        metadata: {},
        databaseLimit: {},
      },
      backend,
    );
  };

  const fetchAgentIp = async (agent: AgentInfo) => {
    try {
      const res = await task.createTaskBlocking(agent.uuid, "ip", 8000);
      const ip = (res.task_event_result as IpResult | null)?.ip;
      agent.ip = ip ? ip[0] || ip[1] || null : null;
    } catch {
      agent.ip = null;
    }
  };

  const fetchAgentVersion = async (agent: AgentInfo) => {
    try {
      const res = (await task.createVersionTask(
        agent.uuid,
        true,
        8000,
      )) as CreateTaskBlockingResponse;
      const version = (res.task_event_result as VersionResult | null)?.version;
      if (version) {
        agent.version = version.cargo_version + "-" + version.git_commit_sha;
      }
      console.debug("version", version);
    } catch (e) {
      console.error("version error", e);
    }
  };

  watch(backend, () => fetchAgents(), { immediate: true });

  return {
    fetchAgents,
    fetchAgentIp,
    fetchAgentVersion,
    fixAgentNamespace,
    agents,
    loading,
  };
}

export const currentAgentInfo = useAgentInfo();
