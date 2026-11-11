const path = require("node:path")
const createLauncher = require("./launcher.cjs")

/**
 * 用法：plugins: [uni(), wechatideLite()]。
 * 在 writeBundle 的最后阶段触发，产物已落盘；closeBundle 不适合作为 watch 每轮完成事件。
 */
function wechatideLite(options = {}) {
    let config
    let launcher
    return {
        name: "wechatide-lite",
        apply: "build",
        enforce: "post",
        configResolved(resolved) {
            config = resolved
            launcher = createLauncher(options, config.root)
        },
        writeBundle: {
            order: "post",
            sequential: true,
            handler(output) {
                const outputDir = output.dir || path.resolve(config.root, config.build.outDir)
                launcher.trigger(outputDir, Boolean(config.build.watch))
            }
        },
        closeWatcher() {
            if (launcher) launcher.close()
        }
    }
}

module.exports = wechatideLite
