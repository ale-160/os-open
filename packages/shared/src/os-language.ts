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
 */

import { useCallback, useEffect, useState } from 'react';

export type OsLanguage = 'zh' | 'en';

/** 全系统共享语言键（localStorage） */
export const OS_LANGUAGE_KEY = 'ale-os-language';

/** 同帧订阅事件（写入者派发，弥补 storage 事件不通知本帧） */
const OS_LANGUAGE_EVENT = 'os-language-change';

function parseLanguage(value: string | null | undefined): OsLanguage | null {
  return value === 'zh' || value === 'en' ? value : null;
}

/** 读取共享语言；无记录或值非法返回 null */
export function readOsLanguage(): OsLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseLanguage(localStorage.getItem(OS_LANGUAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * 写入共享语言。storage 事件只通知其他帧，
 * 本帧订阅者通过自定义事件即时收到。
 */
export function writeOsLanguage(lang: OsLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OS_LANGUAGE_KEY, lang);
  } catch {
    // 隐私模式等场景写入失败可忽略（本帧状态仍由调用方自行维护）
  }
  window.dispatchEvent(new CustomEvent<OsLanguage>(OS_LANGUAGE_EVENT, { detail: lang }));
}

/**
 * 订阅共享语言变更（storage 事件 + 同帧自定义事件）。
 * 回调参数可能为 null（键被移除时）。返回取消订阅函数。
 */
export function subscribeOsLanguage(
  callback: (lang: OsLanguage | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === OS_LANGUAGE_KEY) callback(parseLanguage(event.newValue));
  };
  const onCustom = (event: Event) => {
    callback((event as CustomEvent<OsLanguage>).detail);
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(OS_LANGUAGE_EVENT, onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(OS_LANGUAGE_EVENT, onCustom);
  };
}

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
