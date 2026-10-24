'use client';

/** 纪念墙：经典模式下健康归零后的生平告别页 */

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import type { PetState } from '@/lib/types';

export function Memorial({ pet, onAdopt }: { pet: PetState; onAdopt: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  const [now] = useState(() => Date.now());
  const days = Math.max(1, Math.ceil((now - pet.bornAt) / 86_400_000));
  const stageKey = `stage${pet.stage.charAt(0).toUpperCase()}${pet.stage.slice(1)}` as 'stageEgg';

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#2d2a45] to-[#4a3f63] px-8 text-center text-white">
      <span className="text-5xl">🕊️</span>
      <h1 className="text-2xl font-extrabold tracking-wide">{t.memorialTitle}</h1>
      <p className="text-xl font-bold">
        {pet.name} · {t[stageKey]}
      </p>
      <p className="text-sm opacity-80">
        {fmt(t.memorialDays, { n: days })} · 🏆 {t.achTitle} {pet.achievements.length}
      </p>
      <p className="max-w-xs text-sm leading-relaxed opacity-70">{t.memorialBye}</p>
      <button
        type="button"
        onClick={onAdopt}
        className="press mt-2 rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg"
      >
        {t.memorialAdopt}
      </button>
    </div>
  );
}
