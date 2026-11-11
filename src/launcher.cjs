const fs = require("node:fs")
const path = require("node:path")
const WechatideClient = require("./client.cjs")

/**
 * 用法：const launcher = createLauncher(options, root); launcher.trigger(outputDir)。
 * 每个构建器实例只启动一次；缺少项目配置时等待下一次成功构建，不影响编译。
 */
function createLauncher(options, root) {
    const settings = Object.assign({ enabled: true, watchOnly: true }, options)
    const controller = new AbortController()
    const logger = settings.logger || { info: console.log, warn: console.warn }
    const client = new WechatideClient(Object.assign({}, settings, { root, logger, signal: controller.signal }))
    let attempted = false
    let closed = false
    return {
        trigger(outputDir, watching) {
            if (closed || attempted || !settings.enabled || (settings.watchOnly && !watching)) return
            if (process.env.UNI_PLATFORM && process.env.UNI_PLATFORM !== "mp-weixin") return
            const project = path.resolve(root, settings.project || outputDir)
            if (!fs.existsSync(path.join(project, "project.config.json"))) return
            attempted = true
            // 不等待用户授权，避免阻塞编译和热更新；失败由插件日志报告。
            client.start(project).catch(error => {
                if (!closed) logger.warn(`[微信 Lite] ${error.message}；编译监听继续运行。`)
            })
        },
        close() {
            closed = true
            controller.abort()
        }
    }
}

module.exports = createLauncher
