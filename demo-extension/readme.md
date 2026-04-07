# Demo Extension

这是一个用于测试 NodeGet 扩展机制的示例扩展。

## 功能

- 通过 URL hash 参数获取 `token` 和 `node`
- 调用 NodeGet API 展示当前节点的 CPU / 内存状态
- 演示扩展与宿主 Dashboard 的通信方式

## 路由

| 名称 | 类型 | 说明 |
|------|------|------|
| demo-global | global | 全局路由，可在 /dashboard/app/demo-global 访问 |
| demo-node   | node   | 节点路由，可在 /node/{uuid}/demo-node 访问 |

## 开发说明

修改 `resources/index.html` 和 `resources/assets/main.js` 来自定义扩展内容。
