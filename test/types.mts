import WebpackPlugin from "wechatide-lite-plugins/webpack"
import wechatideLite from "wechatide-lite-plugins/vite"
import type { Plugin } from "vite"
import type { WebpackPluginInstance } from "webpack"

const webpack: WebpackPluginInstance = new WebpackPlugin({ enabled: true })
const vite: Plugin = wechatideLite({ watchOnly: true })
void webpack
void vite
