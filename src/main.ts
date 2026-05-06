import { createApp } from "vue";
import { createPinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";
import { createI18n } from "vue-i18n";
import App from "./App.vue";
import router from "./router";
import "./style/app.css";
import en from "./locales/en";
import zh_cn from "./locales/zh_cn";

const app = createApp(App);
const pinia = createPinia();
const savedLocale = localStorage.getItem("locale");
const browserLanguage = (navigator.language || "en").split("-")[0] || "en";
const defaultLocale: string =
  savedLocale ||
  ((["en", "zh_cn"].includes(browserLanguage)
    ? browserLanguage
    : "en") as string);

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: defaultLocale,
  fallbackLocale: "en",
  messages: {
    en,
    zh_cn,
  },
});

pinia.use(createPersistedState());

app.use(pinia);
app.use(router);
app.use(i18n);

app.mount("#app");
