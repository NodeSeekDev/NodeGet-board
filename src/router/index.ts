import { createRouter, createWebHashHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import {
  preparePrefetchableRoutes,
  setupRoutePrefetchRouter,
} from "./prefetchPlugin";

const router = createRouter({
  history: createWebHashHistory(),
  routes: preparePrefetchableRoutes(routes),
});

export default setupRoutePrefetchRouter(router);
