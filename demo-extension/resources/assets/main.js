const parseHashParams = () => {
  const hash = window.location.hash;
  const query = hash.startsWith("#?") ? hash.slice(2) : hash.slice(1);
  const params = new URLSearchParams(query);
  return {
    token: params.get("token") || "",
    node: params.get("node") || "",
    theme: params.get("theme") || "dark",
  };
};

const { token, node, theme } = parseHashParams();

document.documentElement.setAttribute("data-theme", theme);

const mask = (str) => {
  if (!str) return "—";
  if (str.length <= 8) return str;
  return str.slice(0, 4) + "****" + str.slice(-4);
};

document.getElementById("token-val").textContent = mask(token);
document.getElementById("node-val").textContent = node || "—（全局路由）";
document.getElementById("theme-val").textContent = theme;

window.addEventListener("message", (e) => {
  if (e.data?.type === "theme-change") {
    document.documentElement.setAttribute("data-theme", e.data.theme);
    document.getElementById("theme-val").textContent = e.data.theme;
  }
});
