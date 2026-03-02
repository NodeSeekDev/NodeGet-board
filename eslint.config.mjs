import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.ts"],
    rules: {
      semi: "error",
      "prefer-const": "error",
    },
  },
]);
