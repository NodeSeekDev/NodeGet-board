declare module "vue-router" {
  interface RouteMeta {
    title: string;
    icon?: import("vue").Component;
    hidden?: boolean;
    order?: number;
    group?: string;
  }
}

export {};
