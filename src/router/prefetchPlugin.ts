import type { App, Plugin } from "vue";
import type { RouteComponent, RouteRecordRaw, Router } from "vue-router";

/** `() => import(...)` 形式生成的懒加载组件加载器。 */
type Loader<T = unknown> = () => Promise<T>;
/** 路由记录中异步组件的函数签名。 */
type AsyncComponent = () => Promise<RouteComponent>;
/** 路由组件，既可能是同步组件，也可能是异步组件。 */
type RouteComp = RouteComponent | AsyncComponent;
/** 路由 `meta` 中可声明的预加载模式，也支持直接传入数值优先级。 */
type PrefetchMode = boolean | number | "high" | "normal" | "low" | "off";

/** 预加载逻辑中使用的固定优先级枚举。 */
export enum RoutePrefetchPriority {
  Low = 80,
  Normal = 180,
  High = 260,
}

/** 预加载策略会读取的路由 `meta` 字段。 */
type PrefetchMeta = {
  hidden?: boolean;
  isClosed?: boolean;
  prefetch?: PrefetchMode;
};

/** 内部维护的可预加载路由组件条目。 */
type LoaderEntry = {
  /** 包装后的 loader，暴露给 vue-router 与 preload 队列调用，失败可重试。 */
  loader: Loader;
  /** 原始 `() => import(...)`，仅在 wrapper 内部触发实际加载。 */
  original: Loader;
  path: string;
  priority: number;
  /** 当前正在进行的加载 promise，用于去重并发请求。 */
  inFlight?: Promise<unknown>;
  /** prefetch 失败累计次数；用户主动导航不计入。 */
  prefetchAttempts: number;
  /** 时间戳：在此之前 prefetch 队列跳过本条目（指数退避用）。 */
  prefetchRetryAt?: number;
};

/** 优先级计算结果，同时包含跳过原因说明。 */
type PriorityResult = {
  priority: number | null;
  reason: string;
};

/** 根据数值优先级映射出的 Devtools 分组桶。 */
type PriorityBucket = "high" | "normal" | "low" | "skipped";

/** 展示在自定义 Devtools Inspector 中的扁平化路由信息。 */
type RouteInspectorEntry = {
  path: string;
  priority: number | null;
  reason: string;
  bucket: PriorityBucket;
};

/** 预加载事件在 Devtools 时间线中的日志等级。 */
type DevtoolsLogType = "default" | "warning" | "error";

/** Devtools 注册前后都会使用的时间线事件结构。 */
type DevtoolsTimelineEvent = {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
  logType?: DevtoolsLogType;
};

/** Devtools Inspector 树节点的最小结构定义。 */
type InspectorNode = {
  id: string;
  label: string;
  children?: InspectorNode[];
  tags?: Array<{
    label: string;
    textColor: number;
    backgroundColor: number;
    tooltip?: string;
  }>;
};

/** Vue Devtools Inspector 状态面板所需的最小结构定义。 */
type InspectorState = Record<
  string,
  Array<{
    key: string;
    value: unknown;
  }>
>;

/** 当前插件实际使用到的 Vue Devtools API 子集。 */
type DevtoolsApi = {
  addTimelineLayer(options: { id: string; label: string; color: number }): void;
  addTimelineEvent(options: {
    layerId: string;
    event: {
      time: number;
      title: string;
      subtitle?: string;
      data: Record<string, unknown>;
      logType?: DevtoolsLogType;
    };
  }): void;
  addInspector(options: { id: string; label: string; icon?: string }): void;
  sendInspectorTree(inspectorId: string): void;
  sendInspectorState(inspectorId: string): void;
  on: {
    getInspectorTree(
      handler: (payload: {
        inspectorId: string;
        filter: string;
        rootNodes: InspectorNode[];
      }) => void,
    ): void;
    getInspectorState(
      handler: (payload: {
        inspectorId: string;
        nodeId: string;
        state: InspectorState;
      }) => void,
    ): void;
  };
  now?(): number;
};

const loaders = new Map<Loader, LoaderEntry>();
const loaded = new Set<Loader>();
const pendingDevtoolsEvents: DevtoolsTimelineEvent[] = [];
const routeEntries = new Map<string, RouteInspectorEntry>();
const recentEvents: Array<
  DevtoolsTimelineEvent & {
    time: number;
    path?: string;
    priority?: number | null;
  }
> = [];

