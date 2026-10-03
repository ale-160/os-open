'use client';

import { ReactNode } from 'react';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import type { Language } from '@/hooks/useLanguage';

export function ClientProviders({ children, lang }: { children: ReactNode; lang?: Language }) {
  return (
    <LanguageProvider defaultLang={lang}>
      {children}
    </LanguageProvider>
  );
}
