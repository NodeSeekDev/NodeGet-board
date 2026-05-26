import { ref, computed } from "vue";
import { zip as fflateZip } from "fflate";
import { toast } from "vue-sonner";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { base64ToBuf, bufToBase64 } from "@/utils/base64";
import { triggerBlobDownload } from "@/utils/file";

export type BucketFile = {
  path: string;
  size: number;
  mtime: number;
};

export function useStaticBucketFile(
  backend = useBackendStore().currentBackend,
) {
  const backendUrl = computed(() => backend.value?.url ?? "");
  const backendToken = computed(() => backend.value?.token ?? "");

  const files = ref<BucketFile[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const rpc = <T>(method: string, params: unknown): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params);

  const fetchList = async (bucketName: string): Promise<BucketFile[]> => {
    if (!backendUrl.value) return [];
    loading.value = true;
    error.value = null;
    try {
      const list = await rpc<BucketFile[]>("static-bucket-file_list", {
        token: backendToken.value,
        name: bucketName,
      });
      files.value = Array.isArray(list) ? list : [];
      return files.value;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      files.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  };

  const uploadFile = async (
    bucketName: string,
    path: string,
    base64: string,
  ): Promise<void> => {
    await rpc("static-bucket-file_upload", {
      token: backendToken.value,
      name: bucketName,
      path,
      base64,
    });
  };

  const readFile = async (
    bucketName: string,
    path: string,
  ): Promise<string> => {
    return rpc<string>("static-bucket-file_read", {
      token: backendToken.value,
      name: bucketName,
      path,
    });
  };

  const deleteFile = async (
    bucketName: string,
    path: string,
  ): Promise<void> => {
    await rpc("static-bucket-file_delete", {
      token: backendToken.value,
      name: bucketName,
      path,
    });
    files.value = files.value.filter((f) => f.path !== path);
  };

  const renameFile = async (
    bucketName: string,
    from: string,
    to: string,
  ): Promise<void> => {
    await rpc("static-bucket-file_rename", {
      token: backendToken.value,
      name: bucketName,
      from,
      to,
    });
    files.value = files.value.map((f) =>
      f.path === from ? { ...f, path: to } : f,
    );
  };

  const readTextFile = async (
    bucketName: string,
    path: string,
  ): Promise<string> => {
    try {
      const base64 = await readFile(bucketName, path);
      return base64 ? new TextDecoder().decode(base64ToBuf(base64)) : "";
    } catch {
      return "";
    }
  };

  const saveTextFile = async (
    bucketName: string,
    path: string,
    content: string,
  ): Promise<void> => {
    const base64 = bufToBase64(new TextEncoder().encode(content));
    await uploadFile(bucketName, path, base64);
  };

  const clearFiles = () => {
    files.value = [];
  };

  const downloadAsZip = async (bucketName: string): Promise<number> => {
    const list = await rpc<BucketFile[]>("static-bucket-file_list", {
      token: backendToken.value,
      name: bucketName,
    });
    const fileList = Array.isArray(list) ? list : [];
    if (!fileList.length) return 0;

    const zipInput: Record<string, Uint8Array> = {};
    for (const file of fileList) {
      const base64 = await readFile(bucketName, file.path);
      zipInput[file.path] = base64ToBuf(base64);
    }

    await new Promise<void>((resolve, reject) => {
      fflateZip(zipInput, (err, data) => {
        if (err) return reject(err);
        triggerBlobDownload(
          new Blob([data.buffer as ArrayBuffer], { type: "application/zip" }),
          `${bucketName}.zip`,
        );
        resolve();
      });
    });

    return fileList.length;
  };

  const syncBucketDir = async (
    bucketName: string,
    files: Array<{ path: string; base64: string }>,
  ): Promise<{ uploaded: number; deleted: number }> => {
    const remoteFiles = await fetchList(bucketName);
    const localPaths = new Set(files.map((f) => f.path));
    const extraRemotePaths = remoteFiles
      .map((f) => f.path)
      .filter((p) => !localPaths.has(p));
    for (const file of files) {
      await uploadFile(bucketName, file.path, file.base64);
    }
    for (const path of extraRemotePaths) {
      await deleteFile(bucketName, path);
    }
    return { uploaded: files.length, deleted: extraRemotePaths.length };
  };

  const downloadBucketZip = async (bucketName: string): Promise<void> => {
    toast.info("正在打包文件...");
    try {
      const count = await downloadAsZip(bucketName);
      if (count === 0) toast.info("暂无文件");
      else toast.success("下载完成");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "打包失败");
    }
  };

  return {
    files,
    loading,
    error,
    fetchList,
    uploadFile,
    readFile,
    readTextFile,
    saveTextFile,
    deleteFile,
    renameFile,
    clearFiles,
    downloadAsZip,
    downloadBucketZip,
    syncBucketDir,
  };
}
