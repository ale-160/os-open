import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// 先在无 document 的 node 环境里初始化 Vue（runtime-dom 导入时会探测 document），
// 之后再用最小替身模拟 document，避免 Vue 初始化读到替身
import 'vue'

import { en, messages, zh } from './messages.js'

const OS_LANGUAGE_KEY = 'ale-os-language'

/** 最小 localStorage 替身（node 环境） */
function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    clear: () => map.clear()
  }
}

/** 模拟其他帧（壳）写入语言后本帧收到的 storage 事件 */
function storageEvent(key, newValue) {
  return Object.assign(new Event('storage'), { key, newValue })
}

/**
 * 在给定系统语言下全新加载 i18n 模块（模块级 ref 在导入时读取一次系统语言）。
 * 返回模块与模拟的 window / document。
 */
async function loadI18n(storedLanguage) {
  const win = new EventTarget()
  const doc = { documentElement: { lang: '' } }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('localStorage', createStorage(storedLanguage ? { [OS_LANGUAGE_KEY]: storedLanguage } : {}))
  vi.resetModules()
  const mod = await import('./index.js')
  return { mod, win, doc }
}

describe('文案字典', () => {
  it('zh 与 en 键集完全一致', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('所有文案非空', () => {
    for (const dict of Object.values(messages)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, key).toBeTypeOf('string')
        expect(value.trim(), key).not.toBe('')
      }
    }
  })

  it('同一键在两种语言中的插值占位一致', () => {
    const params = (s) => (s.match(/\{\w+\}/g) || []).sort()
    for (const key of Object.keys(zh)) {
      expect(params(en[key]), key).toEqual(params(zh[key]))
    }
  })
})

describe('translate（纯函数）', () => {
  it('按语言取文案并替换占位', async () => {
    const { mod } = await loadI18n()
    expect(mod.translate('zh', 'nav.chat')).toBe('会话')
    expect(mod.translate('en', 'nav.chat')).toBe('Chats')
    expect(mod.translate('zh', 'header.typing', { name: '阿乐' })).toBe('阿乐 正在输入…')
    expect(mod.translate('en', 'rooms.loadMore', { count: 3 })).toBe('Load more (3 left)')
  })

  it('未提供的占位保持原样；未知语言回退中文；未知键返回键名', async () => {
    const { mod } = await loadI18n()
    expect(mod.translate('en', 'header.typing', {})).toBe('{name} is typing…')
    expect(mod.translate('fr', 'nav.search')).toBe('搜索')
    expect(mod.translate('en', 'no.such.key')).toBe('no.such.key')
  })
})

describe('跟随系统语言（@os/shared/os-language-core）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.resetModules()
  })

  it('系统未设置语言时默认中文', async () => {
    const { mod } = await loadI18n()
    expect(mod.currentLanguage.value).toBe('zh')
    expect(mod.t('nav.settings')).toBe('设置')
  })

  it('导入时读取系统语言（en）', async () => {
    const { mod } = await loadI18n('en')
    expect(mod.currentLanguage.value).toBe('en')
    expect(mod.t('nav.settings')).toBe('Settings')
  })

  it('跨帧 storage 事件与同帧写入都能即时切换，并同步 <html lang>', async () => {
    const { mod, win, doc } = await loadI18n('zh')
    const stop = mod.startOsLanguageSync()
    expect(doc.documentElement.lang).toBe('zh-CN')

    // 其他帧（壳）切到英文
    localStorage.setItem(OS_LANGUAGE_KEY, 'en')
    win.dispatchEvent(storageEvent(OS_LANGUAGE_KEY, 'en'))
    expect(mod.currentLanguage.value).toBe('en')
    expect(mod.t('app.join')).toBe('Join')
    expect(doc.documentElement.lang).toBe('en')

    // 无关键的 storage 事件不影响
    win.dispatchEvent(storageEvent('other-key', 'zh'))
    expect(mod.currentLanguage.value).toBe('en')

    // 同帧写入（共享内核派发自定义事件）
    const core = await import('@os/shared/os-language-core')
    core.writeOsLanguage('zh')
    expect(mod.currentLanguage.value).toBe('zh')
    expect(mod.t('app.join')).toBe('加入')

    // 键被移除 → 回退默认中文
    core.writeOsLanguage('en')
    win.dispatchEvent(storageEvent(OS_LANGUAGE_KEY, null))
    expect(mod.currentLanguage.value).toBe('zh')

    // 停止后不再跟随
    stop()
    core.writeOsLanguage('en')
    expect(mod.currentLanguage.value).toBe('zh')
  })

  it('startOsLanguageSync 幂等：重复调用不重复订阅', async () => {
    const { mod } = await loadI18n('zh')
    const stop1 = mod.startOsLanguageSync()
    const stop2 = mod.startOsLanguageSync()
    expect(stop2).toBe(stop1)
    stop1()
  })
})
