import wechatideLite = require("wechatide-lite-plugins/vite")
import WebpackPlugin = require("wechatide-lite-plugins/webpack")
const vite = wechatideLite({ enabled: true })
const webpack = new WebpackPlugin({ enabled: true })
void vite
void webpack
