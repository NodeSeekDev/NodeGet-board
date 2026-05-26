import { useBackendStore } from "@/composables/useBackendStore";
import { WsConnection, getWsConnection } from "@/composables/useWsConnection";
import type { DynamicDetailData } from "@/types/monitoring";
import { useInFlightDedupe } from "@/composables/useInFlightDedupe";
import { toast } from "vue-sonner";

const { currentBackend } = useBackendStore();

const dedicatedWs = false;
const detailConn: WsConnection = dedicatedWs
  ? new WsConnection(currentBackend.value?.url as string)
  : getWsConnection(currentBackend.value?.url as string);

const _fetchDynamic = async (
  serverUuid: string,
  fields: string[],
  options?: {
    timestamp_from?: number;
    timestamp_to?: number;
    limit?: number;
    last?: boolean;
  },
  timeout: number = 5_000,
): Promise<DynamicDetailData[]> => {
  if (!currentBackend.value) return [];
  const condition: Record<string, unknown>[] = [{ uuid: serverUuid }];
  if (options?.timestamp_from != null && options?.timestamp_to != null) {
    condition.push({
      timestamp_from_to: [options.timestamp_from, options.timestamp_to],
    });
  } else {
    condition.push({ last: null });
  }
  if (options?.limit != null) condition.push({ limit: options.limit });
  if (typeof options?.last === "boolean") condition.push({ last: null });

  if (!detailConn) {
    throw "ws connection not created";
  }

  try {
    const result = await detailConn.call<DynamicDetailData[]>(
      "agent_query_dynamic",
      [currentBackend.value.token, { fields, condition }],
      timeout,
    );
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("[Dynamic] fetchDynamic failed:", e);
    toast.error("数据查询失败", {
      description: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
};

export const { execute: fetchDynamic, isLoading: loading } =
  useInFlightDedupe(_fetchDynamic);
