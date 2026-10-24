'use client';

/** 小游戏选择面板：接点心 / 打虫虫 / 点心对对碰 */

import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import type { PetState } from '@/lib/types';

export type GameKind = 'snack' | 'whack' | 'memory';

export function GameDialog({
  pet,
  onPick,
  onClose,
}: {
  pet: PetState;
  onPick: (kind: GameKind) => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const t = ui(locale);

  const games: { kind: GameKind; icon: string; name: string; hint: string }[] = [
    { kind: 'snack', icon: '🍪', name: t.gameTitle, hint: locale === 'zh' ? '移动咕咕接点心' : 'Move GuGu to catch' },
    { kind: 'whack', icon: '🪱', name: t.gameWhack, hint: locale === 'zh' ? '手速点虫虫' : 'Tap worms fast' },
    { kind: 'memory', icon: '🃏', name: t.gameMemory, hint: locale === 'zh' ? '翻牌配对' : 'Match the pairs' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t.gamePickTitle}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">🎮 {t.gamePickTitle}</h2>
            <p className="text-xs text-gugu-ink-soft">{t.gamePickSubtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {games.map((g) => (
            <button
              key={g.kind}
              type="button"
              onClick={() => onPick(g.kind)}
              className="press flex w-full items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-3.5 text-left hover:bg-amber-50 active:bg-amber-100"
            >
              <span className="text-3xl leading-none">{g.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{g.name}</span>
                <span className="block text-[11px] text-gugu-ink-soft">{g.hint}</span>
                <span className="block text-[10px] text-gugu-ink-soft/70">
                  {t.gameScore}: {pet.counters.minigameBest}
                </span>
              </span>
              <span className="text-gugu-ink-soft">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
