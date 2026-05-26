import { ref } from "vue";
import { toast } from "vue-sonner";
import { createTasks, queryTaskResults } from "@/composables/useBatchExec";
import type { TaskResult } from "@/composables/useBatchExec";

export const useBatchRun = () => {
  const runStatus = ref(false);
  const result = ref<TaskResult[]>([]);

  const run = async (
    cmd: string = "bash",
    code: string,
    selectedNodes: { uuid: string }[],
  ) => {
    if (!code) return toast.error("please input code");
    if (!selectedNodes.length) return toast.error("please select node");
    if (runStatus.value) return;

    runStatus.value = true;

    const batch = selectedNodes.map((item) => ({
      target_uuid: item.uuid,
      execute: { cmd, args: ["-c", code] },
    }));

    const create = await createTasks(batch);
    result.value = create.map((item) => ({ ...item }));

    const interval = setInterval(async () => {
      const query = await queryTaskResults(create);
      result.value = query.map((item) => ({ ...item }));

      if (query.every((item) => item.status !== 0)) {
        runStatus.value = false;
        clearInterval(interval);
      }
    }, 1000);
  };

  return { run, runStatus, result };
};
