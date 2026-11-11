import type { Plugin } from "vite" with { "resolution-mode": "import" }
import type { WechatideLiteOptions } from "./options"

declare function wechatideLite(options?: WechatideLiteOptions): Plugin
export = wechatideLite
