'use client';

/**
 * 底部动作 Dock（精简版）：喂食 / 玩耍 / 睡觉 + 「更多」，无边框胶囊 + 毛玻璃 + 柔和投影。
 * 更多面板收拢其余动作与入口；高频操作也可以在咕咕身上长按/右键呼出。
 */

import { useEffect, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { cooldownRemaining } from '@/lib/balance';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

interface ActionPanelProps {
  pet: PetState;
  onOpenShop: () => void;
  onOpenGame: () => void;
  onOpenChat: () => void;
  onOpenAchievements: () => void;
  onOpenSkin: () => void;
  onOpenSettings: () => void;
  onOpenTravel: () => void;
  onOpenDiary: () => void;
}

export function ActionPanel({
  pet,
  onOpenShop,
  onOpenGame,
  onOpenChat,
  onOpenAchievements,
  onOpenSkin,
  onOpenSettings,
  onOpenTravel,
  onOpenDiary,
}: ActionPanelProps) {
  const doAction = usePetStore((s) => s.doAction);
  const toggleSleep = usePetStore((s) => s.toggleSleep);
  const { locale } = useLocale();
  const t = ui(locale);

  const [now, setNow] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const disabledBySleep = pet.sleeping || pet.stage === 'egg';
  const feedCd = cooldownRemaining('feed', pet, now);
  const playCd = cooldownRemaining('play', pet, now);

  const dockButton = (
    key: string,
    opts: { icon: string; label: string; sub?: string; disabled?: boolean; active?: boolean; onClick: () => void }
  ) => (
    <button
      key={key}
      type="button"
      disabled={opts.disabled}
      onClick={opts.onClick}
      className={`press flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors ${
        opts.active ? 'bg-[#eef2ff]/90' : 'hover:bg-white/60 active:bg-white/85'
      } ${opts.disabled ? 'opacity-40' : ''}`}
    >
      <span className={`text-[26px] leading-none ${opts.active ? '' : 'drop-shadow-sm'}`}>{opts.icon}</span>
      <span className="text-[11px] font-bold tracking-wide">{opts.label}</span>
      <span className="h-3 text-[10px] font-semibold text-gugu-accent">{opts.sub}</span>
    </button>
  );

  return (
    <>
      {/* 悬浮 HUD：直接铺在场景底部，无容器白框 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
        <div className="pointer-events-auto mx-auto flex max-w-[380px] items-stretch justify-around rounded-[26px] bg-white/40 px-2 py-1.5 shadow-[0_10px_28px_rgba(138,106,77,0.14)] backdrop-blur-sm">
          {dockButton('feed', {
            icon: '🍪',
            label: t.actFeed,
            sub: feedCd > 0 && !disabledBySleep ? fmt(t.cooldownHint, { s: Math.ceil(feedCd / 1000) }) : '',
            disabled: disabledBySleep || feedCd > 0,
            onClick: () => doAction('feed'),
          })}
          {dockButton('play', {
            icon: '🎾',
            label: t.actPlay,
            sub: playCd > 0 && !disabledBySleep ? fmt(t.cooldownHint, { s: Math.ceil(playCd / 1000) }) : '',
            disabled: disabledBySleep || playCd > 0,
            onClick: () => doAction('play'),
          })}
          {dockButton('sleep', {
            icon: pet.sleeping ? '☀️' : '😴',
            label: pet.sleeping ? t.actWake : t.actSleep,
            disabled: pet.stage === 'egg',
            active: pet.sleeping,
            onClick: toggleSleep,
          })}
          {dockButton('more', {
            icon: '⋯',
            label: t.actMore,
            onClick: () => setSheetOpen(true),
          })}
        </div>
      </div>

      {/* 更多面板 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setSheetOpen(false)} role="presentation">
          <div
            className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t.moreTitle}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t.moreTitle}</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreItems(pet, now, t, locale, {
                shop: onOpenShop,
                game: onOpenGame,
                chat: onOpenChat,
                ach: onOpenAchievements,
                skin: onOpenSkin,
                settings: onOpenSettings,
                travel: onOpenTravel,
                diary: onOpenDiary,
              }).map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick();
                    setSheetOpen(false);
                  }}
                  className={`press flex flex-col items-center gap-1 rounded-2xl bg-amber-50/80 py-3 ${
                    item.disabled ? 'opacity-40' : 'hover:bg-amber-100/80 active:bg-amber-100'
                  }`}
                >
                  <span className="text-2xl leading-none">{item.icon}</span>
                  <span className="text-[11px] font-bold">{item.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-gugu-ink-soft/70">
              {locale === 'zh' ? '提示：长按或右键咕咕也能呼出这些动作' : 'Tip: long-press / right-click GuGu for these actions'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

type MoreItem = { icon: string; label: string; disabled?: boolean; onClick: () => void };

function moreItems(
  pet: PetState,
  now: number,
  t: ReturnType<typeof ui>,
  locale: 'zh' | 'en',
  open: { shop: () => void; game: () => void; chat: () => void; ach: () => void; skin: () => void; settings: () => void; travel: () => void; diary: () => void }
): MoreItem[] {
  const disabledBySleep = pet.sleeping || pet.stage === 'egg';
  return [
    {
      icon: '🛁',
      label: t.actWash,
      disabled: disabledBySleep || cooldownRemaining('wash', pet, now) > 0,
      onClick: () => usePetStore.getState().doAction('wash'),
    },
    {
      icon: '💼',
      label: t.actWork,
      disabled: disabledBySleep || cooldownRemaining('work', pet, now) > 0 || pet.energy < 30,
      onClick: () => usePetStore.getState().doWork(),
    },
    {
      icon: '📖',
      label: t.actStudy,
      disabled: disabledBySleep || cooldownRemaining('study', pet, now) > 0 || pet.energy < 20,
      onClick: () => usePetStore.getState().doStudy(),
    },
    { icon: '🛍️', label: t.actShop, disabled: disabledBySleep, onClick: open.shop },
    { icon: '🎒', label: t.actTravel, disabled: false, onClick: open.travel },
    { icon: '📖', label: t.actDiary, disabled: false, onClick: open.diary },
    { icon: '🎮', label: t.actGame, disabled: disabledBySleep, onClick: open.game },
    { icon: '💬', label: locale === 'zh' ? '聊天' : 'Chat', disabled: false, onClick: open.chat },
    { icon: '🏆', label: t.achTitle, disabled: false, onClick: open.ach },
    { icon: '🎨', label: t.skinTitle, disabled: false, onClick: open.skin },
    { icon: '⚙️', label: t.settingsTitle, disabled: false, onClick: open.settings },
  ];
}
