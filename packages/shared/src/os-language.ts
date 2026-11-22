'use client';

/**
 * Ale OS 系统共享语言（壳与内嵌应用统一读写）
 *
 * - 键 `ale-os-language`（localStorage）：所有帧读写同一个键；
 * - 跨帧同步：storage 事件（同源 iframe 彼此收到对方帧的变更）；
 * - 同帧同步：写入时派发自定义事件，同一页面里的多个订阅者即时更新。
 *
 * React 消费方用 useOsLanguage；非 React（zustand 等）用
 * readOsLanguage / writeOsLanguage / subscribeOsLanguage 自行接线。
 * 不能引入 React 的应用（如 Vue 的 nchat）改从 `@os/shared/os-language-core` 引用。
 */

import { useCallback, useEffect, useState } from 'react';

import { readOsLanguage, subscribeOsLanguage, writeOsLanguage } from './os-language-core';
import type { OsLanguage } from './os-language-core';

// 无框架内核（读/写/订阅）拆在 os-language-core，供非 React 应用单独引用；此处原样再导出保持兼容
export {
  OS_LANGUAGE_KEY,
  readOsLanguage,
  writeOsLanguage,
  subscribeOsLanguage
} from './os-language-core';
export type { OsLanguage } from './os-language-core';

export interface UseOsLanguageOptions {
  /** 旧独立站时期的个人语言键，仅用于一次性迁移（如 web-img-language） */
  legacyKey?: string;
  /** 无任何记录时的默认语言（默认 zh） */
  defaultLanguage?: OsLanguage;
}

/**
 * 共享语言 Hook：初始化（共享键 → 旧键迁移 → 默认值）并发布回共享键，
 * 订阅其他帧/本帧的变更，setLanguage 写回共享键。
 */
export function useOsLanguage(options: UseOsLanguageOptions = {}): {
  language: OsLanguage;
  setLanguage: (lang: OsLanguage) => void;
  toggleLanguage: () => OsLanguage;
  isMounted: boolean;
} {
  const { legacyKey, defaultLanguage = 'zh' } = options;
  const [language, setLanguageState] = useState<OsLanguage>(defaultLanguage);
  const [isMounted, setIsMounted] = useState(false);

  // 挂载时一次性初始化：共享键 → 旧键迁移 → 默认值，并发布到共享键
  useEffect(() => {
    setIsMounted(true);
    let initial = readOsLanguage();
    if (!initial && legacyKey) {
      try {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy === 'zh' || legacy === 'en') initial = legacy;
      } catch {
        // 读取失败则走默认值
      }
    }
    if (!initial) initial = defaultLanguage;
    writeOsLanguage(initial);
    setLanguageState(initial);
    // 仅挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 跟随系统其他帧（壳或别的应用）及本帧的语言切换
  useEffect(() => subscribeOsLanguage(lang => {
    if (lang) setLanguageState(lang);
  }), []);

  const setLanguage = useCallback((lang: OsLanguage) => {
    setLanguageState(lang);
    writeOsLanguage(lang);
  }, []);

  const toggleLanguage = useCallback((): OsLanguage => {
    const next: OsLanguage = language === 'zh' ? 'en' : 'zh';
    setLanguageState(next);
    writeOsLanguage(next);
    return next;
  }, [language]);

  return { language, setLanguage, toggleLanguage, isMounted };
}
