'use client';

/**
 * 底部动作栏（精简版）：喂食 / 玩耍 / 睡觉 + 「更多」面板。
 * 更多面板收拢其余动作与入口（洗澡/打工/学习/商店/游戏/聊天/成就/形象/设置），
 * 高频操作也可以在咕咕身上长按/右键呼出。
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
}

export function ActionPanel({
  pet,
  onOpenShop,
  onOpenGame,
  onOpenChat,
  onOpenAchievements,
  onOpenSkin,
  onOpenSettings,
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

  const moreItems: { icon: string; label: string; disabled?: boolean; onClick: () => void }[] = [
    {
      icon: '🛁',
      label: t.actWash,
      disabled: disabledBySleep || cooldownRemaining('wash', pet, now) > 0,
      onClick: () => doAction('wash'),
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
    { icon: '🛍️', label: t.actShop, disabled: disabledBySleep, onClick: onOpenShop },
    { icon: '🎮', label: t.actGame, disabled: disabledBySleep, onClick: onOpenGame },
    { icon: '💬', label: locale === 'zh' ? '聊天' : 'Chat', disabled: false, onClick: onOpenChat },
    { icon: '🏆', label: t.achTitle, disabled: false, onClick: onOpenAchievements },
    { icon: '🎨', label: t.skinTitle, disabled: false, onClick: onOpenSkin },
    { icon: '⚙️', label: t.settingsTitle, disabled: false, onClick: onOpenSettings },
  ];

  const barButton = (
    key: string,
    opts: { icon: string; label: string; sub?: string; disabled?: boolean; active?: boolean; onClick: () => void }
  ) => (
    <button
      key={key}
      type="button"
      disabled={opts.disabled}
      onClick={opts.onClick}
      className={`press flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 shadow-sm ${
        opts.active
          ? 'border-[#8aa8ff]/40 bg-[#eef2ff]/90'
          : 'border-amber-100 bg-white/90 hover:bg-white active:bg-amber-50'
      } ${opts.disabled ? 'opacity-45 cursor-default' : ''}`}
    >
      <span className="text-2xl leading-none">{opts.icon}</span>
      <span className="text-xs font-semibold">{opts.label}</span>
      <span className="h-3 text-[10px] text-gugu-ink-soft">{opts.sub}</span>
    </button>
  );

  return (
    <>
      <div className="grid grid-cols-4 gap-2 px-4 pb-5 pt-2">
        {barButton('feed', {
          icon: '🍪',
          label: t.actFeed,
          sub: feedCd > 0 && !disabledBySleep ? fmt(t.cooldownHint, { s: Math.ceil(feedCd / 1000) }) : '',
          disabled: disabledBySleep || feedCd > 0,
          onClick: () => doAction('feed'),
        })}
        {barButton('play', {
          icon: '🎾',
          label: t.actPlay,
          sub: playCd > 0 && !disabledBySleep ? fmt(t.cooldownHint, { s: Math.ceil(playCd / 1000) }) : '',
          disabled: disabledBySleep || playCd > 0,
          onClick: () => doAction('play'),
        })}
        {barButton('sleep', {
          icon: pet.sleeping ? '☀️' : '😴',
          label: pet.sleeping ? t.actWake : t.actSleep,
          disabled: pet.stage === 'egg',
          active: pet.sleeping,
          onClick: toggleSleep,
        })}
        {barButton('more', {
          icon: '⋯',
          label: t.actMore,
          onClick: () => setSheetOpen(true),
        })}
      </div>

      {/* 更多面板 */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center" onClick={() => setSheetOpen(false)} role="presentation">
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
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
              {moreItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onClick();
                    setSheetOpen(false);
                  }}
                  className={`press flex flex-col items-center gap-1 rounded-2xl border border-amber-100 bg-amber-50/60 py-3 ${
                    item.disabled ? 'opacity-40' : 'hover:bg-amber-50 active:bg-amber-100'
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
