import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import unpluginVueRouter from "unplugin-vue-router/vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";
import { versionPlugin } from "./versionPlugin";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  build: {
    manifest: true,
  },
  plugins: [
    unpluginVueRouter({
      routesFolder: [
        {
          src: "./src/pages",
          exclude: ["**/__*.vue"],
        },
      ],
      dts: "./src/types/typed-router.d.ts",
    }),
    vue(),
    vueJsx(),
    vueDevTools(),
    tailwindcss(),
    versionPlugin,
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
