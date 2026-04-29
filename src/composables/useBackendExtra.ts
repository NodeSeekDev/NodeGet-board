import { ref, watch, computed, type Ref, version } from "vue";
import { toast } from "vue-sonner";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { useKv } from "@/composables/useKv";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { delay } from "@/lib/delay";

export interface ServerVersionInfo {
  cargo_version: string;
  git_commit_sha: string;
  binary_type: string;
}

export interface ServerInfo extends Backend {
  uuid: string | null;
  version: string | null;
  ip: string | null;
  agentConfigWsUrl: string | null;
}

interface IpInfo {
  address: string;
  asOrganization?: string;
  asn?: number;
  location?: {
    city?: string;
    colo?: string;
    country?: string;
    geographicCoordinate?: {
      latitude?: string;
      longitude?: string;
    };
    postalCode?: string;
    timezone?: string;
  };
}

const ServerInfoPlaceholder = {
  uuid: null,
  version: null,
  ip: null,
  agentConfigWsUrl: null,
};

const { backends, currentBackend } = useBackendStore();

const serverInfo = ref<Record<string, ServerInfo>>({});
const serverInfoLoading = ref(false);

async function getAgentConfigWsUrl(backend: Ref<Backend>) {
  if (!backend.value?.url) {
    return null;
  }
  const kv = useKv(backend);
  await kv.fetchNamespaces();
  const existedNS = kv.namespaces.value.includes("global");
  if (!existedNS) {
    await kv.createNamespace("global");
  }

  kv.namespace.value = "global";
  const result = await kv.getValue("agent_config_ws_url");
  if (typeof result === "string") {
    return result;
  } else {
    return backend.value.url;
  }
}

async function saveAgentConfigWsUrl(backend: Ref<Backend>, url: string) {
  const kv = useKv(backend);
  await kv.fetchNamespaces();
  kv.namespace.value = "global";
  await kv.setValue("agent_config_ws_url", url);
}

async function getServerIpInfo(backend: Ref<Backend>) {
  const { runWorker, poolingWorkerLogs } = useJsRuntime(backend);
  const id = await runWorker("server-task-worker", "call", {
    task: {
      name: "ip",
    },
  }).then((r) => r?.id);
  if (!id) {
    throw "worker run failed, id not returned";
  }
  return poolingWorkerLogs(id).then((r) => r.result as IpInfo);
}

function getSingleBackendProperty(
  property: string,
  backend: Backend,
  promise: Promise<string | null>,
) {
  return promise
    .then((value) => {
      serverInfo.value[backend.url] = {
        ...ServerInfoPlaceholder,
        ...backend,
        ...serverInfo.value[backend.url],
        [property]: value,
      };
      console.debug(serverInfo.value);
    })
    .catch((e) => {
      console.error(e);
      toast.error("获取服务器信息失败", {
        description: typeof e === "string" ? e : e.message || JSON.stringify(e),
      });
      serverInfo.value[backend.url] = {
        ...ServerInfoPlaceholder,
        ...backend,
        ...serverInfo.value[backend.url],
        [property]: null,
      };
    });
}

const fetchServerInfo = async (backend: Backend) => {
  const conn = getWsConnection(backend.url);

  const tasks: Promise<any>[] = [];
  try {
    serverInfoLoading.value = true;
    tasks.push(
      getSingleBackendProperty(
        "uuid",
        backend,
        conn.call<string>("nodeget-server_uuid", []),
      ),
    );
    tasks.push(
      getSingleBackendProperty(
        "version",
        backend,
        conn
          .call<ServerVersionInfo>("nodeget-server_version", [])
          .then((ver) => `${ver.cargo_version}-${ver.git_commit_sha}`),
      ),
    );
    tasks.push(
      getSingleBackendProperty(
        "agentConfigWsUrl",
        backend,
        getAgentConfigWsUrl(ref(backend)),
      ),
    );
    tasks.push(
      getSingleBackendProperty(
        "ip",
        backend,
        getServerIpInfo(ref(backend)).then(
          (ipinfo) => (ipinfo && ipinfo?.address) || "",
        ),
      ),
    );
    await Promise.all(tasks);
    serverInfoLoading.value = false;
  } catch (error) {
    console.error(error);
  } finally {
    serverInfoLoading.value = false;
  }
};

const refreshAll = () => {
  backends.value.forEach(fetchServerInfo);
};

watch(
  () => JSON.stringify(backends.value),
  () => backends.value.forEach(fetchServerInfo),
  { immediate: true },
);

const isActive = (backend: Backend) =>
  currentBackend.value?.url === backend.url &&
  currentBackend.value?.token === backend.token;

const currentBackendInfo = computed(() => {
  if (!currentBackend.value) {
    return null;
  }
  if (!serverInfo.value) {
    return {
      ...ServerInfoPlaceholder,
      ...currentBackend.value,
    };
  }
  return serverInfo.value[currentBackend.value.url] as ServerInfo;
});

export function useBackendExtra() {
  return {
    refreshAll,
    isActive,
    serverInfo,
    serverInfoLoading,
    currentBackendInfo,
    saveAgentConfigWsUrl,
  };
}
