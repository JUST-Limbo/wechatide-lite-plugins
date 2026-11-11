import { defineConfig } from "vite"
import uni from "@dcloudio/vite-plugin-uni"
import wechatideLite from "wechatide-lite-plugins/vite"

const uniPlugin = typeof uni === "function" ? uni : uni.default

export default defineConfig({
    plugins: [uniPlugin(), wechatideLite({ command: process.env.TEST_WECHATIDE_COMMAND })]
})
