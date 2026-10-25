'use client';

/** 咕咕日记：按天倒序展示（事件 token → 咕咕口吻句子），上限 30 天 */

import { useLocale } from '@/hooks/useLocale';
import { useEscClose } from '@/hooks/useEscClose';
import { diaryDayLines } from '@/lib/diary';
import { ui } from '@/lib/locale';
import { BASE_PATH } from '@/lib/skins';
import { assetThumbUrl, fallbackAsset } from '@/lib/assetUrl';
import type { PetState } from '@/lib/types';

const DAY_NAMES_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_ILLUS = [
  'month-jan', 'month-feb', 'month-mar', 'month-apr', 'month-may', 'month-jun',
  'month-jul', 'month-aug', 'month-sep', 'month-oct', 'month-nov', 'month-dec',
] as const;

function dayTitle(dateStr: string, locale: 'zh' | 'en'): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (locale === 'zh') {
    return `${d.getMonth() + 1}月${d.getDate()}日 · 周${DAY_NAMES_ZH[d.getDay()]}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

export function DiaryDialog({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const days = Object.keys(pet.diary)
    .filter((k) => pet.diary[k].length > 0)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const monthIllus = MONTH_ILLUS[new Date().getMonth()];
  const monthIllusLocal = `${BASE_PATH}/skins/gugu/illus/${monthIllus}.png`;

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
        aria-label={t.diaryTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">📖 {t.diaryTitle}</h2>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
            ✕
          </button>
        </div>

        {/* 当月的日记插画 */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-amber-50/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetThumbUrl(monthIllusLocal)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(e) => fallbackAsset(e, monthIllusLocal)}
            className="h-28 w-full object-cover"
            draggable={false}
          />
        </div>

        {days.length === 0 ? (
          <p className="mt-8 text-center text-xs text-gugu-ink-soft">{t.diaryEmpty}</p>
        ) : (
          <div className="space-y-3">
            {days.map((day) => {
              const lines = diaryDayLines(pet.diary, day, locale);
              const isToday = day === new Date().toDateString();
              return (
                <div key={day} className={`rounded-2xl border p-3.5 ${isToday ? 'border-gugu-accent/50 bg-amber-50/70' : 'border-amber-100'}`}>
                  <p className="mb-1.5 flex items-center gap-2 text-xs font-extrabold text-gugu-ink">
                    {isToday && <span className="rounded-full bg-gugu-accent px-1.5 py-0.5 text-[9px] text-white">{locale === 'zh' ? '今天' : 'Today'}</span>}
                    {dayTitle(day, locale)}
                  </p>
                  <ul className="space-y-1">
                    {lines.map((line, i) => (
                      <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-gugu-ink">
                        <span className="text-gugu-accent">·</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
