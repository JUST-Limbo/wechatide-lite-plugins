export interface WechatideLiteOptions {
    /** 默认启用。 */
    enabled?: boolean
    /** 默认只在 watch 构建时开窗，生产打包不触发。 */
    watchOnly?: boolean
    /** 可选：指定 wechatide 入口的绝对路径，否则自动发现。 */
    command?: string
    /** 可选：指定项目产物目录，默认使用构建器的输出目录。 */
    project?: string
    /** 默认 uni-app；首次使用新名称需要开发者工具授权。 */
    clientName?: string
    /** 默认项目 node_modules/.cache/wechatide-lite。 */
    cacheDir?: string
    logger?: { info(message: string): void; warn(message: string): void }
}
