type ThemeApi = {
  isDarkTheme: () => boolean;
  syncThemeDom: (dark: boolean) => void;
  initTheme: () => boolean;
  applyTheme: (dark: boolean) => void;
};

declare global {
  interface Window {
    __NODEGET_THEME__?: ThemeApi;
  }
}

const getThemeApi = () => {
  const api = window.__NODEGET_THEME__;

  if (!api) {
    throw new Error("Theme bootstrap script is not loaded.");
  }

  return api;
};

export const isDarkTheme = () => getThemeApi().isDarkTheme();

export const syncThemeDom = (dark: boolean) => getThemeApi().syncThemeDom(dark);

export const initTheme = () => getThemeApi().initTheme();

export const applyTheme = (dark: boolean) => getThemeApi().applyTheme(dark);
