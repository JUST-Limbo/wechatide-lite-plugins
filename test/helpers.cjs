const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

/** 用法：const fixture = createFixture(t)；所有数据在系统临时目录，测试结束自动删除。 */
function createFixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wechat lite 测试 ' & "))
    t.after(() => fs.rmSync(root, { recursive: true, force: true }))
    const log = path.join(root, "calls.jsonl")
    const cliScript = path.join(root, "fake-cli.cjs")
    const command = path.join(root, process.platform === "win32" ? "wechatide.cmd" : "wechatide")
    fs.writeFileSync(cliScript, [
        "const fs = require('node:fs')",
        `fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n')`,
        "console.log(JSON.stringify({ok:true,result:{success:true,type:'newopen',winId:'fake'}}))"
    ].join("\n"))
    if (process.platform === "win32") {
        fs.writeFileSync(command, `@echo off\r\n"${process.execPath}" "%~dp0fake-cli.cjs" %*\r\n`)
    } else {
        fs.writeFileSync(command, "#!/usr/bin/env node\n" + fs.readFileSync(cliScript, "utf8"), { mode: 0o755 })
    }
    return {
        root, command, log,
        calls() { return fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) : [] }
    }
}

/** 用法：await waitFor(() => fixture.calls().length === 1)；超时即失败，不无限等待。 */
async function waitFor(condition, timeout = 15000) {
    const deadline = Date.now() + timeout
    while (!condition()) {
        if (Date.now() > deadline) throw new Error("等待测试条件超时")
        await new Promise(resolve => setTimeout(resolve, 40))
    }
}

module.exports = { createFixture, waitFor }
