# wechatide-lite-plugins

在 uni-app 首次成功编译微信小程序后，自动使用官方 `open_project_window` 接口打开微信开发者工具 Lite 模式。

一个包提供 webpack、Vite 两个插件，共用自动发现、路径缓存和授权处理。默认只在持续编译（watch）时启动，每次开发进程只调用一次开窗，不影响之后的编译。普通生产打包不弹窗。

这是社区插件，不是微信官方插件。它使用已安装开发者工具提供的接口，没有包含或修改开发者工具安装文件。Lite 仍然是桌面窗口，需要本机安装开发者工具，不是浏览器模拟器。

## 安装

尚未发布 npm，可从 GitHub 安装：

```bash
npm install -D github:JUST-Limbo/wechatide-lite-plugins
```

插件自身要求 Node.js 16+；实际使用还需满足项目中 uni-app、webpack 或 Vite 的 Node.js 版本要求。

## uni-app Vue 2 / webpack

在 `vue.config.js` 中注册，保留已有配置：

```js
const WechatideLitePlugin = require("wechatide-lite-plugins/webpack")

module.exports = {
    configureWebpack: {
        plugins: [new WechatideLitePlugin()],
    },
}
```

如果项目已经使用 `chainWebpack`，也可以在已有函数中追加：

```js
config.plugin("wechatide-lite").use(WechatideLitePlugin)
```

## uni-app Vue 3 / Vite

在 `vite.config.js` 或 `vite.config.ts` 中注册，放在 uni-app 插件后面：

```js
import { defineConfig } from "vite"
import uni from "@dcloudio/vite-plugin-uni"
import wechatideLite from "wechatide-lite-plugins/vite"

export default defineConfig({
    plugins: [uni(), wechatideLite()],
})
```

两种配置完成后，重新运行项目原有的开发命令：

```bash
npm run dev:mp-weixin
```

无需将开窗命令拼在 `&&` 后面。webpack 在成功构建的 `done` 阶段触发；Vite 在产物落盘后的 `writeBundle` 阶段触发，避免把 `closeBundle` 当作持续构建的每轮完成事件。

自动打开需要产物目录中存在 `project.config.json`。首次构建失败不会开窗；修复后第一次成功才开窗。构建明确指定其他 `UNI_PLATFORM` 时也不启动。

## 自动发现和缓存

通常不必配置安装路径：

- Windows：先查 PATH，再查当前用户和系统注册表中的腾讯安装记录、卸载记录，支持非 C 盘安装。
- macOS：先查 PATH，再查系统和用户 Applications，最后使用 Spotlight 查找其他位置的 `wechatwebdevtools.app`。Spotlight 未索引的位置需要显式指定入口。

自动发现成功后，缓存保存在**使用方项目**的 `node_modules/.cache/wechatide-lite/win32.json` 或 `darwin.json`。下次启动验证缓存路径，失效或缓存损坏才重新发现；缓存不可写不影响本次开窗。删除缓存目录可以重新选择自动发现的版本。

同时安装多个版本时，可以通过 `command` 指定入口绝对路径。也支持进程环境变量 `WECHATIDE_CMD_PATH`；插件选项优先，显式路径失效时不会改用其他版本。Vite 不会自动把 `.env` 中所有变量写入 `process.env`；如从 `.env` 读取此项，请在配置中使用 Vite 的 `loadEnv` 并传入 `command`。

## 选项

两个适配器接受相同选项：

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `enabled` | `true` | 是否启用 |
| `watchOnly` | `true` | 只在持续构建时开窗；设为 `false` 才允许普通打包时开窗 |
| `command` | 自动发现 | 官方 `wechatide` / `wechatide.cmd` 入口绝对路径 |
| `project` | 构建输出目录 | 指定小程序产物目录，相对路径以使用方项目根目录解析 |
| `clientName` | `uni-app` | 官方接口的调用方名称；新名称首次连接需要授权 |
| `cacheDir` | `node_modules/.cache/wechatide-lite` | 相对于使用方项目根目录的缓存目录，也可传绝对路径 |
| `logger` | 控制台 | 提供 `info(message)` 和 `warn(message)` |

首次连接时，请在开发者工具内允许客户端授权。插件每 10 秒检查一次，最多检查 10 次；授权成功后继续开窗，被拒绝、取消或过期则停止。关闭构建监听会取消尚未完成的调用和授权等待。

已有同项目窗口时，官方接口会复用，**不能自动改变已有窗口的模式**。如已有完整模式窗口，请手动关闭该项目窗口后重新运行开发命令。插件不关闭用户窗口、不上传代码。

## 测试

```bash
npm ci
npm run lint
npm test
npm run test:types
npm run test:uni
```

- 自动化集成测试实际运行 webpack 5、Vite 5.2.8、Vite 8.3.8 的构建和持续编译；用明确标记的本地假 CLI 验证调用次数、参数与触发时机，不代表真实微信模拟器的功能验收。
- `test:uni` 使用仓库内的最小 uni-app Vue 3 工程，实际编译为微信小程序，并验证首次开窗和后续热更新行为，仍使用假 CLI，测试不会登录或上传。
- 单元测试覆盖 Windows/macOS 路径发现、缓存失效、授权成功/拒绝/超时、取消等待和错误结果。
- Windows/macOS/Linux 的 GitHub Actions 使用同样的假 CLI 测试。macOS 真正的开发者工具开窗仍需要 Mac 实机验收，不将模拟测试当作实机验证。

详细本地验证记录见 [docs/testing.md](docs/testing.md)。

## 官方参考

- [微信开发者工具 Skills](https://developers.weixin.qq.com/miniprogram/dev/devtools/Skills.html)
- 本机安装包内 `wechatide-skill/SKILL.md` 和 `skills/initializer/SKILL.md`

本仓库不承诺 Lite 能解决所有卡顿；编译、模拟器和项目本身仍可能产生主要开销。
