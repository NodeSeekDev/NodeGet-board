import type { Router, RouteRecordRaw, RouteComponent } from "vue-router";
type Loader<T = any> = () => Promise<T>;

const loaders = new Set<Loader>();
const loaded = new Set<Loader>();

let debounceTimer: number | null = null;

function debouncePreload() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    scheduleIdle(preload);
  }, 200);
}

function scheduleIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(fn);
  } else {
    setTimeout(fn, 500);
  }
}

function preload() {
  for (const loader of loaders) {
    if (loaded.has(loader)) continue;

    loader()
      .then(() => {
        loaded.add(loader);
      })
      .catch(() => {});
  }
}

export function prefetchImport<T = any>(loader: Loader<T>): Loader<T> {
  if (!loaders.has(loader)) {
    loaders.add(loader);
    debouncePreload();
  }

  return loader;
}

type AsyncComponent = () => Promise<RouteComponent>;
type RouteComp = RouteComponent | AsyncComponent;

function wrapLoader(component: RouteComp): RouteComp {
  if (typeof component === "function") {
    return prefetchImport(component as AsyncComponent);
  }
  return component;
}

function processRoutes(routes: RouteRecordRaw[]) {
  for (const route of routes) {
    if (route.component) {
      route.component = wrapLoader(route.component as RouteComp);
    }

    if (route.components) {
      for (const key in route.components) {
        const comp = route.components[key];

        // comp 一定存在（Record<string, RawRouteComponent>）
        route.components[key] = wrapLoader(comp as RouteComp) as any;
      }
    }

    if (route.children) {
      processRoutes(route.children);
    }
  }
}

export function applyPrefetchRoute(router: Router) {
  const routes = router.options.routes as RouteRecordRaw[];
  processRoutes(routes);
}