let debounceTimer: number | null = null;
let isPreloading = false;
let devtoolsApi: DevtoolsApi | null = null;
let devtoolsLayerAdded = false;
let devtoolsInspectorAdded = false;
let visibilityListenerAttached = false;
const installedRouters = new WeakSet<Router>();

/** 在 Devtools 中注册插件时使用的稳定插件标识。 */
const DEVTOOLS_PLUGIN_ID = "nodeget:router-prefetch";
/** 预加载生命周期事件所在的时间线层标识。 */
const DEVTOOLS_LAYER_ID = "nodeget:router-prefetch:timeline";
/** 自定义路由预加载 Inspector 面板的标识。 */
const DEVTOOLS_INSPECTOR_ID = "nodeget:router-prefetch:inspector";
/** 自定义 Inspector 树中根摘要节点的标识。 */
const DEVTOOLS_INSPECTOR_NODE_ID = "summary";
/** `requestIdleCallback` 最长等待时间，超过后允许以超时形式执行预加载。 */
const IDLE_CALLBACK_TIMEOUT = 1000;
/** 单条目 prefetch 最大尝试次数；超过后等待 visibility/导航事件重置。 */
const PREFETCH_MAX_ATTEMPTS = 3;
/** prefetch 失败后的退避时长（毫秒），按尝试次数取索引。 */
const PREFETCH_BACKOFF_MS = [5_000, 15_000, 30_000];

/** Devtools 中各优先级分组对应的人类可读标签。 */
const PRIORITY_BUCKET_LABELS: Record<PriorityBucket, string> = {
  high: "High",
  normal: "Normal",
  low: "Low",
  skipped: "Skipped",
};

/** 各优先级分组在 Inspector 标签和分组展示中复用的颜色。 */
const PRIORITY_BUCKET_COLORS: Record<PriorityBucket, number> = {
  high: 0xef4444,
  normal: 0x3b82f6,
  low: 0xf59e0b,
  skipped: 0x6b7280,
};

function isDebugEnabled() {
  if (typeof window === "undefined") return false;

  const debugWindow = window as Window & {
    __ROUTER_PREFETCH_DEBUG__?: boolean;
  };

  return (
    import.meta.env.DEV ||
    debugWindow.__ROUTER_PREFETCH_DEBUG__ === true ||
    window.localStorage.getItem("router-prefetch-debug") === "1"
  );
}

function ensureDevtoolsLayer() {
  if (!devtoolsApi || devtoolsLayerAdded) return;

  devtoolsApi.addTimelineLayer({
    id: DEVTOOLS_LAYER_ID,
    label: "Route Prefetch",
    color: 0x3b82f6,
  });
  devtoolsLayerAdded = true;
}

