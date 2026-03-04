import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.ts"],
    ignores: ["**/*.d.ts"],
    rules: {
      semi: "error",
      "prefer-const": "error",
    },
  },
]);
