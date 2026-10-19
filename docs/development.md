# 开发说明

## 文件组织

- `plugin/src/server.mjs`：MCP stdio 服务，注册文件入口、UI 资源及渲染工具。
- `plugin/src/render.mjs`：通过 stdin 调用本机 D2，处理大小限制、超时和错误。
- `plugin/src/viewer.mjs`、`viewer.html`：侧栏 UI、资源订阅、布局与缩放。
- `plugin/src/png.mjs`：将已渲染 SVG 按画布尺寸转为 PNG，限制内存用量。
- `plugin/.codex-plugin/plugin.json`：Codex 兼容格式的插件清单。
- `.agents/plugins/marketplace.json`：本地 marketplace 模板。
- `scripts/prepare-install.mjs`：生成包含构建产物和本机启动配置的安装包。
- `scripts/install.mjs`：注册 marketplace 并安装插件。
- `test/integration.test.mjs`：真实 D2 / MCP 协议回归测试。
- `test/browser-host.mjs`：浏览器交互测试用的模拟宿主。

`plugin/dist/` 是构建结果；`.local/marketplace/` 是机器专属安装包，两者不提交。安装目录保存绝对 Node、D2 和服务路径，以避免桌面 PATH 与终端不同、插件路径变量未展开造成启动失败。安装脚本不会把机器路径写回源码。

## 预览链路

宿主通过 `open_d2` 文件入口传入资源 URI，前端经资源 API 读取文本并订阅更新，再调用 `render_d2`。服务端运行 D2，将 SVG 返回前端。SVG 作为图片加载，不作为 HTML 插入。前端等待图片解码成功后显示更新状态；递增的请求序号防止较早的渲染结果覆盖新结果。

## 验证边界

2026-10-19 已验证：macOS 上实际 Codex 侧栏成功显示图表，ELK → Dagre → ELK 会更新 SVG 并恢复原结果。滚轮缩放、主题、错误恢复和模拟保存通知在浏览器宿主测试页面验证过。真实宿主的保存通知仍需要按版本验收，不能用模拟页面替代。

每次改变安装流程，至少执行 `npm run build`、`npm test`，安装后执行 `npm run test:installed`。便携安装测试会在带空格的临时目录生成安装包，再在最小 PATH 下启动 MCP、读取 UI 并渲染两种布局。普通测试不依赖已安装的 Codex 配置。

发布前的桌面检查：选择 D2 Preview 打开示例，切换布局，使用滚轮缩放，保存当前源文件，制造并修复语法错误，检查浅色和深色主题。更改服务启动路径后需重启宿主加载新配置。

PNG 导出通过浏览器 Canvas 编码。复制使用 Clipboard API；保存使用 `save_png` MCP 工具，通过 macOS 系统文件选择窗口取得用户指定路径后写入。真实 Codex 返回 `ui/download-file: Method not found`，因此不再使用该接口。`test/save.test.mjs` 使用注入的路径选择器验证文件字节、取消和错误输入；该测试不能证明系统窗口已展示。
