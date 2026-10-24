'use client';

/** 五维状态条 + 成长进度 + 生病/睡眠提示 */

import { useLocale } from '@/hooks/useLocale';
import { STAGE_THRESHOLDS } from '@/lib/balance';
import { fmt, ui } from '@/lib/locale';
import { nextStageGap } from '@/lib/sim';
import type { PetState } from '@/lib/types';

const BAR_COLOR = (v: number) => (v < 30 ? 'bg-[#f0716b]' : v < 55 ? 'bg-[#f6c445]' : 'bg-[#7bc86c]');

export function StatusBar({ pet }: { pet: PetState }) {
  const { locale } = useLocale();
  const t = ui(locale);

  const stats = [
    { icon: '🍞', label: t.statSatiety, value: pet.satiety },
    { icon: '🫧', label: t.statClean, value: pet.cleanliness },
    { icon: '💗', label: t.statMood, value: pet.mood },
    { icon: '⚡', label: t.statEnergy, value: pet.energy },
    { icon: '❤️', label: t.statHealth, value: pet.health },
  ];

  const gap = nextStageGap(pet.stage, pet.growth);
  const currentFloor =
    pet.stage === 'adult' ? STAGE_THRESHOLDS.adult : pet.stage === 'teen' ? STAGE_THRESHOLDS.teen : 0;
  const progress =
    gap === null ? 100 : Math.min(100, Math.round(((pet.growth - currentFloor) / Math.max(1, pet.growth - currentFloor + gap)) * 100));

  const stageLabel = t[`stage${pet.stage.charAt(0).toUpperCase()}${pet.stage.slice(1)}` as 'stageEgg'];

  return (
    <div className="px-4 pb-1 pt-2">
      <div className="grid grid-cols-5 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <span className="text-base leading-none" title={s.label}>
              {s.icon}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-900/10">
              <div className={`anim-bar h-full rounded-full ${BAR_COLOR(s.value)}`} style={{ width: `${Math.round(s.value)}%` }} />
            </div>
          </div>
        ))}
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

      {pet.sick && (
        <div className="mt-2 rounded-xl bg-[#f0716b]/10 px-3 py-1.5 text-xs font-medium text-[#d9534d]">
          🤒 {t.sickBanner}
        </div>
      )}
      {pet.sleeping && !pet.sick && (
        <div className="mt-2 rounded-xl bg-[#8aa8ff]/10 px-3 py-1.5 text-xs font-medium text-[#5f7de0]">
          💤 {t.sleepHint}
        </div>
      )}
    </div>
  );
}
