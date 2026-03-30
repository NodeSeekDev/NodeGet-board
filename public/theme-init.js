(function () {
  var THEME_COOKIE_KEY = "theme";
  var THEME_COOKIE_MAX_AGE = 31536000;
  var DARK_THEME_COLOR = "#09090b";
  var LIGHT_THEME_COLOR = "#ffffff";
  var STYLE_ELEMENT_ID = "nodeget-theme-bootstrap-style";

  function ensureBootstrapStyle() {
    if (document.getElementById(STYLE_ELEMENT_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    style.textContent =
      `html{background-color:${LIGHT_THEME_COLOR};color-scheme:light}` +
      `html.dark{background-color:${DARK_THEME_COLOR};color-scheme:dark}` +
      "body,#app{min-height:100vh;background-color:transparent}";
    document.head.appendChild(style);
  }

  function isDarkTheme() {
    var themeCookie = document.cookie
      .split("; ")
      .find(function (row) {
        return row.startsWith(THEME_COOKIE_KEY + "=");
      })
      ?.split("=")[1];

    return themeCookie === "dark";
  }

  function syncThemeDom(dark) {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }

  function initTheme() {
    var dark = isDarkTheme();
    syncThemeDom(dark);
    return dark;
  }

  function applyTheme(dark) {
    syncThemeDom(dark);
    document.cookie =
      THEME_COOKIE_KEY +
      "=" +
      (dark ? "dark" : "light") +
      "; path=/; max-age=" +
      THEME_COOKIE_MAX_AGE;
  }

  window.__NODEGET_THEME__ = {
    isDarkTheme: isDarkTheme,
    syncThemeDom: syncThemeDom,
    initTheme: initTheme,
    applyTheme: applyTheme,
  };

  ensureBootstrapStyle();
  initTheme();
})();
