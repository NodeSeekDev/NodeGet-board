// 从 URL hash 解析注入的参数
// 格式: #?token=xxx&node=yyy
const parseHashParams = () => {
  const hash = window.location.hash;
  const query = hash.startsWith("#?") ? hash.slice(2) : hash.slice(1);
  const params = new URLSearchParams(query);
  return {
    token: params.get("token") || "",
    node: params.get("node") || "",
  };
};

const { token, node } = parseHashParams();

const mask = (str) => {
  if (!str) return "—";
  if (str.length <= 8) return str;
  return str.slice(0, 4) + "****" + str.slice(-4);
};

document.getElementById("token-val").textContent = mask(token);
document.getElementById("node-val").textContent = node || "—（全局路由）";
