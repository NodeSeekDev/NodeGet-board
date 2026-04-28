import { ref, computed } from "vue";
import { useBackendStore } from "@/composables/useBackendStore";
import { useThemeStore } from "@/stores/theme";
import { getWsConnection } from "@/composables/useWsConnection";
import { useJsRuntime } from "@/composables/useJsRuntime";
import { useCron } from "@/composables/useCron";
import { unzip } from "fflate";

// 将 zip 文件解压，模拟成 webkitRelativePath 格式的 File 数组
export const extractZipToFiles = (zipFile: File): Promise<File[]> =>
  new Promise((resolve, reject) => {
    zipFile.arrayBuffer().then((buf) => {
      unzip(new Uint8Array(buf), (err, data) => {
        if (err) return reject(err);
        const files: File[] = [];
        const entries = Object.entries(data);
        const appJsonPath = entries.find(
          ([p]) => p === "app.json" || /^[^/]+\/app\.json$/.test(p),
        )?.[0];
        const hasTopDir = !!appJsonPath && appJsonPath !== "app.json";
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

export const EXTENSION_NAMESPACE = "extension-information";

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
    cron?: string;
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

const extensions = ref<Extension[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

export function useExtensions() {
  const { currentBackend } = useBackendStore();
  const backendUrl = computed(() => currentBackend.value?.url ?? "");
  const backendToken = computed(() => currentBackend.value?.token ?? "");

  const jsRuntime = useJsRuntime();
  const cronApi = useCron();

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
    const ext = extensions.value.find((e) => e.id === id);
    if (ext?.worker_name) {
      try {
        await cronApi.remove(ext.worker_name);
      } catch {
        /* ignore */
      }
      try {
        await jsRuntime.deleteWorker(ext.worker_name);
      } catch {
        /* ignore */
      }
    }
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

    // 注册 Worker（如果存在）
    let worker_name: string | null = null;
    if (appJson.worker?.filename) {
      const workerFile = files.find((f) => {
        const parts = f.webkitRelativePath.split("/");
        return (
          parts[parts.length - 1] === appJson.worker!.filename &&
          parts.length === 2
        );
      });
      if (workerFile) {
        const workerContent = await workerFile.text();
        const workerName = `[extension-worker]:${extensionId}`;
        try {
          await jsRuntime.addWorker({
            name: workerName,
            content: workerContent,
            routeName: extensionId,
            env: { ...(appJson.worker.env ?? {}), token },
          });
          worker_name = workerName;
          onProgress?.(`已注册 Worker: ${workerName}`);
        } catch (e: unknown) {
          onProgress?.(
            `Worker 注册失败（已忽略）: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        if (worker_name && appJson.worker.cron) {
          try {
            await cronApi.create({
              name: worker_name,
              cron_expression: appJson.worker.cron,
              cron_type: { server: { js_worker: [worker_name, {}] } },
            });
            onProgress?.(`已注册定时任务: ${appJson.worker.cron}`);
          } catch {
            onProgress?.("定时任务注册失败（已忽略）");
          }
        }
      }
    }

    onProgress?.("正在保存扩展信息...");

    const kvData: ExtensionKvData = {
      app: appJson,
      disabled: false,
      token,
      created_at: Date.now(),
      updated_at: null,
      readme,
      worker_name,
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

    // 更新 Worker
    let worker_name: string | null = existing.worker_name;

    // 先尝试删除旧 cron（名字跟着 worker_name 走）
    if (existing.worker_name) {
      try {
        await cronApi.remove(existing.worker_name);
      } catch {
        /* ignore */
      }
    }

    if (appJson.worker?.filename) {
      const workerFilename = appJson.worker.filename;
      const workerFile = files.find((f) => {
        const parts = f.webkitRelativePath.split("/");
        return parts[parts.length - 1] === workerFilename && parts.length === 2;
      });
      if (workerFile) {
        const workerContent = await workerFile.text();
        const workerName = `[extension-worker]:${existing.id}`;
        const workerEnv = { ...(appJson.worker.env ?? {}), token };
        try {
          if (existing.worker_name === workerName) {
            await jsRuntime.updateWorker(workerName, {
              content: workerContent,
              env: workerEnv,
            });
            onProgress?.(`已更新 Worker: ${workerName}`);
          } else {
            if (existing.worker_name) {
              try {
                await jsRuntime.deleteWorker(existing.worker_name);
              } catch {
                /* ignore */
              }
            }
            await jsRuntime.addWorker({
              name: workerName,
              content: workerContent,
              routeName: existing.id,
              env: workerEnv,
            });
            onProgress?.(`已注册 Worker: ${workerName}`);
          }
          worker_name = workerName;
        } catch (e: unknown) {
          onProgress?.(
            `Worker 注册失败（已忽略）: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        if (worker_name && appJson.worker.cron) {
          try {
            await cronApi.create({
              name: worker_name,
              cron_expression: appJson.worker.cron,
              cron_type: { server: { js_worker: [worker_name, {}] } },
            });
            onProgress?.(`已注册定时任务: ${appJson.worker.cron}`);
          } catch {
            onProgress?.("定时任务注册失败（已忽略）");
          }
        }
      } else {
        // 新文件里没有 worker.js，清理旧 worker
        if (existing.worker_name) {
          try {
            await jsRuntime.deleteWorker(existing.worker_name);
          } catch {
            /* ignore */
          }
        }
        worker_name = null;
      }
    } else {
      // 新 app.json 无 worker 配置，清理旧 worker
      if (existing.worker_name) {
        try {
          await jsRuntime.deleteWorker(existing.worker_name);
        } catch {
          /* ignore */
        }
      }
      worker_name = null;
    }

    onProgress?.("正在更新扩展信息...");
    const kvData: ExtensionKvData = {
      ...existing,
      app: appJson,
      token,
      updated_at: Date.now(),
      readme,
      worker_name,
      files: uploadedFiles,
    };

    await saveExtension(existing.id, kvData);
  };

  const getStaticUrl = (extensionId: string, path: string): string => {
    return `${httpBaseUrl.value}/worker-route/static-worker-route/${extensionId}/${path}`;
  };

  const getIframeUrl = async (
    extensionId: string,
    entry: string,
    token: string,
    nodeUuid?: string,
    workerName?: string | null,
  ): Promise<string> => {
    let base: string;
    if (entry.startsWith("@")) {
      const workerEntry = entry.slice(1).replace(/^\//, "");
      // 通过 worker_name 查询实际注册的 route，不能假定 route === extensionId
      const route = workerName
        ? ((await jsRuntime.getWorker(workerName))?.route ?? extensionId)
        : extensionId;
      base = `${httpBaseUrl.value}/worker-route/${route}/${workerEntry}`;
    } else {
      base = getStaticUrl(extensionId, entry);
    }
    const theme = useThemeStore().isDark ? "dark" : "light";
    const params: string[] = [
      `token=${encodeURIComponent(token)}`,
      `theme=${theme}`,
    ];
    if (nodeUuid) params.push(`node=${encodeURIComponent(nodeUuid)}`);
    return `${base}#?${params.join("&")}`;
  };

  // 快捷扩展：直接绑定已有 Worker，不需要上传完整扩展包
  const createQuickExtension = async (
    name: string,
    workerName: string,
    onProgress?: (msg: string) => void,
  ): Promise<string> => {
    const extensionId = crypto.randomUUID();
    const routeName = crypto.randomUUID();

    // Lucide Zap 风格的闪电 SVG
    const zapSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    const svgBytes = new TextEncoder().encode(zapSvg).buffer as ArrayBuffer;

    onProgress?.("正在初始化命名空间...");
    await ensureNamespace();

    onProgress?.("正在上传图标...");
    await uploadFile(extensionId, "assets/icon.svg", svgBytes, "image/svg+xml");

    const appJson: AppJson = {
      name,
      icon: "assets/icon.svg",
      routes: [
        {
          type: "node",
          name: routeName,
          icon: "assets/icon.svg",
          entry: "@index.html",
        },
      ],
    };

    const kvData: ExtensionKvData = {
      app: appJson,
      disabled: false,
      token: "nothing",
      created_at: Date.now(),
      updated_at: null,
      readme: "",
      worker_name: workerName,
      files: [{ path: "assets/icon.svg", size: svgBytes.byteLength }],
    };

    onProgress?.("正在保存扩展信息...");
    await saveExtension(extensionId, kvData);

    return extensionId;
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
    uploadFile,
    getStaticUrl,
    getIframeUrl,
    createQuickExtension,
  };
}
