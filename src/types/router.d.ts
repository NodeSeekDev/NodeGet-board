declare module "vue-router" {
  interface RouteMeta {
    title: string;
    icon?: import("vue").Component;
    hidden?: boolean;
    order?: number;
    group?: string;
    isClosed?: boolean;
    prefetch?: boolean | "high" | "normal" | "low" | "off";
    prefetchPriority?: number;
  }
}

export {};
