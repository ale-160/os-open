/**
 * nchat 极简 i18n：跟随 Ale OS 系统语言（不引入 vue-i18n）
 *
 * - 语言来源：@os/shared/os-language-core（localStorage 键 ale-os-language +
 *   storage / 同帧自定义事件）。只读跟随，nchat 自身不写系统语言；
 * - 只引 os-language-core（无 React 依赖），不能改引 `@os/shared` 根入口或
 *   `@os/shared/os-language`，否则 React 会被打进产物；
 * - `language` 是 Vue ref，`t()` 在渲染期读取它，模板里直接用 t('key') 即可随语言切换重渲染；
 * - 缺键时回退中文，中文也缺则返回键名本身（便于发现漏翻）。
 */

import { readonly, ref } from 'vue'
import { readOsLanguage, subscribeOsLanguage } from '@os/shared/os-language-core'

import { messages } from './messages.js'

/** 系统未设置语言时的默认值（nchat 中文为主） */
export const DEFAULT_LANGUAGE = 'zh'

const language = ref(readOsLanguage() ?? DEFAULT_LANGUAGE)

/** 当前界面语言（只读 ref：'zh' | 'en'） */
export const currentLanguage = readonly(language)

function applyLanguage(lang) {
  language.value = lang === 'zh' || lang === 'en' ? lang : DEFAULT_LANGUAGE
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = language.value === 'zh' ? 'zh-CN' : 'en'
  }
}

let stopSync = null

/**
 * 开始跟随系统语言（幂等）：立即读一次系统语言，并订阅后续变更。
 * 返回停止函数（测试或卸载时使用）。
 */
export function startOsLanguageSync() {
  if (stopSync) return stopSync
  applyLanguage(readOsLanguage())
  const unsubscribe = subscribeOsLanguage(applyLanguage)
  stopSync = () => {
    unsubscribe()
    stopSync = null
  }
  return stopSync
}

/** 纯函数翻译：按指定语言取文案并替换 {param} 占位（便于单测） */
export function translate(lang, key, params) {
  const dict = messages[lang] || messages[DEFAULT_LANGUAGE]
  let text = dict[key] ?? messages[DEFAULT_LANGUAGE][key] ?? key
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    )
  }
  return text
}

/** 按当前系统语言翻译（模板中渲染期调用，自动响应语言切换） */
export function t(key, params) {
  return translate(language.value, key, params)
}