function ensureDevtoolsInspector() {
  if (!devtoolsApi || devtoolsInspectorAdded) return;

  devtoolsApi.addInspector({
    id: DEVTOOLS_INSPECTOR_ID,
    label: "Route Prefetch",
    icon: "route",
  });

  devtoolsApi.on.getInspectorTree((payload) => {
    if (payload.inspectorId !== DEVTOOLS_INSPECTOR_ID) return;

    const filter = payload.filter.trim().toLowerCase();
    const groupedEntries = getGroupedRouteEntries();

    payload.rootNodes = [
      {
        id: DEVTOOLS_INSPECTOR_NODE_ID,
        label: "Summary",
        tags: [
          {
            label: `${getPendingLoaders().length} pending`,
            textColor: 0xffffff,
            backgroundColor: 0x3b82f6,
          },
          {
            label: `${loaded.size} loaded`,
            textColor: 0xffffff,
            backgroundColor: 0x10b981,
          },
        ],
      },
      ...(["high", "normal", "low", "skipped"] as PriorityBucket[]).map(
        (bucket) => {
          const entries = groupedEntries[bucket].filter((entry) =>
            !filter ? true : entry.path.toLowerCase().includes(filter),
          );

          return {
            id: `bucket:${bucket}`,
            label: PRIORITY_BUCKET_LABELS[bucket],
            tags: [
              {
                label: String(entries.length),
                textColor: 0xffffff,
                backgroundColor: PRIORITY_BUCKET_COLORS[bucket],
              },
            ],
            children: entries.map((entry) => ({
              id: `route:${entry.path}`,
              label: entry.path,
              tags: buildRouteTags(entry),
            })),
          };
        },
      ),
    ];
  });

  devtoolsApi.on.getInspectorState((payload) => {
    if (payload.inspectorId !== DEVTOOLS_INSPECTOR_ID) return;

    if (payload.nodeId === DEVTOOLS_INSPECTOR_NODE_ID) {
      payload.state = {
        summary: [
          { key: "registered routes", value: routeEntries.size },
          { key: "preload targets", value: loaders.size },
          { key: "loaded routes", value: loaded.size },
          { key: "pending routes", value: getPendingLoaders().length },
          { key: "is preloading", value: isPreloading },
        ],
        recent: recentEvents
          .slice(-10)
          .reverse()
          .map((event) => ({
            key: `${new Date(event.time).toLocaleTimeString()} ${event.title}`,
            value: {
              subtitle: event.subtitle,
              path: event.path,
              priority: event.priority,
              data: event.data,
            },
          })),
      };
      return;
    }

    if (payload.nodeId.startsWith("bucket:")) {
      const bucket = payload.nodeId.slice("bucket:".length) as PriorityBucket;
      const entries = getGroupedRouteEntries()[bucket];

      payload.state = {
        summary: [
          { key: "bucket", value: PRIORITY_BUCKET_LABELS[bucket] },
          { key: "routes", value: entries.length },
          {
            key: "loaded",
            value: entries.filter(
              (entry) => getRouteLoadStatus(entry) === "loaded",
            ).length,
          },
          {
            key: "pending",
            value: entries.filter(
              (entry) => getRouteLoadStatus(entry) === "pending",
            ).length,
          },
        ],
        routes: entries.map((entry) => ({
          key: entry.path,
          value: {
            priority: entry.priority,
            reason: entry.reason,
            status: getRouteLoadStatus(entry),
          },
        })),
      };
      return;
    }

    if (payload.nodeId.startsWith("route:")) {
      const path = payload.nodeId.slice("route:".length);
      const entry = routeEntries.get(path);
      if (!entry) return;

      payload.state = {
        route: [
          { key: "path", value: entry.path },
          { key: "bucket", value: PRIORITY_BUCKET_LABELS[entry.bucket] },
          { key: "priority", value: entry.priority },
          { key: "status", value: getRouteLoadStatus(entry) },
          { key: "reason", value: entry.reason },
        ],
      };
    }
  });

  devtoolsInspectorAdded = true;
}

function updateDevtoolsInspector() {
  if (!devtoolsApi || !devtoolsInspectorAdded) return;
  devtoolsApi.sendInspectorTree(DEVTOOLS_INSPECTOR_ID);
  devtoolsApi.sendInspectorState(DEVTOOLS_INSPECTOR_ID);
}

function getPriorityBucket(priority: number | null): PriorityBucket {
  if (priority === null) return "skipped";
  if (priority >= RoutePrefetchPriority.High) return "high";
  if (priority >= RoutePrefetchPriority.Normal) return "normal";
  return "low";
}

function upsertRouteEntry(path: string, result: PriorityResult) {
  routeEntries.set(path, {
    path,
    priority: result.priority,
    reason: result.reason,
    bucket: getPriorityBucket(result.priority),
  });
}

function getGroupedRouteEntries() {
  const groups: Record<PriorityBucket, RouteInspectorEntry[]> = {
    high: [],
    normal: [],
    low: [],
    skipped: [],
  };

  for (const entry of routeEntries.values()) {
    groups[entry.bucket].push(entry);
  }

  for (const bucket of Object.keys(groups) as PriorityBucket[]) {
    groups[bucket].sort((a, b) => {
      const pa = a.priority ?? -1;
      const pb = b.priority ?? -1;
      return pb - pa || a.path.localeCompare(b.path);
    });
  }

  return groups;
}

function getRouteLoadStatus(entry: RouteInspectorEntry) {
  if (entry.priority === null) return "skipped";

  const matchedLoaders = [...loaders.values()].filter(
    (loaderEntry) => loaderEntry.path === entry.path,
  );

  if (!matchedLoaders.length) return "unknown";
  if (matchedLoaders.every((loaderEntry) => loaded.has(loaderEntry.loader))) {
    return "loaded";
  }
  return "pending";
}

function buildRouteTags(entry: RouteInspectorEntry) {
  const status = getRouteLoadStatus(entry);
  const tags = [
    {
      label: status,
      textColor: 0xffffff,
      backgroundColor:
        status === "loaded"
          ? 0x10b981
          : status === "pending"
            ? 0x3b82f6
            : 0x6b7280,
    },
  ];

  if (entry.priority !== null) {
    tags.push({
      label: String(entry.priority),
      textColor: 0xffffff,
      backgroundColor: PRIORITY_BUCKET_COLORS[entry.bucket],
    });
  }

  return tags;
}

