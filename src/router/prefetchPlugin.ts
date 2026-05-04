import type { App } from "vue";
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
  /** 加载失败累计次数；成功会清零，prefetch 队列据此跳过/退避。 */
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

class LoaderRegistry {
  private entries = new Map<Loader, LoaderEntry>();
  private loaded = new Set<Loader>();

  get size() {
    return this.entries.size;
  }

  get loadedSize() {
    return this.loaded.size;
  }

  find(loader: Loader) {
    return this.entries.get(loader);
  }

  add(entry: LoaderEntry) {
    this.entries.set(entry.loader, entry);
  }

  markLoaded(entry: LoaderEntry) {
    this.loaded.add(entry.loader);
  }

  markFailed(entry: LoaderEntry) {
    this.loaded.delete(entry.loader);
  }

  isLoaded(entry: LoaderEntry) {
    return this.loaded.has(entry.loader);
  }

  isInFlight(entry: LoaderEntry) {
    return entry.inFlight !== undefined;
  }

  isExhausted(entry: LoaderEntry) {
    return entry.prefetchAttempts >= PREFETCH_MAX_ATTEMPTS;
  }

  isBackoffActive(entry: LoaderEntry, now = Date.now()) {
    return entry.prefetchRetryAt !== undefined && now < entry.prefetchRetryAt;
  }

  canPrefetch(entry: LoaderEntry, now = Date.now()) {
    return (
      !this.isLoaded(entry) &&
      !this.isInFlight(entry) &&
      !this.isExhausted(entry) &&
      !this.isBackoffActive(entry, now)
    );
  }

  pending(now = Date.now()) {
    return [...this.entries.values()]
      .filter((entry) => this.canPrefetch(entry, now))
      .sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));
  }

  statusForPath(path: string) {
    const matchedLoaders = [...this.entries.values()].filter(
      (entry) => entry.path === path,
    );

    if (!matchedLoaders.length) return "unknown";
    if (matchedLoaders.every((entry) => this.isLoaded(entry))) {
      return "loaded";
    }
    return "pending";
  }

  resetStaleFailures() {
    let resetCount = 0;
    for (const entry of this.entries.values()) {
      if (this.isLoaded(entry)) continue;
      if (this.isInFlight(entry)) continue;
      if (entry.prefetchAttempts > 0 || entry.prefetchRetryAt) {
        entry.prefetchAttempts = 0;
        entry.prefetchRetryAt = undefined;
        resetCount++;
      }
    }
    return resetCount;
  }
}

const loaderRegistry = new LoaderRegistry();
const routeEntries = new Map<string, RouteInspectorEntry>();

const configuredRouters = new WeakSet<Router>();
let debounceTimer: number | null = null;
let isPreloading = false;
let visibilityListenerAttached = false;
const installedRouters = new WeakSet<Router>();

/** `requestIdleCallback` 最长等待时间，超过后允许以超时形式执行预加载。 */
const IDLE_CALLBACK_TIMEOUT = 1000;
/** 单条目 prefetch 最大尝试次数；超过后等待 visibility/导航事件重置。 */
const PREFETCH_MAX_ATTEMPTS = 3;
/** prefetch 失败后的退避时长（毫秒），按尝试次数取索引。 */
const PREFETCH_BACKOFF_MS = [5_000, 15_000, 30_000];

class DevtoolsBridge {
  /** 在 Devtools 中注册插件时使用的稳定插件标识。 */
  private readonly pluginId = "nodeget:router-prefetch";
  /** 预加载生命周期事件所在的时间线层标识。 */
  private readonly layerId = "nodeget:router-prefetch:timeline";
  /** 自定义路由预加载 Inspector 面板的标识。 */
  private readonly inspectorId = "nodeget:router-prefetch:inspector";
  private readonly summaryNodeId = "summary";
  /** 在 devtools 接入前缓存的事件上限，避免生产环境无 devtools 时无界增长。 */
  private readonly pendingEventsMax = 200;
  /** Devtools 中各优先级分组对应的人类可读标签。 */
  private readonly bucketLabels: Record<PriorityBucket, string> = {
    high: "High",
    normal: "Normal",
    low: "Low",
    skipped: "Skipped",
  };
  /** 各优先级分组在 Inspector 标签和分组展示中复用的颜色。 */
  private readonly bucketColors: Record<PriorityBucket, number> = {
    high: 0xef4444,
    normal: 0x3b82f6,
    low: 0xf59e0b,
    skipped: 0x6b7280,
  };

