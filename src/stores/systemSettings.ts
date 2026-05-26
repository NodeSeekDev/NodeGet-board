import { defineStore } from "pinia";
import { reactive, watch } from "vue";

export interface SystemSettingsConfig {
  rpcDebugPanelEnabled: boolean;
}

const SYSTEM_SETTINGS_STORAGE_KEY = "nodeget.system-settings";

function readEnvBoolean(value: unknown, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "true"
    ? true
    : normalized === "false"
      ? false
      : fallback;
}

function getDefaultConfig(): SystemSettingsConfig {
  return {
    rpcDebugPanelEnabled: readEnvBoolean(
      import.meta.env.VITE_RPC_DEBUG_PANEL_ENABLED,
      false,
    ),
  };
}

function readStoredConfig(defaultConfig: SystemSettingsConfig) {
  const config = { ...defaultConfig };
  if (typeof window === "undefined") return config;

  try {
    const stored = window.localStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SystemSettingsConfig>;
      if (typeof parsed.rpcDebugPanelEnabled === "boolean") {
        config.rpcDebugPanelEnabled = parsed.rpcDebugPanelEnabled;
      }
    }
  } catch {
    /* localStorage may be unavailable or contain invalid JSON */
  }

  return config;
}

function writeStoredConfig(config: SystemSettingsConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SYSTEM_SETTINGS_STORAGE_KEY,
      JSON.stringify(config),
    );
  } catch {
    /* localStorage may be unavailable */
  }
}

export const useSystemSettingsStore = defineStore("system-settings", () => {
  const config = reactive<SystemSettingsConfig>(
    readStoredConfig(getDefaultConfig()),
  );

  watch(
    config,
    (value) => {
      writeStoredConfig(value);
    },
    { deep: true, immediate: true },
  );

  return {
    config,
  };
});
