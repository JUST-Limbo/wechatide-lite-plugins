import type { Compiler } from "webpack"
import type { WechatideLiteOptions } from "./options"

declare class WechatideLiteWebpackPlugin {
    constructor(options?: WechatideLiteOptions)
    apply(compiler: Compiler): void
}
export = WechatideLiteWebpackPlugin
