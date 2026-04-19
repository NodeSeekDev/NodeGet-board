import { ref } from "vue";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { useCron, taskToCronType } from "@/composables/useCron";
import { toast } from "vue-sonner";
import { type Backend } from "@/composables/useBackendStore";
import { useKv } from "@/composables/useKv";
import { type BackendCron } from "@/composables/useCron";
import { useBackendStore } from "@/composables/useBackendStore";

export interface agentPostprocessOptions {
  cronList: BackendCron[];
  databaseLimit: {
    database_limit_static_monitoring?: number;
    database_limit_dynamic_monitoring?: number;
    database_limit_dynamic_monitoring_summary?: number;
    database_limit_task?: number;
  };
  metadata: {
    metadata_name?: string;
    metadata_tags?: string[];
    metadata_price?: number;
    metadata_price_unit?: string;
    metadata_price_cycle?: string;
    metadata_region?: string;
    metadata_hidden?: boolean;
  };
}

async function afterServerCreate(backend: Backend) {
  const { getWorker, addWorker, runWorker } = useJsRuntime(ref(backend));
  const cron = useCron(ref(backend));

  const baseWorkerName = "base-worker";
  try {
    const worker = await getWorker(baseWorkerName).catch(
      (v: Error | string) => {
        if (v.toString().indexOf("js_worker not found") !== -1) {
          return null;
        }
        throw v;
      },
    );
    if (!worker) {
      const jsContent = await fetch(
        `${import.meta.env.VITE_BOOTSTRAP}/workers/base-worker/index.js`,
      ).then((r) => r.text());
      await addWorker({
        name: baseWorkerName,
        content: jsContent,
        env: {
          token: backend.token,
          resource_url: import.meta.env.VITE_BOOTSTRAP,
        },
      });
    }
    const cronResults = await cron.list();
    const exist = cronResults.find((v) => v.name === baseWorkerName + "-cron");
    if (!exist) {
      await cron.create({
        name: baseWorkerName + "-cron",
        cron_expression: "*/3 * * * * *",
        cron_type: {
          server: {
            js_worker: [
              baseWorkerName,
              {
                task: "update",
              },
            ],
          },
        },
      });
    }
    await runWorker(baseWorkerName, "call", {
      lifecycle: "server-create",
    });
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "执行server安装后处理失败");
  }
}

const createdAgent = new Set();
async function afterAgentCreate(
  agentUUID: string,
  option: agentPostprocessOptions,
) {
  if (createdAgent.has(agentUUID)) {
    return;
  }

  try {
    const { currentBackend } = useBackendStore();
    const backend = currentBackend.value;
    if (!backend) {
      throw new Error("No backend configured");
    }

    // Initialize KV namespace for the agent
    const kvClient = useKv();
    await kvClient.fetchNamespaces();
    const existedNS = kvClient.namespaces.value.includes(agentUUID);
    if (!existedNS) {
      await kvClient.createNamespace(agentUUID);
    }

    // Set KV values for databaseLimit and metadata
    kvClient.namespace.value = agentUUID;

    // Store databaseLimit fields
    for (const [key, value] of Object.entries(option.databaseLimit)) {
      if (value !== undefined && value !== null) {
        await kvClient.setValue(key, value);
      }
    }

    // Store metadata fields
    for (const [key, value] of Object.entries(option.metadata)) {
      if (value !== undefined && value !== null) {
        await kvClient.setValue(key, value);
      }
    }

    // Update cron tasks to include this agent
    const cronClient = useCron(ref(backend));
    for (const cronTask of option.cronList) {
      if ("agent" in cronTask.cron_type) {
        const [agentIds, taskPayload] = cronTask.cron_type.agent;
        const updatedAgentIds = Array.from(new Set([...agentIds, agentUUID]));

        await cronClient.edit({
          name: cronTask.name,
          cron_expression: cronTask.cron_expression,
          cron_type: {
            agent: [updatedAgentIds, taskPayload],
          },
        });
      }
    }

    createdAgent.add(agentUUID);
    toast.success("Agent post-processing completed successfully");
  } catch (e: unknown) {
    const errorMsg =
      e instanceof Error ? e.message : "Agent post-processing failed";
    toast.error(errorMsg);
    console.error("afterAgentCreate error:", e);
  }
}

export function useLifecycle() {
  return {
    afterServerCreate,
    afterAgentCreate,
  };
}
