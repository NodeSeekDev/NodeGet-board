import unpluginVueRouter from "unplugin-vue-router/vite";

/** 自动路由插件实例 */
export const unpluginVueRouterInstance = unpluginVueRouter({
  routesFolder: [
    {
      src: "./src/pages",
      exclude: ["**/__*.vue"],
    },
  ],
  dts: "./src/types/typed-router.d.ts",
});
