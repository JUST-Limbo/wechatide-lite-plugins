const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const Client = require("../src/client.cjs")
const { createFixture } = require("./helpers.cjs")
const quiet = { info() {}, warn() {} }

/** 用法：discoveryFixture("darwin")；虚拟文件系统只用于验证不同操作系统的路径发现。 */
function discoveryFixture(platform) {
    const files = new Map()
    const env = { PATH: "" }
    const systemPath = platform === "win32" ? path.win32 : path.posix
    const root = platform === "win32" ? "C:\\project" : "/project"
    let queries = 0
    let installed = platform === "win32" ? "D:\\Custom Tools\\wechatide.cmd" : "/External Tools/wechatwebdevtools.app/Contents/MacOS/wechatide"
    files.set(installed, "executable")
    const sandbox = {
        module: { exports: {} }, process: { platform, env, cwd: () => root }, console, setTimeout, clearTimeout,
        require(name) {
            if (name === "node:path") return systemPath
            if (name === "node:os") return { homedir: () => "/Users/test" }
            if (name === "node:fs") return {
                constants: fs.constants,
                accessSync(file) { if (!files.has(file)) throw new Error("missing") },
                statSync(file) { return { isFile: () => files.has(file) } },
                readFileSync(file) { if (!files.has(file)) throw new Error("missing"); return files.get(file) },
                mkdirSync() {}, writeFileSync(file, data) { files.set(file, data) }
            }
            if (name === "node:child_process") return {
                execFile(_file, _args, _options, callback) {
                    queries++
                    callback(null, platform === "win32" ? JSON.stringify([installed]) : systemPath.dirname(systemPath.dirname(systemPath.dirname(installed))), "")
                }
            }
            throw new Error(name)
        }
    }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/client.cjs"), "utf8"), sandbox)
    const client = new sandbox.module.exports({ root, logger: quiet })
    return { client, env, files, get queries() { return queries }, get installed() { return installed }, set installed(value) { installed = value; files.set(value, "executable") } }
}

for (const platform of ["win32", "darwin"]) {
    test(`${platform}: discovery, cache hit, moved installation, corrupt cache, override`, async () => {
        const f = discoveryFixture(platform)
        assert.equal(await f.client.resolveCommand(), f.installed)
        assert.equal(f.queries, 1)
        assert.equal(await f.client.resolveCommand(), f.installed)
        assert.equal(f.queries, 1)
        f.files.delete(f.installed)
        f.installed = platform === "win32" ? "E:\\Moved\\wechatide.cmd" : "/Moved/wechatwebdevtools.app/Contents/MacOS/wechatide"
        assert.equal(await f.client.resolveCommand(), f.installed)
        assert.equal(f.queries, 2)
        f.files.set(f.client.cacheFile, "bad json")
        assert.equal(await f.client.resolveCommand(), f.installed)
        assert.equal(f.queries, 3)
        f.env.WECHATIDE_CMD_PATH = platform === "win32" ? "D:\\missing.cmd" : "/missing"
        assert.equal(await f.client.resolveCommand(), undefined)
        assert.equal(f.queries, 3)
    })
    test(`${platform}: PATH takes priority over system discovery`, async () => {
        const f = discoveryFixture(platform)
        f.env.PATH = platform === "win32" ? '"D:\\Custom Tools"' : "/External Tools/wechatwebdevtools.app/Contents/MacOS"
        assert.equal(await f.client.resolveCommand(), f.installed)
        assert.equal(f.queries, 0)
    })
}

test("native subprocess keeps spaces, Chinese, apostrophes and shell characters as arguments", async t => {
    const fixture = createFixture(t)
    const client = new Client({ command: fixture.command, root: fixture.root, logger: quiet })
    await client.start(fixture.root)
    assert.deepEqual(fixture.calls(), [["-c", "uni-app", "open_project_window", "--project", fixture.root, "--window-mode", "liteMode"]])
})

test("authorization success resumes opening exactly once", async () => {
    const client = new Client({ logger: quiet })
    const calls = []
    client.delay = async () => {}
    client.call = async (_command, args) => {
        calls.push(args[0])
        if (calls.length === 1) return { status: "pending", taskType: "auth", taskId: "test" }
        if (calls.length === 2) return { status: "success", success: true }
        return { success: true, type: "newopen" }
    }
    await client.open("fake", "/project")
    assert.deepEqual(calls, ["open_project_window", "polling_task_result", "open_project_window"])
})

for (const status of ["cancelled", "failed", "expired", "pending"]) {
    test(`authorization ${status} never opens a new window`, async () => {
        const client = new Client({ logger: quiet })
        let calls = 0
        client.delay = async () => {}
        client.call = async () => {
            calls++
            return calls === 1 ? { status: "pending", taskType: "auth", taskId: "test" } : { status }
        }
        await assert.rejects(client.open("fake", "/project"), /授权状态/)
        assert.equal(calls, status === "pending" ? 11 : 2)
    })
}

test("other pending tasks are not polled or retried", async () => {
    const client = new Client({ logger: quiet })
    let calls = 0
    client.call = async () => { calls++; return { status: "pending", taskType: "confirmation" } }
    await client.open("fake", "/project")
    assert.equal(calls, 1)
})

test("closing cancels authorization timer", async () => {
    const controller = new AbortController()
    const client = new Client({ signal: controller.signal, logger: quiet })
    const pending = client.delay(100000)
    controller.abort()
    await assert.rejects(pending, /停止等待/)
})

test("CLI failure is reported without claiming an opened window", async () => {
    const client = new Client({ logger: quiet })
    client.call = async () => ({ success: false, message: "permission denied" })
    await assert.rejects(client.open("fake", "/project"), /permission denied/)
})
