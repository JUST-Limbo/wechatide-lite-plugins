const { execFile } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

class WechatideClient {
    constructor(options = {}) {
        this.options = options
        this.logger = options.logger || { info: console.log, warn: console.warn }
        this.cacheFile = path.resolve(options.root || process.cwd(), options.cacheDir || "node_modules/.cache/wechatide-lite", process.platform + ".json")
    }

    // 用法：await client.start(outputDir)；只负责开窗，不编译、不关闭用户现有窗口。
    async start(project) {
        if (this.options.signal && this.options.signal.aborted) return
        const command = await this.resolveCommand()
        if (!command) throw new Error("未发现可执行的 wechatide 入口，请确认已安装支持此接口的微信开发者工具")
        this.logger.info("[微信 Lite] 首次构建成功，正在打开项目。")
        await this.open(command, project)
    }

    // 用法：await this.delay(10000)；停止构建监听时取消授权等待，避免后台定时器残留。
    delay(ms) {
        const signal = this.options.signal
        return new Promise((resolve, reject) => {
            const cancel = () => {
                clearTimeout(timer)
                reject(new Error("已停止等待授权"))
            }
            const timer = setTimeout(() => {
                if (signal) signal.removeEventListener("abort", cancel)
                resolve()
            }, ms)
            if (signal) {
                if (signal.aborted) cancel()
                else signal.addEventListener("abort", cancel, { once: true })
            }
        })
    }

    // 用法：const command = await this.resolveCommand()；可选配置优先，配置失效时不改用其他版本。
    // 优先验证本机缓存，失效后自动查 PATH 和系统安装记录；macOS 还检查执行权限。
    async resolveCommand() {
        const configured = this.options.command || process.env.WECHATIDE_CMD_PATH
        if (configured) {
            return this.findExecutable([configured])
        }
        if (process.platform !== "win32" && process.platform !== "darwin") return undefined

        try {
            const cached = JSON.parse(fs.readFileSync(this.cacheFile, "utf8"))
            if (cached.version === 1 && typeof cached.command === "string") {
                const command = this.findExecutable([cached.command])
                if (command) {
                    return command
                }
            }
        } catch {
            // 首次使用、缓存损坏或不可读取时，重新发现入口。
        }

        const entry = process.platform === "win32" ? "wechatide.cmd" : "wechatide"
        const candidates = (process.env.PATH || process.env.Path || "").split(path.delimiter).map(directory => directory.replace(/^"|"$/g, "")).filter(directory => path.isAbsolute(directory)).map(directory => path.join(directory, entry))
        const fromPath = this.findExecutable(candidates)
        if (fromPath) {
            return this.cacheCommand(fromPath)
        }

        if (process.platform === "darwin") {
            const fromApplications = this.findExecutable([
                "/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide",
                path.join(os.homedir(), "Applications/wechatwebdevtools.app/Contents/MacOS/wechatide"),
            ])
            if (fromApplications) {
                return this.cacheCommand(fromApplications)
            }
        }
        return this.cacheCommand(this.findExecutable(await this.discoverInstalledCommands()))
    }

