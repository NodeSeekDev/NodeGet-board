import { ref } from "vue";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { useCron } from "@/composables/useCron";
import { toast } from "vue-sonner";
import { type Backend } from "@/composables/useBackendStore";
import { useKv } from "@/composables/useKv";
import { type BackendCron } from "@/composables/useCron";

const kv = useKv();

export interface agentPostprocessOptions {
  cronList: BackendCron[];
  databaseLimit: {
    database_limit_static_monitoring?: number;
    database_limit_dynamic_monitoring?: number;
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

async function afterAgentCreate(
  agentuuid: string,
  option: agentPostprocessOptions,
) {
  await kv.fetchNamespaces();
  const existedNS = kv.namespaces.value.includes(agentuuid);
  if (!existedNS) {
    kv.createNamespace(agentuuid);
  }
  console.debug({
    option,
  });
}

export function useLifecycle() {
  return {
    afterServerCreate,
    afterAgentCreate,
  };
}
