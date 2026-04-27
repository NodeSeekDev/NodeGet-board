declare module "vue-router" {
  interface RouteMeta {
    title: string;
    icon?: import("vue").Component | string;
    hidden?: boolean;
    order?: number;
    group?: string;
    isClosed?: boolean;
    prefetch?:
      | boolean
      | number
      | import("../router/prefetchPlugin").RoutePrefetchPriority
      | "high"
      | "normal"
      | "low"
      | "off";
  }
}

export {};
