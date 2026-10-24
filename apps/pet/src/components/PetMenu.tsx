'use client';

/**
 * 宠物长按/右键菜单：把全部养成动作收进上下文菜单，底部栏只留高频项。
 * 定位在长按/右键坐标附近（自动收进视口），点击任意项后关闭。
 */

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { cooldownRemaining } from '@/lib/balance';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

interface PetMenuProps {
  x: number;
  y: number;
  pet: PetState;
  onOpenChat: () => void;
  onOpenAchievements: () => void;
  onOpenSkin: () => void;
  onOpenShop: () => void;
  onOpenGame: () => void;
  onClose: () => void;
}

export function PetMenu({ x, y, pet, onOpenChat, onOpenAchievements, onOpenSkin, onOpenShop, onOpenGame, onClose }: PetMenuProps) {
  const doAction = usePetStore((s) => s.doAction);
  const doWork = usePetStore((s) => s.doWork);
  const doStudy = usePetStore((s) => s.doStudy);
  const toggleSleep = usePetStore((s) => s.toggleSleep);
  const tapPet = usePetStore((s) => s.tapPet);
  const { locale } = useLocale();
  const t = ui(locale);
  // 菜单为瞬时组件：打开瞬间的冷却快照即可（刷新跟随由打开时机保证）
  const [now] = useState(() => Date.now());

  const egg = pet.stage === 'egg';
  const disabled = egg || pet.sleeping;
  const workBlock = disabled || cooldownRemaining('work', pet, now) > 0 || pet.energy < 30;
  const studyBlock = disabled || cooldownRemaining('study', pet, now) > 0 || pet.energy < 20;

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const items: { icon: string; label: string; disabled?: boolean; handler: () => void }[] = [
    { icon: '🫶', label: t.petMenuTap, disabled: disabled, handler: run(tapPet) },
    { icon: '🍪', label: t.actFeed, disabled, handler: run(() => doAction('feed')) },
    { icon: '🛁', label: t.actWash, disabled, handler: run(() => doAction('wash')) },
    { icon: '🎾', label: t.actPlay, disabled, handler: run(() => doAction('play')) },
    { icon: pet.sleeping ? '☀️' : '😴', label: pet.sleeping ? t.actWake : t.actSleep, disabled: egg, handler: run(toggleSleep) },
    { icon: '💼', label: t.actWork, disabled: workBlock, handler: run(doWork) },
    { icon: '📖', label: t.actStudy, disabled: studyBlock, handler: run(doStudy) },
    { icon: '💬', label: locale === 'zh' ? '聊天' : 'Chat', disabled: false, handler: run(onOpenChat) },
    { icon: '🛍️', label: t.actShop, disabled, handler: run(onOpenShop) },
    { icon: '🎮', label: t.actGame, disabled, handler: run(onOpenGame) },
    { icon: '🏆', label: t.achTitle, disabled: false, handler: run(onOpenAchievements) },
    { icon: '🎨', label: t.skinTitle, disabled: false, handler: run(onOpenSkin) },
  ];

  // 视口收口
  const menuW = 176;
  const menuH = items.length * 40 + 16;
  const left = Math.min(Math.max(8, x - menuW / 2), window.innerWidth - menuW - 8);
  const top = Math.min(Math.max(8, y - 24), Math.max(8, window.innerHeight - menuH - 12));

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} role="presentation">
      <div
        className="absolute max-h-[70dvh] w-44 overflow-y-auto rounded-2xl border border-amber-100 bg-white/97 py-1.5 shadow-2xl backdrop-blur"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={item.handler}
            className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold ${
              item.disabled ? 'opacity-40' : 'hover:bg-amber-50 active:bg-amber-100'
            }`}
          >
            <span className="w-5 text-center text-base leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
