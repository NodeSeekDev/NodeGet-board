import { createApp } from "vue";
import { createPinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";
import { createI18n } from "vue-i18n";
import en from "./locales/en";
import App from "./App.vue";
import router from "./router";
import "./style/app.css";

const app = createApp(App);
const pinia = createPinia();
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "en",
  fallbackLocale: "en",
  messages: {
    en,
  },
});
pinia.use(createPersistedState());

app.use(pinia);
app.use(router);
app.use(i18n);

app.mount("#app");
