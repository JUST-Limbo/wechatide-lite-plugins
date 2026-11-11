const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const webpack = require("webpack")
const WebpackPlugin = require("../src/webpack.cjs")
const vitePlugin = require("../src/vite.cjs")
const { createFixture, waitFor } = require("./helpers.cjs")
const quiet = { info() {}, warn() {} }

/** 用法：new ProjectConfigPlugin()；仅为测试生成最小小程序项目标记，不包含业务数据。 */
class ProjectConfigPlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap("TestProjectConfig", compilation => {
            compilation.hooks.processAssets.tap({ name: "TestProjectConfig", stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
                compilation.emitAsset("project.config.json", new webpack.sources.RawSource("{}"))
            })
        })
    }
}

test("webpack 5 watch: failure does not open; recovery opens once; rebuild does not reopen", { timeout: 45000 }, async t => {
    const f = createFixture(t)
    const entry = path.join(f.root, "entry.js")
    fs.writeFileSync(entry, "export const = invalid")
    const output = path.join(f.root, "dist", "微信产物")
    const compiler = webpack({
        context: f.root, mode: "development", entry,
        output: { path: output, filename: "app.js" },
        plugins: [new ProjectConfigPlugin(), new WebpackPlugin({ command: f.command, logger: quiet })]
    })
    const results = []
    const watcher = compiler.watch({ aggregateTimeout: 30 }, (error, stats) => results.push({ error, stats }))
    t.after(() => new Promise(resolve => watcher.close(() => compiler.close(resolve))))
    await waitFor(() => results.length >= 1)
    assert.equal(results[0].stats.hasErrors(), true)
    assert.equal(f.calls().length, 0)
    fs.writeFileSync(entry, "export const value = 1")
    await waitFor(() => results.some(item => item.stats && !item.stats.hasErrors()))
    await waitFor(() => f.calls().length === 1)
    assert.equal(f.calls()[0][4], output)
    const before = results.length
    fs.writeFileSync(entry, "export const value = 2")
    await waitFor(() => results.length > before)
    assert.equal(f.calls().length, 1)
})

test("webpack normal build never opens by default", { timeout: 20000 }, async t => {
    const f = createFixture(t)
    fs.writeFileSync(path.join(f.root, "entry.js"), "console.log('test')")
    const compiler = webpack({
        context: f.root, mode: "development", entry: "./entry.js",
        output: { path: path.join(f.root, "dist") },
        plugins: [new ProjectConfigPlugin(), new WebpackPlugin({ command: f.command, logger: quiet })]
    })
    t.after(() => new Promise(resolve => compiler.close(resolve)))
    const stats = await new Promise((resolve, reject) => compiler.run((error, result) => error ? reject(error) : resolve(result)))
    assert.equal(stats.hasErrors(), false)
    assert.equal(f.calls().length, 0)
})

for (const version of ["vite", "vite-modern"]) {
    test(`${version} watch: failure, recovery, emitted config and one launch across rebuilds`, { timeout: 45000 }, async t => {
        const { build } = await import(version)
        const f = createFixture(t)
        const entry = path.join(f.root, "entry.js")
        fs.writeFileSync(entry, "export const = invalid")
        const output = path.join(f.root, "dist", "微信产物")
        const watcher = await build({
            configFile: false, root: f.root, logLevel: "silent",
            plugins: [
                { name: "test-project-config", generateBundle() { this.emitFile({ type: "asset", fileName: "project.config.json", source: "{}" }) } },
                vitePlugin({ command: f.command, logger: quiet })
            ],
            build: { watch: { buildDelay: 30 }, outDir: output, minify: false, lib: { entry, formats: ["es"], fileName: "app" } }
        })
        t.after(() => watcher.close())
        const events = []
        watcher.on("event", event => {
            events.push(event)
            if (event.result) event.result.close()
        })
        await waitFor(() => events.some(event => event.code === "ERROR"))
        assert.equal(f.calls().length, 0)
        fs.writeFileSync(entry, "export const value = 1")
        await waitFor(() => events.some(event => event.code === "BUNDLE_END"))
        await waitFor(() => f.calls().length === 1)
        assert.equal(fs.existsSync(path.join(output, "project.config.json")), true)
        assert.equal(f.calls()[0][4], output)
        const before = events.filter(event => event.code === "BUNDLE_END").length
        fs.writeFileSync(entry, "export const value = 2")
        await waitFor(() => events.filter(event => event.code === "BUNDLE_END").length > before)
        assert.equal(f.calls().length, 1)
    })

    test(`${version} normal production build never opens by default`, { timeout: 20000 }, async t => {
        const { build } = await import(version)
        const f = createFixture(t)
        const entry = path.join(f.root, "entry.js")
        fs.writeFileSync(entry, "export const value = 1")
        await build({
            configFile: false, root: f.root, logLevel: "silent",
            plugins: [
                { name: "test-project-config", generateBundle() { this.emitFile({ type: "asset", fileName: "project.config.json", source: "{}" }) } },
                vitePlugin({ command: f.command, logger: quiet })
            ],
            build: { outDir: path.join(f.root, "dist"), lib: { entry, formats: ["es"] } }
        })
        assert.equal(f.calls().length, 0)
    })
}
