'use client';

import { useEscClose } from '@/hooks/useEscClose';

/** 成就图鉴：已解锁徽章高亮，未解锁灰显；由顶栏 🏆 进入 */

import { useLocale } from '@/hooks/useLocale';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { fmt, ui } from '@/lib/locale';
import type { PetState } from '@/lib/types';

export function AchievementsDialog({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);
  const unlocked = new Set(pet.achievements);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.achTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">🏆 {t.achTitle}</h2>
            <p className="text-xs text-gugu-ink-soft">
              {fmt(t.achProgress, { u: unlocked.size, n: ACHIEVEMENTS.length })}
            </p>
          </div>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.has(a.id);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-2.5 rounded-2xl border p-3 ${
                  isUnlocked ? 'border-gugu-accent/50 bg-amber-50' : 'border-amber-100 bg-white opacity-55'
                }`}
              >
                <span className={`text-2xl leading-none ${isUnlocked ? '' : 'grayscale'}`}>{a.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{locale === 'zh' ? a.zh : a.en}</span>
                  <span className="block truncate text-[10px] text-gugu-ink-soft">
                    {locale === 'zh' ? a.zhDesc : a.enDesc}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-center text-[11px] text-gugu-ink-soft/70">{t.achLocked} · {t.aboutBody}</p>
      </div>
    </div>
  );
}
