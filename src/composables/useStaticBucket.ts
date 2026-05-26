import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

export type StaticBucket = {
  id: number;
  name: string;
  path: string;
  is_http_root: boolean;
  cors: boolean;
  enable: boolean;
};

export type StaticBucketInput = Omit<StaticBucket, "id">;

export function useStaticBucket(backend = useBackendStore().currentBackend) {
  const backendUrl = computed(() => backend.value?.url ?? "");
  const backendToken = computed(() => backend.value?.token ?? "");

  const buckets = ref<StaticBucket[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const rpc = <T>(method: string, params: unknown): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params);

  const fetchList = async () => {
    if (!backendUrl.value) return;
    loading.value = true;
    error.value = null;
    try {
      const names = await rpc<string[]>("static-bucket_list", {
        token: backendToken.value,
      });
      if (!Array.isArray(names) || !names.length) {
        buckets.value = [];
        return;
      }
      const conn = getWsConnection(backendUrl.value);
      const details = await conn.callBatch<StaticBucket | null>(
        names.map((name) => ({
          method: "static-bucket_read",
          params: { token: backendToken.value, name },
        })),
      );
      buckets.value = details.filter((b): b is StaticBucket => b !== null);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      buckets.value = [];
    } finally {
      loading.value = false;
    }
  };

  const readBucket = async (name: string): Promise<StaticBucket | null> => {
    return rpc<StaticBucket | null>("static-bucket_read", {
      token: backendToken.value,
      name,
    });
  };

  const createBucket = async (
    input: StaticBucketInput,
  ): Promise<StaticBucket> => {
    const result = await rpc<StaticBucket>("static-bucket_create", {
      token: backendToken.value,
      ...input,
    });
    return result;
  };

  const updateBucket = async (
    input: StaticBucketInput,
  ): Promise<StaticBucket> => {
    return rpc<StaticBucket>("static-bucket_update", {
      token: backendToken.value,
      ...input,
    });
  };

  const deleteBucket = async (name: string): Promise<void> => {
    await rpc("static-bucket_delete", {
      token: backendToken.value,
      name,
    });
    buckets.value = buckets.value.filter((b) => b.name !== name);
  };

  const enableTheme = async (name: string): Promise<void> => {
    const bucket = buckets.value.find((b) => b.name === name);
    if (!bucket) return;
    await updateBucket({ ...bucket, is_http_root: true });
    bucket.is_http_root = true;
  };

  const disableTheme = async (name: string): Promise<void> => {
    const bucket = buckets.value.find((b) => b.name === name);
    if (!bucket) return;
    await updateBucket({ ...bucket, is_http_root: false });
    bucket.is_http_root = false;
  };

  const setCORS = async (name: string, cors: boolean): Promise<void> => {
    const bucket = buckets.value.find((b) => b.name === name);
    if (!bucket) return;
    await updateBucket({ ...bucket, cors });
    bucket.cors = cors;
  };
  const setEnable = async (name: string, enable: boolean): Promise<void> => {
    const bucket = buckets.value.find((b) => b.name === name);
    if (!bucket) return;
    await updateBucket({ ...bucket, enable });
    bucket.enable = enable;
  };

  return {
    buckets,
    loading,
    error,
    fetchList,
    readBucket,
    createBucket,
    updateBucket,
    deleteBucket,
    enableTheme,
    setCORS,
    setEnable,
    disableTheme,
  };
}
