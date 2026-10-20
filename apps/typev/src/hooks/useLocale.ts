'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Locale = 'zh' | 'en';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/** Ale OS 系统共享语言键（壳与各应用统一读写，storage 事件实时同步） */
const OS_LANGUAGE_KEY = 'ale-os-language';

/**
 * 全局语言设置 Hook
 * zustand + persist 持久化，并与 Ale OS 系统语言双向同步：
 * - 初始化/收到 storage 事件时跟随 ale-os-language
 * - setLocale 时写回共享键，壳与其他应用实时跟随
 */
export const useLocale = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'zh', // 默认中文
      setLocale: (locale) => {
        set({ locale });
        try {
          localStorage.setItem(OS_LANGUAGE_KEY, locale);
        } catch {
          /* 隐私模式等场景写入失败可忽略 */
        }
      },
    }),
    {
      name: 'typev-locale-storage', // localStorage key
    }
  )
);

// 跟随系统语言：初始化 + 跨应用实时同步（仅浏览器端执行一次）
if (typeof window !== 'undefined') {
  const applyShared = (value: string | null) => {
    if (value === 'zh' || value === 'en') {
      const current = useLocale.getState().locale;
      if (current !== value) useLocale.setState({ locale: value });
    }
  };
  applyShared(localStorage.getItem(OS_LANGUAGE_KEY));
  window.addEventListener('storage', (e) => {
    if (e.key === OS_LANGUAGE_KEY) applyShared(e.newValue);
  });
}
