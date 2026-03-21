import { computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

export interface CrontabResult {
  id: number;
  cron_id: number;
  cron_name: string;
  run_time: number;
  success: boolean;
  message: string;
  task_id?: number; // Agent 任务会有 task_id
}

export interface TaskQueryResult {
  error_message: string | null;
  success: boolean;
  task_event_result: any;
  task_event_type: Record<string, string>;
  task_id: number;
  timestamp: number;
  uuid: string;
}

export interface CronHistoryQuery {
  condition: any[];
}

export function useCronHistory() {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const backendToken = computed(() => currentBackend.value?.token ?? "");

  const query = (condition: any[]): Promise<CrontabResult[]> => {
    return getWsConnection(backendUrl.value).call<CrontabResult[]>(
      "crontab-result_query",
      {
        token: backendToken.value,
        query: { condition },
      },
    );
  };

  const queryTask = (taskId: number): Promise<TaskQueryResult[]> => {
    return getWsConnection(backendUrl.value).call<TaskQueryResult[]>(
      "task_query",
      {
        token: backendToken.value,
        task_data_query: { condition: [{ task_id: taskId }] },
      },
    );
  };

  return { query, queryTask };
}
