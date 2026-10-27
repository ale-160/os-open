'use client';

import { useOsLanguage, OS_LANGUAGE_KEY } from '@os/shared/os-language';
import { getStrings, Language } from '@/data/i18n';

/**
 * 统一语言管理：与 Ale OS 壳及内嵌应用共享同一个 localStorage 键，
 * 通过 storage 事件跨帧实时同步（同源 iframe 彼此收到变更）。
 * 中文为主：无任何记录时默认 zh。同步逻辑实现在 @os/shared。
 */
export { OS_LANGUAGE_KEY };
/** 旧独立站时期的个人语言键，仅用于一次性迁移 */
const LEGACY_LANGUAGE_KEY = 'web-text-language';

export function useLanguage(defaultLang?: Language) {
  const { language, setLanguage, toggleLanguage, isMounted } = useOsLanguage({
    legacyKey: LEGACY_LANGUAGE_KEY,
    defaultLanguage: defaultLang ?? 'zh'
  });

  const t = getStrings(language);

  return {
    language,
    setLanguage,
    toggleLanguage,
    t,
    isMounted
  };
}