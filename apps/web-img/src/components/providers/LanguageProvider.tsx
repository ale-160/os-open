'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { LanguageContext, zhStrings, enStrings, type Language, type Translations } from '@/hooks/useLanguage';

/**
 * 统一语言管理：与 Ale OS 壳及内嵌应用共享同一个 localStorage 键，
 * 通过 storage 事件跨帧实时同步（同源 iframe 彼此收到变更）。
 * 中文为主：无任何记录时默认 zh。
 */
export const OS_LANGUAGE_KEY = 'ale-os-language';
/** 旧独立站时期的个人语言键，仅用于一次性迁移 */
const LEGACY_LANGUAGE_KEY = 'web-img-language';

function readSharedLanguage(): Language | null {
  const shared = localStorage.getItem(OS_LANGUAGE_KEY);
  if (shared === 'zh' || shared === 'en') return shared;
  return null;
}

export function LanguageProvider({ children, defaultLang }: { children: ReactNode; defaultLang?: Language }) {
  const [language, setLanguage] = useState<Language>(defaultLang ?? 'zh');
  const [isMounted, setIsMounted] = useState(false);

  // 挂载时一次性初始化：共享键 → 旧键迁移 → 默认中文，并发布到共享键
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setIsMounted(true);
    let initial = readSharedLanguage();
    if (!initial) {
      const legacy = localStorage.getItem(LEGACY_LANGUAGE_KEY);
      if (legacy === 'zh' || legacy === 'en') initial = legacy;
    }
    if (!initial) initial = 'zh';
    localStorage.setItem(OS_LANGUAGE_KEY, initial);
    if (initial !== language) {
      setLanguage(initial);
    }
  }, []);

  // 跟随系统其他帧（壳或别的应用）的语言切换
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== OS_LANGUAGE_KEY) return;
      if (event.newValue === 'zh' || event.newValue === 'en') {
        setLanguage(event.newValue as Language);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => {
      const next: Language = prev === 'zh' ? 'en' : 'zh';
      if (typeof window !== 'undefined') {
        localStorage.setItem(OS_LANGUAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const t = useCallback((key: keyof Translations): string => {
    const strings: Record<string, string> = language === 'zh' ? zhStrings : enStrings;
    return strings[key] ?? String(key);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, t, toggleLanguage, isMounted }}>
      {children}
    </LanguageContext.Provider>
  );
}
