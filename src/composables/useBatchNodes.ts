import { ref, watch } from "vue";
import { getWsConnection } from "@/composables/useWsConnection";
import { useBackendStore } from "@/composables/useBackendStore";

export type Node<T extends string = string> = { uuid: string } & Record<T, any>;

/**
 * useBatchNodes 用于从后端获取节点列表及其元数据。
 *
 * @template T - 元数据字段的键类型，默认为 "name" | "tags"，为BatchExec使用
 * @param {T[]} metadataKeys - 指定要获取的节点元数据键，默认 ["name", "tags"]
 * @returns {{
 *   nodes: Ref<Node<T>[]>,       // 响应式节点数组，每个节点包含 uuid 和指定的元数据
 *   fetchNodes: () => Promise<void> // 手动触发刷新节点列表的异步函数
 * }}
 *
 * 功能说明：
 * 1. 根据当前后端配置的 URL 与 token，通过 WebSocket 调用接口获取所有节点 UUID。
 * 2. 根据 UUID 批量获取指定元数据字段 (metadataKeys)。
 * 3. 将节点和元数据组合为一个对象数组，并通过 `nodes` 响应式引用返回。
 * 4. 当 currentBackend 的 URL 或 token 变化时，自动刷新节点列表。
 * 5. fetchNodes 可用于手动刷新节点列表。
 *
 * 使用示例：
 * ```ts
 * const { nodes, fetchNodes } = useNodes(["name", "tags", "status"]);
 * watch(nodes, (newNodes) => console.log(newNodes));
 * ```
 */
export const useNodes = <T extends string = "name" | "tags">(
  metadataKeys: T[] = ["name", "tags"] as T[],
) => {
  const { currentBackend } = useBackendStore();
  const nodes = ref<Node[]>([]);

  const fetchNodes = async () => {
    if (!currentBackend.value?.url) {
      nodes.value = [];
      return;
    }
    try {
      const result = await getWsConnection(currentBackend.value.url).call<{
        uuids: string[];
      }>("nodeget-server_list_all_agent_uuid", {
        token: currentBackend.value.token,
      });

      const uuids = result?.uuids ?? [];
      if (!uuids.length) {
        nodes.value = [];
        return;
      }

      const namespaceKeys = uuids.flatMap((uuid) =>
        metadataKeys.map((key) => ({
          namespace: uuid,
          key: `metadata_${key}`,
        })),
      );

      const kvResult = await getWsConnection(currentBackend.value.url).call<
        { namespace: string; key: string; value: unknown }[]
      >("kv_get_multi_value", {
        token: currentBackend.value.token,
        namespace_key: namespaceKeys,
      });

      const metadataMap = new Map<string, Record<string, any>>();
      for (const item of Array.isArray(kvResult) ? kvResult : []) {
        const uuid = item.namespace;
        if (!metadataMap.has(uuid)) metadataMap.set(uuid, {});
        const metaKey = item.key.replace(/^metadata_/, "");
        metadataMap.get(uuid)![metaKey] = item.value;
      }

      nodes.value = uuids.map((uuid) => ({
        uuid,
        ...metadataMap.get(uuid),
      }));
    } catch {
      nodes.value = [];
    }
  };

  watch(
    () => [currentBackend.value?.url, currentBackend.value?.token],
    async ([url]) => {
      if (!url) {
        nodes.value = [];
        return;
      }
      await fetchNodes();
    },
    { immediate: true },
  );

  return { nodes, fetchNodes };
};
