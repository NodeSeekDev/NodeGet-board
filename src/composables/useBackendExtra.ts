import { ref, watch, computed } from "vue";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

interface ServerVersionInfo {
  cargo_version: string;
  git_commit_sha: string;
  binary_type: string;
}

interface ServerInfo extends Backend {
  uuid: string | null;
  version: string | null;
}

const { backends, currentBackend } = useBackendStore();

const serverInfo = ref<Record<string, ServerInfo>>({});
const serverInfoLoading = ref(false);

const fetchServerInfo = (backend: Backend) => {
  const conn = getWsConnection(backend.url);
  serverInfoLoading.value = true;
  Promise.all([
    conn.call<string>("nodeget-server_uuid", []),
    conn.call<ServerVersionInfo>("nodeget-server_version", []),
  ])
    .then(([uuid, ver]) => {
      serverInfo.value[backend.url] = {
        ...backend,
        uuid,
        version: `${ver.cargo_version}-${ver.git_commit_sha}`,
      };
      serverInfoLoading.value = false;
    })
    .catch(() => {
      serverInfo.value[backend.url] = {
        ...backend,
        uuid: null,
        version: null,
      };
      serverInfoLoading.value = false;
    });
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
      ...currentBackend.value,
      uuid: null,
      version: null,
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
  };
}
