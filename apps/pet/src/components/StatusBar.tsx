'use client';

/**
 * 五维状态条：点击/长按任一状态弹出说明气泡（名称+含义+当前值）。
 * 视觉上不依赖常显文字标签，保持顶部轻量。
 */

import { useEffect, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { STAGE_THRESHOLDS } from '@/lib/balance';
import { fmt, ui, type UIStrings } from '@/lib/locale';
import { nextStageGap } from '@/lib/sim';
import type { PetState } from '@/lib/types';

const BAR_COLOR = (v: number) => (v < 30 ? 'bg-[#f0716b]' : v < 55 ? 'bg-[#f6c445]' : 'bg-[#7bc86c]');

const STAT_META: { key: 'satiety' | 'cleanliness' | 'mood' | 'energy' | 'health'; icon: string; label: keyof UIStrings; desc: keyof UIStrings }[] = [
  { key: 'satiety', icon: '🍞', label: 'statSatiety', desc: 'statSatietyDesc' },
  { key: 'cleanliness', icon: '🫧', label: 'statClean', desc: 'statCleanDesc' },
  { key: 'mood', icon: '💗', label: 'statMood', desc: 'statMoodDesc' },
  { key: 'energy', icon: '⚡', label: 'statEnergy', desc: 'statEnergyDesc' },
  { key: 'health', icon: '❤️', label: 'statHealth', desc: 'statHealthDesc' },
];

const POPOVER_MS = 3200;

export function StatusBar({ pet }: { pet: PetState }) {
  const { locale } = useLocale();
  const t = ui(locale);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (active === null) return;
    const timer = setTimeout(() => setActive(null), POPOVER_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const gap = nextStageGap(pet.stage, pet.growth);
  const currentFloor =
    pet.stage === 'adult' ? STAGE_THRESHOLDS.adult : pet.stage === 'teen' ? STAGE_THRESHOLDS.teen : 0;
  const progress =
    gap === null
      ? 100
      : Math.min(100, Math.round(((pet.growth - currentFloor) / Math.max(1, pet.growth - currentFloor + gap)) * 100));

  const stageLabel = t[`stage${pet.stage.charAt(0).toUpperCase()}${pet.stage.slice(1)}` as 'stageEgg'];

  return (
    <div className="px-4 pb-1 pt-2">
      <div className="grid grid-cols-5 gap-2">
        {STAT_META.map((meta, i) => {
          const value = pet[meta.key];
          const isActive = active === i;
          return (
            <button
              key={meta.key}
              type="button"
              onClick={() => setActive(isActive ? null : i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setActive(i);
              }}
              aria-label={t[meta.label]}
              title={t[meta.label]}
              className="relative flex flex-col items-center gap-1 rounded-xl outline-none"
            >
              <span className={`text-base leading-none transition-transform ${isActive ? 'scale-125' : ''}`}>{meta.icon}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-900/10">
                <div className={`anim-bar h-full rounded-full ${BAR_COLOR(value)}`} style={{ width: `${Math.round(value)}%` }} />
              </div>
              {isActive && (
                <span className="anim-pop absolute top-full left-1/2 z-20 mt-1.5 w-32 -translate-x-1/2 rounded-2xl border border-amber-100 bg-white/97 px-3 py-2 text-left shadow-xl backdrop-blur">
                  <span className="block text-[11px] font-extrabold">
                    {meta.icon} {t[meta.label]} · {Math.round(value)}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-gugu-ink-soft">{t[meta.desc]}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-gugu-ink-soft">
        <span className="rounded-full bg-amber-900/5 px-2 py-0.5 font-semibold text-gugu-ink">{stageLabel}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-900/10">
          <div className="h-full rounded-full bg-gugu-accent" style={{ width: `${progress}%` }} />
        </div>
        <span className="whitespace-nowrap">
          {pet.stage === 'egg'
            ? t.growthEgg
            : gap === null
              ? t.growthMax
              : fmt(t.growthNext, { n: Math.ceil(gap) })}
        </span>
      </div>
    </div>
  );
}
