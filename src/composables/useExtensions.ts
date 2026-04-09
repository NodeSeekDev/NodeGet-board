import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import { unzip } from "fflate";

// 将 zip 文件解压，模拟成 webkitRelativePath 格式的 File 数组
export const extractZipToFiles = (zipFile: File): Promise<File[]> =>
  new Promise((resolve, reject) => {
    zipFile.arrayBuffer().then((buf) => {
      unzip(new Uint8Array(buf), (err, data) => {
        if (err) return reject(err);
        const files: File[] = [];
        // zip 根目录可能有也可能没有顶层文件夹，统一加一层与文件夹选择保持一致
        const entries = Object.entries(data);
        // 检测顶层目录名
        const topDirs = new Set(entries.map(([p]) => p.split("/")[0]));
        const hasTopDir =
          topDirs.size === 1 && !entries.some(([p]) => !p.includes("/"));
        const prefix = hasTopDir
          ? ""
          : `${zipFile.name.replace(/\.zip$/i, "")}/`;

        for (const [path, content] of entries) {
          if (path.endsWith("/")) continue; // 跳过目录条目
          const fullPath = prefix + path;
          const blob = new Blob([content.buffer as ArrayBuffer]);
          const file = new File([blob], fullPath.split("/").pop()!, {
            type: "",
          });
          // 用 defineProperty 注入 webkitRelativePath（只读属性）
          Object.defineProperty(file, "webkitRelativePath", {
            value: fullPath,
            writable: false,
          });
          files.push(file);
        }
        resolve(files);
      });
    });
  });

export const EXTENSION_NAMESPACE = "extension-infomation";

export type AppJsonRoute = {
  type: "node" | "global";
  name: string;
  icon?: string;
  entry: string;
};

export type AppJson = {
  name: string;
  icon?: string;
  routes: AppJsonRoute[];
  limits?: unknown[];
  version?: string;
  description?: string;
  extension_version?: number;
  author?: string;
  repository?: string;
  homepage?: string;
  license?: string;
  worker?: {
    filename: string;
    env?: Record<string, string>;
  };
};

export type ExtensionFile = {
  path: string;
  size: number;
};

export type ExtensionKvData = {
  app: AppJson;
  disabled: boolean;
  token: string;
  created_at: number;
  updated_at: number | null;
  readme: string;
  worker_name: string | null;
  files?: ExtensionFile[];
};

export type Extension = ExtensionKvData & { id: string };

