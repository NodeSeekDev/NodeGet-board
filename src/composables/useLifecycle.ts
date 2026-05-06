import { ref } from "vue";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { useCron, taskToCronType } from "@/composables/useCron";
import { toast } from "vue-sonner";
import { type Backend } from "@/composables/useBackendStore";
import { useKv } from "@/composables/useKv";
import { type BackendCron } from "@/composables/useCron";
import { useBackendStore } from "@/composables/useBackendStore";
import { makeRpcFunction } from "@/composables/useWsConnection";
import { delay } from "@/lib/delay";
import { useNodeMetadata, makeDefaultMetadata } from "./useNodeMetadata";

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

async function ensureServerInited(backend: Backend) {
  const maxTime = 5000; //ms
  const interval = 500;

  const namespace = "global";
  const kvClient = useKv(ref(backend));
  let globalCreated = false;

  for (let t = 0; t < maxTime; t += interval) {
    if (!globalCreated) {
      await kvClient.fetchNamespaces();
      globalCreated = kvClient.namespaces.value.includes(namespace);
      if (!globalCreated) {
        await delay(interval);
        continue;
      }
    }

    kvClient.namespace.value = namespace;
    const inited = await kvClient.getValue("inited");
    console.debug({ inited });
    if (inited === true) {
      return;
    }
  }
  throw "server init timeout";
}

async function afterServerCreate(backend: Backend) {
  const { getWorker, addWorker, runWorker } = useJsRuntime(ref(backend));

  try {
    const baseWorkerName = "base-worker";
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
    await delay(100);
    await runWorker(baseWorkerName, "call", {
      lifecycle: "server-create",
    });
    await ensureServerInited(backend);
    toast.success("Server initialization successful.");
  } catch (e: unknown) {
    console.error(e);
    toast.error(e instanceof Error ? e.message : "执行server安装后处理失败");
  }
}

async function afterAgentCreate(
  agentUUID: string,
  option: agentPostprocessOptions,
  backend = useBackendStore().currentBackend,
) {
  // const agentKey = backend.value?.url + "-" + agentUUID;
  const { runWorker } = useJsRuntime(backend);

  try {
    if (!backend) {
      throw new Error("No backend configured");
    }

    // Initialize KV namespace for the agent
    const kvClient = useKv(backend);
    await kvClient.fetchNamespaces();
    const existedNS = kvClient.namespaces.value.includes(agentUUID);
    if (!existedNS) {
      await kvClient.createNamespace(agentUUID);
    }

    // Set KV values for databaseLimit and metadata
    kvClient.namespace.value = agentUUID;
    const metadata = useNodeMetadata(kvClient);

    // Store databaseLimit fields
    for (const [key, value] of Object.entries(option.databaseLimit)) {
      if (value !== undefined && value !== null) {
        await kvClient.setValue(key, value);
      }
    }

    // Store metadata fields
    metadata.initDefaultMetadata(agentUUID, {
      ...makeDefaultMetadata(agentUUID),
      ...option.metadata,
    });
    // for (const [key, value] of Object.entries({
    // })) {
    //   if (value !== undefined && value !== null) {
    //     await kvClient.setValue(key, value);
    //   }
    // }

    // Update cron tasks to include this agent
    const cronClient = useCron(backend);
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

    await runWorker("ip-location-update", "call", {
      uuids: [agentUUID],
    });

    toast.success("Agent post-processing completed successfully");
  } catch (e: unknown) {
    const errorMsg =
      e instanceof Error ? e.message : "Agent post-processing failed";
    toast.error(errorMsg);
    console.error("afterAgentCreate error:", e);
  }
}

async function afterAgentDelete(agentUUID: string, stage: string) {
  try {
    const { currentBackend } = useBackendStore();
    const backend = currentBackend.value;
    if (!backend) {
      throw new Error("No backend configured");
    }

    const rpc = makeRpcFunction();

    switch (stage) {
      case "cron":
        {
          // Update cron tasks to include this agent
          const cronClient = useCron(ref(backend));
          const cronList = await cronClient.list();
          for (const cronTask of cronList) {
            if ("agent" in cronTask.cron_type) {
              const [agentIds, taskPayload] = cronTask.cron_type.agent;
              const updatedAgentIds = agentIds.filter((v) => v !== agentUUID);

              await cronClient.edit({
                name: cronTask.name,
                cron_expression: cronTask.cron_expression,
                cron_type: {
                  agent: [updatedAgentIds, taskPayload],
                },
              });
            }
          }
        }
        break;
      case "kv":
        // clean up monitor data and task data
        {
          const kvClient = useKv();
          await kvClient.fetchNamespaces();
          const existedNS = kvClient.namespaces.value.includes(agentUUID);
          if (existedNS) {
            await kvClient.deleteNamespace(agentUUID);
          }
        }
        break;
      case "data":
        // clean up monitor data and task data
        {
          const params = {
            token: currentBackend.value?.token,
            conditions: [{ uuid: agentUUID }],
          };

          await rpc("task_delete", params);
          await rpc("agent_delete_dynamic_summary", params);
          await rpc("agent_delete_dynamic", params);
          await rpc("agent_delete_static", params);
        }
        break;
      default:
        break;
    }
  } catch (e: unknown) {
    const errorMsg =
      e instanceof Error ? e.message : "Agent post-processing failed";
    toast.error(errorMsg);
    console.error("agent delete error:", e);
  }
}

// async function syncAgent(
//   agentUUID: string,
//   serverFrom: any,
//   serverTo: any,
//   backend = useBackendStore().currentBackend
// ) {

// }

export function useLifecycle() {
  return {
    afterServerCreate,
    afterAgentCreate,
    afterAgentDelete,
  };
}
