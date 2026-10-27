'use client';

import { useCallback, type ReactNode } from 'react';
import { useOsLanguage, OS_LANGUAGE_KEY } from '@os/shared/os-language';
import { LanguageContext, zhStrings, enStrings, type Language, type Translations } from '@/hooks/useLanguage';

/** 系统共享语言键（与壳及其他应用实时同步，实现见 @os/shared） */
export { OS_LANGUAGE_KEY };

/** 旧独立站时期的个人语言键，仅用于一次性迁移 */
const LEGACY_LANGUAGE_KEY = 'web-img-language';

export function LanguageProvider({ children, defaultLang }: { children: ReactNode; defaultLang?: Language }) {
  const { language, toggleLanguage, isMounted } = useOsLanguage({
    legacyKey: LEGACY_LANGUAGE_KEY,
    defaultLanguage: defaultLang ?? 'zh'
  });

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