function pushDevtoolsEvent(event: DevtoolsTimelineEvent) {
  recentEvents.push({
    ...event,
    time: Date.now(),
    path: typeof event.data.path === "string" ? event.data.path : undefined,
    priority:
      typeof event.data.priority === "number" || event.data.priority === null
        ? (event.data.priority as number | null)
        : undefined,
  });
  if (recentEvents.length > 50) {
    recentEvents.splice(0, recentEvents.length - 50);
  }

  if (!devtoolsApi) {
    pendingDevtoolsEvents.push(event);
    return;
  }

  ensureDevtoolsLayer();
  ensureDevtoolsInspector();
  devtoolsApi.addTimelineEvent({
    layerId: DEVTOOLS_LAYER_ID,
    event: {
      time: devtoolsApi.now?.() ?? Date.now(),
      title: event.title,
      subtitle: event.subtitle,
      data: event.data,
      logType: event.logType,
    },
  });
  updateDevtoolsInspector();
}

function flushPendingDevtoolsEvents() {
  if (!devtoolsApi || pendingDevtoolsEvents.length === 0) return;

  for (const event of pendingDevtoolsEvents.splice(0)) {
    pushDevtoolsEvent(event);
  }
}

function log(message: string, data: Record<string, unknown> = {}) {
  pushDevtoolsEvent({
    title: message,
    data,
  });
}

function logWarn(message: string, data: Record<string, unknown> = {}) {
  pushDevtoolsEvent({
    title: message,
    data,
    logType: "warning",
  });
}

function debouncePreload() {
  if (typeof window === "undefined") return;

  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    log("schedule preload on idle");
    scheduleIdle(preload);
  }, 200);
}

function requestPreload(reason: string, data: Record<string, unknown> = {}) {
  log(reason, data);
  debouncePreload();
}

function scheduleIdle(fn: (deadline?: IdleDeadline) => void) {
  if (typeof window === "undefined") return;

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
    ) => number;
  };

  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback((deadline) => fn(deadline), {
      timeout: IDLE_CALLBACK_TIMEOUT,
    });
  } else {
    globalThis.setTimeout(() => fn(), 500);
  }
}

function getPendingLoaders() {
  const now = Date.now();
  return [...loaders.values()]
    .filter((entry) => {
      if (loaded.has(entry.loader)) return false;
      if (entry.inFlight) return false;
      if (entry.prefetchAttempts >= PREFETCH_MAX_ATTEMPTS) return false;
      if (entry.prefetchRetryAt && now < entry.prefetchRetryAt) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));
}

function preload(deadline?: IdleDeadline) {
  if (isPreloading) {
    log("skip preload tick because another loader is running");
    return;
  }

  const next = getPendingLoaders()[0];
  if (!next) {
    log("no pending routes to preload");
    return;
  }

  isPreloading = true;
  next.prefetchAttempts++;
  log("start preload", {
    path: next.path,
    priority: next.priority,
    attempt: next.prefetchAttempts,
    didTimeout: deadline?.didTimeout ?? false,
    remainingTime: deadline?.timeRemaining(),
  });

  // next.loader 是 wrapped 版本：成功会自动写入 loaded，失败会清空 inFlight 以便重试。
  next
    .loader()
    .then(() => {
      next.prefetchAttempts = 0;
      next.prefetchRetryAt = undefined;
      log("preload success", { path: next.path, priority: next.priority });
    })
    .catch((error) => {
      const idx = Math.min(
        next.prefetchAttempts - 1,
        PREFETCH_BACKOFF_MS.length - 1,
      );
      const backoff = PREFETCH_BACKOFF_MS[idx]!;
      next.prefetchRetryAt = Date.now() + backoff;
      logWarn("preload failed", {
        path: next.path,
        priority: next.priority,
        attempts: next.prefetchAttempts,
        backoffMs: backoff,
        givenUp: next.prefetchAttempts >= PREFETCH_MAX_ATTEMPTS,
        error,
      });
    })
    .finally(() => {
      isPreloading = false;
      if (getPendingLoaders().length > 0) {
        log("pending routes remain, scheduling next preload");
        debouncePreload();
      } else {
        log("all queued routes have been preloaded");
      }
    });
}

