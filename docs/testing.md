# 验证记录

验证日期：2026-11-11。包版本：0.1.0。以下区分本地实测、模拟测试与待验证范围。

## 本地环境

- Windows，Node.js 22.22.0。
- webpack 5、Vite 5.2.8、Vite 8.3.8。
- uni-app Vue 3：`@dcloudio/* 3.0.0-5020620260917001`，Vue 3.4.21，Vite 5.2.8。
- 微信开发者工具 2.02.2609250。

## 自动化验证

插件运行时最低版本另用 Node.js 16.0.0 验证：CLI 子进程参数传递、取消授权等待、webpack 构建完成钩子及 Vite ESM 入口均通过。此项使用假 CLI，不等同于所有构建工具都支持 Node.js 16；使用方仍需满足其实际安装的 uni-app、webpack、Vite 及依赖的 Node.js 要求。仓库开发工具和完整测试使用上面的本地环境。

`npm test` 共 19 项，覆盖入口发现、缓存、授权状态、取消以及真实 webpack / Vite 持续构建。构建器测试先制造语法错误，修复后验证首次成功调用一次开窗，后续热更新不重复，普通生产构建不调用。

`npm run test:uni` 共 1 项，使用仓库内最小 uni-app 工程，真正生成微信小程序产物，检查 `app.json`、`project.config.json` 和页面 WXML；修改页面后确认 WXML 更新、开窗调用次数仍为一次。

上述自动化构建使用明确标记的本地假 CLI，验证插件调用时机与参数，不会登录、上传或启动真实模拟器。macOS 的路径发现和调用逻辑包含模拟测试；Windows 测试还真正运行子进程验证中文、空格、单引号和 `&` 路径的参数传递。

`npm run lint`、`npm run test:types` 均通过。类型检查覆盖 ESM 和 CommonJS。使用 `npm pack` 生成压缩包，并安装到独立消费工程，验证 webpack CommonJS、Vite CommonJS 和 Vite ESM 三个入口。发布白名单排除测试产物和本地缓存。

## 真实工具验证

Windows 上通过本包打开独立 uni-app 测试产物，官方接口返回成功，Lite 项目窗口已打开。未对全部模拟器功能、页面交互或性能改善幅度进行验收。

macOS 真实开发者工具开窗尚未实机验证。Linux 仅作为自动化构建测试环境，不支持自动发现本地微信开发者工具。

GitHub Actions 配置 Windows、macOS、Linux 三个平台，运行 lint、类型检查、构建器测试及 uni-app 编译测试；实际运行状态以仓库 Actions 页面为准。