    // 用法：return this.cacheCommand(command)；只缓存已验证的自动发现结果。
    // 缓存按操作系统分开；写入失败不影响使用入口，也不缓存未找到的结果。
    cacheCommand(command) {
        if (command) {
            try {
                fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true })
                fs.writeFileSync(this.cacheFile, `${JSON.stringify({ version: 1, command }, null, 2)}\n`, "utf8")
            } catch {
                this.logger.warn("[微信 Lite] 无法保存本机路径缓存，本次仍正常使用，下次启动会重新查找。")
            }
        }
        return command
    }

    // 用法：this.findExecutable(candidates)；候选值必须是入口文件的绝对路径，不接受目录。
    findExecutable(candidates) {
        return candidates.find((candidate) => {
            if (!path.isAbsolute(candidate)) {
                return false
            }
            try {
                fs.accessSync(candidate, process.platform === "darwin" ? fs.constants.X_OK : fs.constants.F_OK)
                return fs.statSync(candidate).isFile()
            } catch {
                return false
            }
        })
    }

    // 用法：await this.discoverInstalledCommands()；Windows 读注册表，macOS 查 Spotlight。
    // 只查询安装记录，不扫描磁盘、不修改注册表；查询失败由上层提示，编译继续。
    async discoverInstalledCommands() {
        let executable
        let args
        if (process.platform === "win32") {
            const script = [
                "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false",
                "$ErrorActionPreference = 'Stop'",
                "$vendorKeys = @('HKCU:\\Software\\Tencent\\微信web开发者工具', 'HKLM:\\Software\\Tencent\\微信web开发者工具', 'HKLM:\\Software\\WOW6432Node\\Tencent\\微信web开发者工具')",
                "$uninstallKeys = @('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')",
                "$paths = @(",
                "  foreach ($key in $vendorKeys) {",
                "    $item = Get-Item -LiteralPath $key -ErrorAction SilentlyContinue",
                "    if ($item) {",
                "      $exe = $item.GetValue('')",
                "      if ($exe) { Join-Path ([IO.Path]::GetDirectoryName($exe.Trim('\"'))) 'wechatide.cmd' }",
                "    }",
                "  }",
                "  $apps = Get-ItemProperty -Path $uninstallKeys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match '微信.*开发者|wechat.*dev' }",
                "  foreach ($app in $apps) {",
                "    if ($app.InstallLocation) { Join-Path $app.InstallLocation 'wechatide.cmd' }",
                "    if ($app.DisplayIcon) {",
                "      $icon = ($app.DisplayIcon -replace ',\\s*-?\\d+$', '').Trim('\"')",
                "      Join-Path ([IO.Path]::GetDirectoryName($icon)) 'wechatide.cmd'",
                "    }",
                "  }",
                ")",
                "ConvertTo-Json -InputObject @($paths)",
            ].join("\n")
            executable = "powershell.exe"
            args = ["-NoProfile", "-NonInteractive", "-Command", script]
        } else {
            executable = "/usr/bin/mdfind"
            args = ["kMDItemFSName == 'wechatwebdevtools.app'"]
        }

        const stdout = await new Promise((resolve, reject) => {
            execFile(executable, args, { windowsHide: true, timeout: 10000, encoding: "utf8", signal: this.options.signal }, (error, output) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(output)
                }
            })
        })
        if (process.platform === "win32") {
            return JSON.parse(stdout)
        }
        return stdout.split(/\r?\n/).filter(Boolean).map(app => path.join(app, "Contents/MacOS/wechatide"))
    }

    async open(command, project) {
        const args = ["open_project_window", "--project", project, "--window-mode", "liteMode"]
        let result = await this.call(command, args)

        // 首次客户端授权仅完成授权本身，成功后才再次执行开窗；其他待确认任务不自动重发。
        if (result.status === "pending" && result.taskType === "auth") {
            const taskId = result.taskId
            this.logger.info(`[微信 Lite] 请在微信开发者工具中允许 ${this.options.clientName || "uni-app"} 连接，最多等待约 100 秒。`)
            for (let attempt = 0; attempt < 10 && result.status === "pending"; attempt++) {
                await this.delay(10000)
                result = await this.call(command, ["polling_task_result", "--task-id", taskId])
            }
            if (result.status !== "success") {
                throw new Error(`授权状态为 ${result.status}，请确认授权后重新运行开发命令`)
            }
            result = await this.call(command, args)
        }

        if (result.status === "pending") {
            this.logger.warn("[微信 Lite] 操作仍待确认，请前往微信开发者工具查看并完成确认。")
        } else if (result.success !== true) {
            throw new Error(result.message || "开发者工具未返回成功结果")
        } else if (result.type === "reuse") {
            this.logger.info("[微信 Lite] 已复用现有项目窗口；如果它是完整模式，请关闭该项目窗口后重启开发命令。")
        } else {
            this.logger.info("[微信 Lite] 项目窗口已打开。")
        }
    }

    // 用法：await this.call(command, ["polling_task_result", "--task-id", taskId])。
    // Windows 参数经 JSON 环境变量传递，macOS 直接传参数数组；均不拼接用户路径。
    // 单次调用超时不终止 webpack。
    call(command, args) {
        let executable = command
        let commandArgs = ["-c", this.options.clientName || "uni-app", ...args]
        const env = Object.assign({}, process.env)
        if (process.platform === "win32") {
            const script = [
                "$ErrorActionPreference = 'Stop'",
                "$toolArgs = @(ConvertFrom-Json $env:UNI_WECHATIDE_ARGS)",
                "& $env:UNI_WECHATIDE_COMMAND -c $env:UNI_WECHATIDE_CLIENT @toolArgs",
                "exit $LASTEXITCODE",
            ].join("\n")
            executable = "powershell.exe"
            commandArgs = ["-NoProfile", "-NonInteractive", "-Command", script]
            env.UNI_WECHATIDE_CLIENT = this.options.clientName || "uni-app"
            env.UNI_WECHATIDE_COMMAND = command
            env.UNI_WECHATIDE_ARGS = JSON.stringify(args)
        }

        return new Promise((resolve, reject) => {
            execFile(executable, commandArgs, {
                windowsHide: true,
                timeout: 60000,
                encoding: "utf8",
                signal: this.options.signal,
                env,
            }, (error, stdout) => {
                if (error) {
                    reject(error)
                    return
                }
                try {
                    const response = JSON.parse(stdout)
                    if (!response.ok || !response.result) {
                        throw new Error(response.message || (response.error && response.error.message) || "开发者工具返回失败")
                    }
                    resolve(response.result)
                } catch (parseError) {
                    reject(parseError)
                }
            })
        })
    }
}

module.exports = WechatideClient
