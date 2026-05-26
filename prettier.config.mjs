/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/style/app.css",
  tailwindFunctions: ["cn", "clsx", "cva"],
};