function makeWrappedLoader(entry: LoaderEntry): Loader {
  return () => {
    // 同一加载请求并发去重；若上一轮成功，inFlight 仍指向已 resolve 的 promise，复用即可。
    if (entry.inFlight) return entry.inFlight;

    const p = entry.original();
    entry.inFlight = p;
    p.then(
      () => {
        loaded.add(entry.loader);
      },
      () => {
        // 失败时丢弃 promise 缓存，让下次调用（用户点击或下次 prefetch tick）重新发起 import()。
        if (entry.inFlight === p) entry.inFlight = undefined;
        loaded.delete(entry.loader);
      },
    );
    return p;
  };
}

function registerLoader<T = unknown>(
  loader: Loader<T>,
  priority: number | null,
  path: string,
): Loader<T> {
  if (priority === null) return loader;

  const existing = loaders.get(loader as Loader);
  if (existing) {
    const nextPriority = Math.max(existing.priority, priority);
    if (nextPriority !== existing.priority || existing.path !== path) {
      log("update preload target", {
        path,
        previousPath: existing.path,
        previousPriority: existing.priority,
        priority: nextPriority,
      });
    }
    existing.priority = nextPriority;
    existing.path = path;
    debouncePreload();
    return existing.loader as Loader<T>;
  }

  // loaders 仍以 original loader 为 key 用于去重；entry.loader 是返回给 vue-router 的 wrapped 版本。
  const entry: LoaderEntry = {
    loader: undefined as unknown as Loader,
    original: loader as Loader,
    path,
    priority,
    prefetchAttempts: 0,
  };
  entry.loader = makeWrappedLoader(entry);
  loaders.set(loader as Loader, entry);
  log("register preload target", { path, priority });

  debouncePreload();
  return entry.loader as Loader<T>;
}

function wrapLoader(
  component: RouteComp,
  priority: number | null,
  path: string,
): RouteComp {
  if (typeof component === "function") {
    return registerLoader(component as AsyncComponent, priority, path);
  }

  return component;
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.replace(/\/+/g, "/");
}

function joinPath(parentPath: string, childPath: string) {
  if (!childPath) return normalizePath(parentPath);
  if (childPath.startsWith("/")) return normalizePath(childPath);
  if (!parentPath || parentPath === "/") return normalizePath(`/${childPath}`);
  return normalizePath(`${parentPath.replace(/\/$/, "")}/${childPath}`);
}

function isDynamicPath(path: string) {
  return path.includes(":");
}

function getExplicitPriority(meta?: PrefetchMeta): PriorityResult | undefined {
  if (!meta) return undefined;

  if (meta.prefetch === false || meta.prefetch === "off") {
    return { priority: null, reason: "meta.prefetch=off" };
  }
  if (typeof meta.prefetch === "number" && Number.isFinite(meta.prefetch)) {
    return {
      priority: meta.prefetch,
      reason: "meta.prefetch=number",
    };
  }

  switch (meta.prefetch) {
    case true:
    case "normal":
      return {
        priority: RoutePrefetchPriority.Normal,
        reason: "meta.prefetch=normal",
      };
    case "high":
      return {
        priority: RoutePrefetchPriority.High,
        reason: "meta.prefetch=high",
      };
    case "low":
      return {
        priority: RoutePrefetchPriority.Low,
        reason: "meta.prefetch=low",
      };
    default:
      return undefined;
  }
}

function getRoutePriority(
  route: RouteRecordRaw,
  fullPath: string,
): PriorityResult {
  const meta = route.meta as PrefetchMeta | undefined;
  const explicitPriority = getExplicitPriority(meta);

  if (explicitPriority !== undefined) {
    return explicitPriority;
  }

  if (meta?.hidden) return { priority: null, reason: "meta.hidden" };
  if (isDynamicPath(fullPath)) {
    return { priority: null, reason: "dynamic route" };
  }

  const depth = fullPath.split("/").filter(Boolean).length;
  if (depth > 3) return { priority: null, reason: "route depth > 3" };

  if (fullPath === "/dashboard") {
    return {
      priority: RoutePrefetchPriority.Normal,
      reason: "dashboard root fallback",
    };
  }
  if (fullPath === "/") {
    return {
      priority: RoutePrefetchPriority.Normal,
      reason: "home fallback",
    };
  }

  if (depth === 2 && fullPath.startsWith("/dashboard/")) {
    return {
      priority: RoutePrefetchPriority.Normal,
      reason: "dashboard top-level static page",
    };
  }

  if (depth === 3 && fullPath.startsWith("/dashboard/app/")) {
    return {
      priority: RoutePrefetchPriority.Low,
      reason: "dashboard app static child page",
    };
  }

  if (depth === 3 && fullPath.startsWith("/dashboard/settings/")) {
    return {
      priority: RoutePrefetchPriority.Low,
      reason: "dashboard settings static child page",
    };
  }

  return { priority: null, reason: "no prefetch heuristic matched" };
}

