const createLauncher = require("./launcher.cjs")

/**
 * 用法：plugins: [new WechatideLiteWebpackPlugin()]。
 * 默认仅在 watch 的首次成功构建后启动；watchClose 时取消等待，不关闭项目窗口。
 */
class WechatideLiteWebpackPlugin {
    constructor(options = {}) {
        this.options = options
    }

    apply(compiler) {
        const launcher = createLauncher(this.options, compiler.context)
        compiler.hooks.done.tap("WechatideLiteWebpackPlugin", stats => {
            if (!stats.hasErrors()) launcher.trigger(compiler.options.output.path, compiler.watchMode)
        })
        compiler.hooks.watchClose.tap("WechatideLiteWebpackPlugin", () => launcher.close())
        if (compiler.hooks.shutdown) {
            compiler.hooks.shutdown.tap("WechatideLiteWebpackPlugin", () => launcher.close())
        }
    }
}

module.exports = WechatideLiteWebpackPlugin
