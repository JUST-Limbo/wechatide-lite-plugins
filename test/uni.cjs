const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawn, execFile } = require("node:child_process")
const { createFixture, waitFor } = require("./helpers.cjs")

test("uni-app Vue 3 actually emits mp-weixin and opens once across source changes", { timeout: 90000 }, async t => {
    const fake = createFixture(t)
    const artifacts = path.resolve(__dirname, "../artifacts")
    fs.mkdirSync(artifacts, { recursive: true })
    const runDir = fs.mkdtempSync(path.join(artifacts, "uni-vue3-"))
    const project = path.join(runDir, "project")
    fs.cpSync(path.join(__dirname, "fixtures/uni-vue3"), project, { recursive: true })
    // 按安装后的包入口导入，验证 Vite 配置加载器的 external 和 ESM/CJS 兼容性。
    const packageRoot = path.resolve(__dirname, "..")
    const installed = path.join(project, "node_modules/wechatide-lite-plugins")
    fs.mkdirSync(installed, { recursive: true })
    for (const file of ["src", "types", "package.json"]) {
        fs.cpSync(path.join(packageRoot, file), path.join(installed, file), { recursive: true })
    }
    const output = path.join(project, "dist/dev/mp-weixin")
    const cli = path.join(path.dirname(require.resolve("@dcloudio/vite-plugin-uni/package.json")), "bin/uni.js")
    const child = spawn(process.execPath, [cli, "-p", "mp-weixin"], {
        cwd: project,
        windowsHide: true,
        env: Object.assign({}, process.env, {
            UNI_CLI_CONTEXT: project,
            UNI_INPUT_DIR: path.join(project, "src"),
            UNI_OUTPUT_DIR: output,
            TEST_WECHATIDE_COMMAND: fake.command,
            NODE_ENV: "development"
        }),
        stdio: ["ignore", "pipe", "pipe"]
    })
    let log = ""
    const collect = data => { log = (log + data.toString()).slice(-64000) }
    child.stdout.on("data", collect)
    child.stderr.on("data", collect)
    child.on("error", collect)
    t.after(async () => {
        fs.writeFileSync(path.join(runDir, "build.log"), log)
        if (child.exitCode === null && child.signalCode === null) {
            const exited = new Promise(resolve => child.once("exit", resolve))
            if (process.platform === "win32") {
                await new Promise(resolve => execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, resolve))
            } else {
                child.kill("SIGTERM")
            }
            await exited
        }
    })
    try {
        await waitFor(() => {
            if (child.exitCode !== null) throw new Error(`uni-app exited: ${log}`)
            return fake.calls().length === 1
        }, 60000)
        assert.equal(fs.existsSync(path.join(output, "app.json")), true)
        assert.equal(fs.existsSync(path.join(output, "project.config.json")), true)
        assert.equal(fake.calls()[0][4], output)
        const page = path.join(project, "src/pages/index/index.vue")
        fs.writeFileSync(page, fs.readFileSync(page, "utf8").replace("Lite 插件自动化测试工程", "Lite-watch-rebuild-verified"))
        await waitFor(() => {
            const wxml = path.join(output, "pages/index/index.wxml")
            return fs.existsSync(wxml) && fs.readFileSync(wxml, "utf8").includes("Lite-watch-rebuild-verified")
        }, 20000)
        assert.equal(fake.calls().length, 1)
    } catch (error) {
        throw new Error(`${error.message}\n${log}`)
    }
})