function processRoutes(routes: RouteRecordRaw[], parentPath = "") {
  for (const route of routes) {
    const fullPath = joinPath(parentPath, route.path);
    const result = getRoutePriority(route, fullPath);
    const { priority, reason } = result;

    upsertRouteEntry(fullPath, result);

    if (priority === null) {
      log("skip preload target", { path: fullPath, reason });
    } else {
      log("resolved preload priority", { path: fullPath, priority, reason });
    }

    if (route.component) {
      route.component = wrapLoader(
        route.component as RouteComp,
        priority,
        fullPath,
      ) as RouteRecordRaw["component"];
    }

    if (route.components) {
      for (const key in route.components) {
        const comp = route.components[key];
        route.components[key] = wrapLoader(
          comp as RouteComp,
          priority,
          fullPath,
        ) as RouteComponent;
      }
    }

    if (route.children) {
      processRoutes(route.children, fullPath);
    }
  }
}

function setupVisibilityListener() {
  if (typeof document === "undefined") return;
  if (visibilityListenerAttached) return;
  visibilityListenerAttached = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    // 标签页长时间隐藏后可能错过 prefetch 时机或卡在退避中；
    // 重新可见时重置所有未加载条目的失败计数，让队列可以再走一遍。
    let resetCount = 0;
    for (const entry of loaders.values()) {
      if (loaded.has(entry.loader)) continue;
      if (entry.prefetchAttempts > 0 || entry.prefetchRetryAt) {
        entry.prefetchAttempts = 0;
        entry.prefetchRetryAt = undefined;
        resetCount++;
      }
    }

    if (resetCount > 0 || getPendingLoaders().length > 0) {
      requestPreload("tab became visible", { resetCount });
    }
  });
}

function attachRoutePrefetchDevtools(app: App) {
  if (typeof window === "undefined") return;

  const target = window as Window & {
    __VUE_DEVTOOLS_GLOBAL_HOOK__?: {
      emit: (
        event: string,
        pluginDescriptor: Record<string, unknown>,
        setupFn: (api: DevtoolsApi) => void,
      ) => void;
    };
    __VUE_DEVTOOLS_PLUGIN_API_AVAILABLE__?: boolean;
    __VUE_DEVTOOLS_PLUGINS__?: Array<{
      pluginDescriptor: Record<string, unknown>;
      setupFn: (api: DevtoolsApi) => void;
      proxy: null;
    }>;
  };

  const pluginDescriptor = {
    id: DEVTOOLS_PLUGIN_ID,
    label: "Route Prefetch",
    packageName: "nodeget-board",
    homepage: "https://github.com",
    app,
    enableEarlyProxy: false,
  };

  const setupFn = (api: DevtoolsApi) => {
    devtoolsApi = api;
    ensureDevtoolsLayer();
    ensureDevtoolsInspector();
    flushPendingDevtoolsEvents();
    updateDevtoolsInspector();
  };

  const hook = target.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  if (hook) {
    hook.emit("devtools-plugin:setup", pluginDescriptor, setupFn);
    return;
  }

  target.__VUE_DEVTOOLS_PLUGINS__ = target.__VUE_DEVTOOLS_PLUGINS__ || [];
  target.__VUE_DEVTOOLS_PLUGINS__.push({
    pluginDescriptor,
    setupFn,
    proxy: null,
  });
}

export default function routePrefetchPlugin(router: Router): Plugin {
  return {
    install(app) {
      if (installedRouters.has(router)) return;
      installedRouters.add(router);

      attachRoutePrefetchDevtools(app);
      setupVisibilityListener();
      log("apply route prefetch plugin");
      processRoutes(router.options.routes as RouteRecordRaw[]);
      if (loaders.size === 0) {
        logWarn("no preload targets were registered");
      } else {
        requestPreload("prefetch targets registered", {
          targets: loaders.size,
        });
      }

      app.use(router);

      router.isReady().then(() => {
        requestPreload("router ready, request idle preload");
      });

      router.afterEach((to) => {
        if (getPendingLoaders().length === 0) return;

        requestPreload("route changed, request idle preload", {
          path: to.fullPath,
        });
      });
    },
  };
}