  private api: DevtoolsApi | null = null;
  private layerAdded = false;
  private inspectorAdded = false;
  private snapshotActive = false;
  private routeGroupsSnapshot: Record<
    PriorityBucket,
    RouteInspectorEntry[]
  > | null = null;
  private pendingEvents: DevtoolsTimelineEvent[] = [];
  private recentEvents: Array<
    DevtoolsTimelineEvent & {
      time: number;
      path?: string;
      priority?: number | null;
    }
  > = [];

  attach(app: App) {
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
      id: this.pluginId,
      label: "Route Prefetch",
      packageName: "nodeget-board",
      homepage: "https://github.com",
      app,
      enableEarlyProxy: false,
    };

    const setupFn = (api: DevtoolsApi) => {
      this.api = api;
      this.ensureLayer();
      this.ensureInspector();
      this.flushPendingEvents();
      this.updateInspector();
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

  log(message: string, data: Record<string, unknown> = {}) {
    this.pushEvent({
      title: message,
      data,
    });
  }

  warn(message: string, data: Record<string, unknown> = {}) {
    this.pushEvent({
      title: message,
      data,
      logType: "warning",
    });
  }

  updateInspector() {
    if (!this.api || !this.inspectorAdded) return;
    this.snapshotActive = true;
    this.routeGroupsSnapshot = null;
    try {
      this.api.sendInspectorTree(this.inspectorId);
      this.api.sendInspectorState(this.inspectorId);
    } finally {
      this.routeGroupsSnapshot = null;
      this.snapshotActive = false;
    }
  }

  private ensureLayer() {
    if (!this.api || this.layerAdded) return;

    this.api.addTimelineLayer({
      id: this.layerId,
      label: "Route Prefetch",
      color: 0x3b82f6,
    });
    this.layerAdded = true;
  }

  private ensureInspector() {
    if (!this.api || this.inspectorAdded) return;

    this.api.addInspector({
      id: this.inspectorId,
      label: "Route Prefetch",
      icon: "route",
    });

    this.api.on.getInspectorTree((payload) => {
      if (payload.inspectorId !== this.inspectorId) return;

      const filter = payload.filter.trim().toLowerCase();
      const groupedEntries = this.getRouteGroups();

      payload.rootNodes = [
        {
          id: this.summaryNodeId,
          label: "Summary",
          tags: [
            {
              label: `${getPendingLoaders().length} pending`,
              textColor: 0xffffff,
              backgroundColor: 0x3b82f6,
            },
            {
              label: `${loaderRegistry.loadedSize} loaded`,
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
              label: this.bucketLabels[bucket],
              tags: [
                {
                  label: String(entries.length),
                  textColor: 0xffffff,
                  backgroundColor: this.bucketColors[bucket],
                },
              ],
              children: entries.map((entry) => ({
                id: `route:${entry.path}`,
                label: entry.path,
                tags: this.buildRouteTags(entry),
              })),
            };
          },
        ),
      ];
    });

    this.api.on.getInspectorState((payload) => {
      if (payload.inspectorId !== this.inspectorId) return;

      if (payload.nodeId === this.summaryNodeId) {
        payload.state = {
          summary: [
            { key: "registered routes", value: routeEntries.size },
            { key: "preload targets", value: loaderRegistry.size },
            { key: "loaded routes", value: loaderRegistry.loadedSize },
            { key: "pending routes", value: getPendingLoaders().length },
            { key: "is preloading", value: isPreloading },
          ],
          recent: this.recentEvents
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
        const entries = this.getRouteGroups()[bucket];

        payload.state = {
          summary: [
            { key: "bucket", value: this.bucketLabels[bucket] },
            { key: "routes", value: entries.length },
            {
              key: "loaded",
              value: entries.filter(
                (entry) =>
                  loaderRegistry.statusForPath(entry.path) === "loaded",
              ).length,
            },
            {
              key: "pending",
              value: entries.filter(
                (entry) =>
                  loaderRegistry.statusForPath(entry.path) === "pending",
              ).length,
            },
          ],
          routes: entries.map((entry) => ({
            key: entry.path,
            value: {
              priority: entry.priority,
              reason: entry.reason,
              status: loaderRegistry.statusForPath(entry.path),
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
            { key: "bucket", value: this.bucketLabels[entry.bucket] },
            { key: "priority", value: entry.priority },
            { key: "status", value: loaderRegistry.statusForPath(entry.path) },
            { key: "reason", value: entry.reason },
          ],
        };
      }
    });

    this.inspectorAdded = true;
  }

  private pushEvent(event: DevtoolsTimelineEvent) {
    this.recordRecentEvent(event);
    this.emitEvent(event);
  }

  private getRouteGroups() {
    if (this.routeGroupsSnapshot) return this.routeGroupsSnapshot;

    const groups = this.buildRouteGroups();
    if (this.snapshotActive) {
      this.routeGroupsSnapshot = groups;
    }
    return groups;
  }

  private buildRouteGroups() {
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

  private buildRouteTags(entry: RouteInspectorEntry) {
    const status = loaderRegistry.statusForPath(entry.path);
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
        backgroundColor: this.bucketColors[entry.bucket],
      });
    }

    return tags;
  }

  private recordRecentEvent(event: DevtoolsTimelineEvent) {
    this.recentEvents.push({
      ...event,
      time: Date.now(),
      path: typeof event.data.path === "string" ? event.data.path : undefined,
      priority:
        typeof event.data.priority === "number" || event.data.priority === null
          ? (event.data.priority as number | null)
          : undefined,
    });
    if (this.recentEvents.length > 50) {
      this.recentEvents.splice(0, this.recentEvents.length - 50);
    }
  }

  private emitEvent(event: DevtoolsTimelineEvent) {
    if (!this.api) {
      this.pendingEvents.push(event);
      if (this.pendingEvents.length > this.pendingEventsMax) {
        this.pendingEvents.splice(
          0,
          this.pendingEvents.length - this.pendingEventsMax,
        );
      }
      return;
    }

    this.ensureLayer();
    this.ensureInspector();
    this.api.addTimelineEvent({
      layerId: this.layerId,
      event: {
        time: this.api.now?.() ?? Date.now(),
        title: event.title,
        subtitle: event.subtitle,
        data: event.data,
        logType: event.logType,
      },
    });
    this.updateInspector();
  }

  private flushPendingEvents() {
    if (!this.api || this.pendingEvents.length === 0) return;

    // 仅重新派发到 devtools timeline；recentEvents 在事件首次触发时已记录，
    // 这里再走一次 record 会产生重复条目并刷新 time 字段。
    for (const event of this.pendingEvents.splice(0)) {
      this.emitEvent(event);
    }
  }
}

const devtools = new DevtoolsBridge();

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

function debouncePreload() {
  if (typeof window === "undefined") return;

  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    devtools.log("schedule preload on idle");
    scheduleIdle(preload);
  }, 200);
}

function requestPreload(reason: string, data: Record<string, unknown> = {}) {
  devtools.log(reason, data);
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
  return loaderRegistry.pending();
}

function preload(deadline?: IdleDeadline) {
  if (isPreloading) {
    devtools.log("skip preload tick because another loader is running");
    return;
  }

  const next = getPendingLoaders()[0];
  if (!next) {
    devtools.log("no pending routes to preload");
    return;
  }

  isPreloading = true;
  // wrapped loader 在内部维护 prefetchAttempts / prefetchRetryAt：
  // 同步递增 attempts，并在 then/catch 中重置或安排退避。
  const promise = next.loader();
  devtools.log("start preload", {
    path: next.path,
    priority: next.priority,
    attempt: next.prefetchAttempts,
    didTimeout: deadline?.didTimeout ?? false,
    remainingTime: deadline?.timeRemaining(),
  });

  promise
    .then(() => {
      devtools.log("preload success", {
        path: next.path,
        priority: next.priority,
      });
    })
    .catch((error) => {
      devtools.warn("preload failed", {
        path: next.path,
        priority: next.priority,
        attempts: next.prefetchAttempts,
        retryAt: next.prefetchRetryAt,
        givenUp: loaderRegistry.isExhausted(next),
        error,
      });
    })
    .finally(() => {
      isPreloading = false;
      if (getPendingLoaders().length > 0) {
        devtools.log("pending routes remain, scheduling next preload");
        debouncePreload();
      } else {
        devtools.log("all queued routes have been preloaded");
      }
    });
}

function scheduleRetryBackoff(entry: LoaderEntry) {
  // attempts 可能在 in-flight 期间被 visibility 监听重置过，钳到合法区间避免越界。
  const idx = Math.min(
    Math.max(entry.prefetchAttempts - 1, 0),
    PREFETCH_BACKOFF_MS.length - 1,
  );
  entry.prefetchRetryAt = Date.now() + PREFETCH_BACKOFF_MS[idx]!;
}

function makeWrappedLoader(entry: LoaderEntry): Loader {
  return () => {
    // 同一加载请求并发去重；若上一轮成功，inFlight 仍指向已 resolve 的 promise，复用即可。
    const inFlight = getInFlightLoaderPromise(entry);
    if (inFlight) return inFlight;

    entry.prefetchAttempts++;
    let p: Promise<unknown>;
    try {
      p = entry.original();
    } catch (error) {
      // 同步异常也得收敛状态，否则调用方拿不到 promise，isPreloading 会卡死。
      scheduleRetryBackoff(entry);
      return Promise.reject(error);
    }
    entry.inFlight = p;
    p.then(
      () => {
        loaderRegistry.markLoaded(entry);
        entry.prefetchAttempts = 0;
        entry.prefetchRetryAt = undefined;
      },
      () => {
        // 失败时丢弃 promise 缓存，让下次调用（用户点击或下次 prefetch tick）重新发起 import()。
        clearInFlightLoader(entry, p);
        loaderRegistry.markFailed(entry);
        scheduleRetryBackoff(entry);
      },
    );
    return p;
  };
}

function getInFlightLoaderPromise(entry: LoaderEntry) {
  return entry.inFlight;
}

function clearInFlightLoader(entry: LoaderEntry, promise: Promise<unknown>) {
  if (entry.inFlight === promise) entry.inFlight = undefined;
}

function updateRegisteredLoaderEntry(
  entry: LoaderEntry,
  priority: number,
  path: string,
) {
  const nextPriority = Math.max(entry.priority, priority);
  if (nextPriority !== entry.priority || entry.path !== path) {
    devtools.log("update preload target", {
      path,
      previousPath: entry.path,
      previousPriority: entry.priority,
      priority: nextPriority,
    });
  }
  entry.priority = nextPriority;
  entry.path = path;
  debouncePreload();
}

function registerLoader<T = unknown>(
  loader: Loader<T>,
  priority: number | null,
  path: string,
): Loader<T> {
  if (priority === null) return loader;

  const existing = loaderRegistry.find(loader as Loader);
  if (existing) {
    updateRegisteredLoaderEntry(existing, priority, path);
    return existing.loader as Loader<T>;
  }

  const entry: LoaderEntry = {
    loader: undefined as unknown as Loader,
    original: loader as Loader,
    path,
    priority,
    prefetchAttempts: 0,
  };
  entry.loader = makeWrappedLoader(entry);
  loaderRegistry.add(entry);
  devtools.log("register preload target", { path, priority });

  debouncePreload();
  return entry.loader as Loader<T>;
}

function wrapLoader(
  component: RouteComp,
  priority: number | null,
  path: string,
): RouteComp {
  if (isRouteComponentLoader(component)) {
    return registerLoader(component as AsyncComponent, priority, path);
  }

  return component;
}

function isRouteComponentLoader(
  component: RouteComp,
): component is AsyncComponent {
  return typeof component === "function";
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
  if (meta?.isClosed) return { priority: null, reason: "meta.isClosed" };
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
      devtools.log("skip preload target", { path: fullPath, reason });
    } else {
      devtools.log("resolved preload priority", {
        path: fullPath,
        priority,
        reason,
      });
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

function installRoutePrefetch(
  app: App,
  router: Router,
  installRouter: () => void,
) {
  const shouldInstallPrefetch = !installedRouters.has(router);

  if (shouldInstallPrefetch) {
    installedRouters.add(router);
    devtools.attach(app);
    setupVisibilityListener();
    devtools.log("apply route prefetch plugin");
    if (loaderRegistry.size === 0) {
      devtools.warn("no preload targets were registered");
    } else {
      requestPreload("prefetch targets registered", {
        targets: loaderRegistry.size,
      });
    }
  }

  installRouter();

  if (!shouldInstallPrefetch) return;

  router.isReady().then(() => {
    requestPreload("router ready, request idle preload");
  });

  router.afterEach((to) => {
    if (getPendingLoaders().length === 0) return;

    requestPreload("route changed, request idle preload", {
      path: to.fullPath,
    });
  });
}

function setupVisibilityListener() {
  if (typeof document === "undefined") return;
  if (visibilityListenerAttached) return;
  visibilityListenerAttached = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;

    // 标签页长时间隐藏后可能错过 prefetch 时机或卡在退避中；
    // 重新可见时重置所有未加载条目的失败计数，让队列可以再走一遍。
    // 跳过 in-flight 条目：它们自己会在 then/catch 里收敛状态，
    // 在飞行中重置 attempts 会让随后的 catch 算出 idx=-1。
    const resetCount = loaderRegistry.resetStaleFailures();

    if (resetCount > 0 || getPendingLoaders().length > 0) {
      requestPreload("tab became visible", { resetCount });
    }
  });
}

export function preparePrefetchableRoutes<T extends readonly RouteRecordRaw[]>(
  routes: T,
): T {
  processRoutes(routes as unknown as RouteRecordRaw[]);
  return routes;
}

export function setupRoutePrefetchRouter(router: Router): Router {
  if (configuredRouters.has(router)) return router;
  configuredRouters.add(router);

  const originalInstall = router.install.bind(router);
  router.install = (app: App) => {
    installRoutePrefetch(app, router, () => originalInstall(app));
  };

  return router;
}
