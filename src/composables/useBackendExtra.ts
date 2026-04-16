import { ref, watch } from "vue";
import { useBackendStore, type Backend } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

interface ServerVersionInfo {
  cargo_version: string;
  git_commit_sha: string;
  binary_type: string;
}

interface ServerInfo {
  uuid: string | null;
  version: string | null;
}

const serverInfo = ref<Record<string, ServerInfo>>({});
const serverInfoLoading = ref(false);

export function useBackendExtra() {
  const { backends, currentBackend } = useBackendStore();

  const fetchServerInfo = (backend: Backend) => {
    const conn = getWsConnection(backend.url);
    serverInfoLoading.value = true;
    Promise.all([
      conn.call<string>("nodeget-server_uuid", []),
      conn.call<ServerVersionInfo>("nodeget-server_version", []),
    ])
      .then(([uuid, ver]) => {
        serverInfo.value[backend.url] = {
          uuid,
          version: `${ver.cargo_version}-${ver.git_commit_sha}`,
        };
        serverInfoLoading.value = false;
      })
      .catch(() => {
        serverInfo.value[backend.url] = { uuid: null, version: null };
        serverInfoLoading.value = false;
      });
  };

  const refreshAll = () => {
    backends.value.forEach(fetchServerInfo);
  };

  watch(backends, (list) => list.forEach(fetchServerInfo), { immediate: true });

  const isActive = (backend: Backend) =>
    currentBackend.value?.url === backend.url &&
    currentBackend.value?.token === backend.token;

  return {
    refreshAll,
    isActive,
    serverInfo,
    serverInfoLoading,
  };
}
