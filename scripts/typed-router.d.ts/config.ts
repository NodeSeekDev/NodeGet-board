import { defineConfig } from "vite";
import { unpluginVueRouterInstance } from "./shared";

export default defineConfig({
  plugins: [unpluginVueRouterInstance],

  build: {
    write: false,
    rollupOptions: {
      input: "scripts/typed-router.d.ts/input.ts",
    },
  },
});
