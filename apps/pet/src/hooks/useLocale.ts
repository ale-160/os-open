'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  readOsLanguage,
  subscribeOsLanguage,
  writeOsLanguage
} from '@os/shared/os-language';

type Locale = 'zh' | 'en';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * 全局语言设置 Hook
 * zustand + persist 持久化，并与 Ale OS 系统语言双向同步（实现见 @os/shared）：
 * - 初始化/收到系统语言变更时跟随 ale-os-language
 * - setLocale 时写回共享键，壳与其他应用实时跟随
 */
export const useLocale = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'zh', // 默认中文
      setLocale: (locale) => {
        set({ locale });
        writeOsLanguage(locale);
      },
    }),
    {
      name: 'pet-locale-storage', // localStorage key
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
  applyShared(readOsLanguage());
  subscribeOsLanguage(applyShared);
}