export function useExtensions() {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const backendToken = computed(() => currentBackend.value?.token ?? "");

  const extensions = ref<Extension[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const rpc = <T>(method: string, params: unknown): Promise<T> =>
    getWsConnection(backendUrl.value).call<T>(method, params);

  // 按扩展名推断 MIME type（file.type 为空时的 fallback）
  const guessMimeType = (filename: string): string | undefined => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      svg: "image/svg+xml",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      ico: "image/x-icon",
      js: "application/javascript",
      css: "text/css",
      html: "text/html",
      json: "application/json",
      wasm: "application/wasm",
    };
    return ext ? map[ext] : undefined;
  };

  // backend.url 是 WebSocket 地址（wss/ws），静态文件接口需要 HTTP(S)
  const httpBaseUrl = computed(() =>
    backendUrl.value
      .replace(/^wss:\/\//, "https://")
      .replace(/^ws:\/\//, "http://"),
  );

  const ensureNamespace = async () => {
    const namespaces = await rpc<string[]>("kv_list_all_namespace", {
      token: backendToken.value,
    });
    if (
      !Array.isArray(namespaces) ||
      !namespaces.includes(EXTENSION_NAMESPACE)
    ) {
      await rpc("kv_create", {
        token: backendToken.value,
        namespace: EXTENSION_NAMESPACE,
      });
    }
  };

  const fetchExtensions = async () => {
    if (!backendUrl.value) return;
    loading.value = true;
    error.value = null;
    try {
      await ensureNamespace();
      const results = await rpc<
        { namespace: string; key: string; value: unknown }[]
      >("kv_get_multi_value", {
        token: backendToken.value,
        namespace_key: [{ namespace: EXTENSION_NAMESPACE, key: "*" }],
      });
      extensions.value = Array.isArray(results)
        ? results
            .filter((r) => r.value && typeof r.value === "object")
            .map((r) => ({ id: r.key, ...(r.value as ExtensionKvData) }))
        : [];
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
      extensions.value = [];
    } finally {
      loading.value = false;
    }
  };

  const saveExtension = async (id: string, data: ExtensionKvData) => {
    await rpc("kv_set_value", {
      token: backendToken.value,
      namespace: EXTENSION_NAMESPACE,
      key: id,
      value: data,
    });
    const idx = extensions.value.findIndex((e) => e.id === id);
    if (idx >= 0) {
      extensions.value[idx] = { id, ...data };
    } else {
      extensions.value.push({ id, ...data });
    }
  };

  const toggleExtension = async (id: string, disabled: boolean) => {
    const ext = extensions.value.find((e) => e.id === id);
    if (!ext) return;
    const updated: ExtensionKvData = {
      ...ext,
      disabled,
      updated_at: Date.now(),
    };
    await saveExtension(id, updated);
  };

  const deleteExtension = async (id: string) => {
    await rpc("kv_delete_key", {
      token: backendToken.value,
      namespace: EXTENSION_NAMESPACE,
      key: id,
    });
    extensions.value = extensions.value.filter((e) => e.id !== id);
  };

  const uploadFile = async (
    extensionId: string,
    path: string,
    content: ArrayBuffer,
    contentType?: string,
  ) => {
    const url = `${httpBaseUrl.value}/worker-route/static-worker-route/${extensionId}/${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${backendToken.value}`,
    };
    if (contentType) headers["Content-Type"] = contentType;
    const resp = await fetch(url, {
      method: "POST",
      body: content,
      headers,
    });
    if (!resp.ok) {
      throw new Error(
        `上传文件 ${path} 失败: ${resp.status} ${resp.statusText}`,
      );
    }
  };

  const createExtensionToken = async (limits: unknown[]): Promise<string> => {
    const tokenLimit =
      limits.length > 0
        ? limits
        : [
            {
              scopes: ["global"],
              permissions: [
                { static_monitoring: { read: "cpu" } },
                { static_monitoring: { read: "system" } },
                { dynamic_monitoring: { read: "cpu" } },
                { dynamic_monitoring: { read: "system" } },
              ],
            },
          ];

    const result = await rpc<{ key?: string; secret?: string }>(
      "token_create",
      {
        father_token: backendToken.value,
        token_creation: {
          username: null,
          password: null,
          timestamp_from: null,
          timestamp_to: null,
          version: 1,
          token_limit: tokenLimit,
        },
      },
    );

    const key = result?.key || "";
    const secret = result?.secret || "";
    if (!key || !secret) throw new Error("Token 创建成功但未返回 key/secret");
    return `${key}:${secret}`;
  };

  const installExtension = async (
    files: File[],
    onProgress?: (msg: string) => void,
  ): Promise<string> => {
    // 找到 app.json
    const appJsonFile = files.find((f) => {
      const parts = f.webkitRelativePath.split("/");
      return parts[parts.length - 1] === "app.json" && parts.length === 2;
    });
    if (!appJsonFile) throw new Error("未找到根目录下的 app.json 文件");

    const appJsonText = await appJsonFile.text();
    let appJson: AppJson;
    try {
      appJson = JSON.parse(appJsonText);
    } catch {
      throw new Error("app.json 格式错误，无法解析");
    }

    // 找到 readme.md
    const readmeFile = files.find((f) => {
      const parts = f.webkitRelativePath.split("/");
      return (
        (parts[parts.length - 1] ?? "").toLowerCase() === "readme.md" &&
        parts.length === 2
      );
    });
    const readme = readmeFile ? await readmeFile.text() : "";

    // 生成扩展 UUID
    const extensionId = crypto.randomUUID();

    onProgress?.("正在创建 Token...");
    await ensureNamespace();
    const token = await createExtensionToken(appJson.limits ?? []);

    onProgress?.("正在上传静态文件...");

    // 上传 resources/ 目录下的文件
    const rootFolder = files[0]?.webkitRelativePath.split("/")[0] ?? "";
    const resourcePrefix = `${rootFolder}/resources/`;
    const resourceFiles = files.filter((f) =>
      f.webkitRelativePath.startsWith(resourcePrefix),
    );
    const uploadedFiles: ExtensionFile[] = [];

    for (const file of resourceFiles) {
      const relativePath = file.webkitRelativePath.slice(resourcePrefix.length);
      if (!relativePath) continue;
      const content = await file.arrayBuffer();
      await uploadFile(
        extensionId,
        relativePath,
        content,
        file.type || guessMimeType(file.name),
      );
      uploadedFiles.push({ path: relativePath, size: file.size });
      onProgress?.(`已上传: ${relativePath}`);
    }

    onProgress?.("正在保存扩展信息...");

    const kvData: ExtensionKvData = {
      app: appJson,
      disabled: false,
      token,
      created_at: Date.now(),
      updated_at: null,
      readme,
      worker_name: null,
      files: uploadedFiles,
    };

    await saveExtension(extensionId, kvData);
    return extensionId;
  };

  // 重装：保持 Extension_UUID 不变，重新上传文件；limits 变化则重新签发 token
  const reinstallExtension = async (
    existing: Extension,
    files: File[],
    onProgress?: (msg: string) => void,
  ): Promise<void> => {
    const appJsonFile = files.find((f) => {
      const parts = f.webkitRelativePath.split("/");
      return parts[parts.length - 1] === "app.json" && parts.length === 2;
    });
    if (!appJsonFile) throw new Error("未找到根目录下的 app.json 文件");

    const appJsonText = await appJsonFile.text();
    let appJson: AppJson;
    try {
      appJson = JSON.parse(appJsonText);
    } catch {
      throw new Error("app.json 格式错误，无法解析");
    }

    const readmeFile = files.find((f) => {
      const parts = f.webkitRelativePath.split("/");
      return (
        (parts[parts.length - 1] ?? "").toLowerCase() === "readme.md" &&
        parts.length === 2
      );
    });
    const readme = readmeFile ? await readmeFile.text() : existing.readme;

    // 比较 limits，若有变化则删除旧 token 并重新生成
    const oldLimits = JSON.stringify(existing.app.limits ?? []);
    const newLimits = JSON.stringify(appJson.limits ?? []);
    let token = existing.token;

    if (oldLimits !== newLimits) {
      onProgress?.("Token 权限变化，正在删除旧 Token...");
      const [oldKey] = existing.token.split(":");
      if (oldKey) {
        try {
          await rpc("token_delete", {
            father_token: backendToken.value,
            key: oldKey,
          });
        } catch {
          // 旧 token 不存在时忽略错误
        }
      }
      onProgress?.("正在创建新 Token...");
      token = await createExtensionToken(appJson.limits ?? []);
    } else {
      onProgress?.("Token 权限未变化，复用原 Token");
    }

    onProgress?.("正在上传静态文件...");
    const rootFolder = files[0]?.webkitRelativePath.split("/")[0] ?? "";
    const resourcePrefix = `${rootFolder}/resources/`;
    const resourceFiles = files.filter((f) =>
      f.webkitRelativePath.startsWith(resourcePrefix),
    );
    const uploadedFiles: ExtensionFile[] = [];

    for (const file of resourceFiles) {
      const relativePath = file.webkitRelativePath.slice(resourcePrefix.length);
      if (!relativePath) continue;
      const content = await file.arrayBuffer();
      await uploadFile(
        existing.id,
        relativePath,
        content,
        file.type || undefined,
      );
      uploadedFiles.push({ path: relativePath, size: file.size });
      onProgress?.(`已上传: ${relativePath}`);
    }

    onProgress?.("正在更新扩展信息...");
    const kvData: ExtensionKvData = {
      ...existing,
      app: appJson,
      token,
      updated_at: Date.now(),
      readme,
      files: uploadedFiles,
    };

    await saveExtension(existing.id, kvData);
  };

  const getStaticUrl = (extensionId: string, path: string): string => {
    return `${httpBaseUrl.value}/worker-route/static-worker-route/${extensionId}/${path}`;
  };

  const getIframeUrl = (
    extensionId: string,
    entry: string,
    token: string,
    nodeUuid?: string,
  ): string => {
    const base = getStaticUrl(extensionId, entry);
    const params: string[] = [`token=${encodeURIComponent(token)}`];
    if (nodeUuid) params.push(`node=${encodeURIComponent(nodeUuid)}`);
    return `${base}#?${params.join("&")}`;
  };

  return {
    extensions,
    loading,
    error,
    fetchExtensions,
    saveExtension,
    toggleExtension,
    deleteExtension,
    installExtension,
    reinstallExtension,
    getStaticUrl,
    getIframeUrl,
  };
}
