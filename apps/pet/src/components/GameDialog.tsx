'use client';

/** 小游戏选择面板：接点心 / 打虫虫 / 对对碰 / 冲鸭赛跑 / 投喂高手 / 跟我唱 */

import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import type { GameKind, PetState } from '@/lib/types';

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
    { kind: 'race', icon: '🏃', name: t.gameRace, hint: locale === 'zh' ? '连点冲刺赢蜗牛' : 'Mash to outrun the snail' },
    { kind: 'toss', icon: '🎯', name: t.gameToss, hint: locale === 'zh' ? '时机投喂进嘴里' : 'Time your toss' },
    { kind: 'sing', icon: '🎵', name: t.gameSing, hint: locale === 'zh' ? '跟着咕咕唱' : 'Repeat the melody' },
  ];

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

        <div className="grid grid-cols-2 gap-2">
          {games.map((g) => (
            <button
              key={g.kind}
              type="button"
              onClick={() => onPick(g.kind)}
              className="press flex flex-col items-center gap-1 rounded-2xl bg-amber-50/70 py-3.5 hover:bg-amber-100/70 active:bg-amber-100"
            >
              <span className="text-3xl leading-none">{g.icon}</span>
              <span className="text-sm font-bold">{g.name}</span>
              <span className="px-2 text-center text-[10px] leading-tight text-gugu-ink-soft">{g.hint}</span>
              <span className="text-[10px] font-bold text-gugu-accent">
                {t.gameScore}: {pet.bests[g.kind]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
