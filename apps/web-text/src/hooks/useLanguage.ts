'use client';

import {useCallback, useEffect, useState} from 'react';
import {getStrings, Language} from '@/data/i18n';

/**
 * 统一语言管理：与 Ale OS 壳及内嵌应用共享同一个 localStorage 键，
 * 通过 storage 事件跨帧实时同步（同源 iframe 彼此收到变更）。
 * 中文为主：无任何记录时默认 zh。
 */
export const OS_LANGUAGE_KEY = 'ale-os-language';
/** 旧独立站时期的个人语言键，仅用于一次性迁移 */
const LEGACY_LANGUAGE_KEY = 'web-text-language';

function readSharedLanguage(): Language | null {
  const shared = localStorage.getItem(OS_LANGUAGE_KEY);
  if (shared === 'zh' || shared === 'en') return shared;
  return null;
}

export function useLanguage(defaultLang?: Language) {
  const [language, setLanguage] = useState<Language>(defaultLang ?? 'zh');
  const [isMounted, setIsMounted] = useState(false);

  // 挂载时一次性初始化：共享键 → 旧键迁移 → 默认中文，并发布到共享键
  /* eslint-disable react-hooks/exhaustive-deps */
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
  /* eslint-enable react-hooks/exhaustive-deps */

  // 跟随系统其他帧（壳或别的应用）的语言切换
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== OS_LANGUAGE_KEY) return;
      if (event.newValue === 'zh' || event.newValue === 'en') {
        setLanguage(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleLanguage = useCallback(() => {
    const newLang: Language = language === 'zh' ? 'en' : 'zh';

    setLanguage(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OS_LANGUAGE_KEY, newLang);
    }

    return newLang;
  }, [language]);

  const t = getStrings(language);

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
    isMounted
  };
}
