'use client';

/** 照顾与养成动作面板：喂食/洗澡/玩耍/睡觉 + 打工/学习/商店/游戏（含冷却与精力校验） */

import { useEffect, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { STUDY, WORK, cooldownRemaining, type CareActionId } from '@/lib/balance';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

interface ButtonSpec {
  key: string;
  icon: string;
  label: string;
  /** 按钮下的小字（冷却秒数等） */
  sub?: string;
  /** 悬停提示 */
  hint?: string;
  disabled: boolean;
  active?: boolean;
  onClick: () => void;
}

export function ActionPanel({
  pet,
  onOpenShop,
  onOpenGame,
}: {
  pet: PetState;
  onOpenShop: () => void;
  onOpenGame: () => void;
}) {
  const doAction = usePetStore((s) => s.doAction);
  const doWork = usePetStore((s) => s.doWork);
  const doStudy = usePetStore((s) => s.doStudy);
  const toggleSleep = usePetStore((s) => s.toggleSleep);
  const { locale } = useLocale();
  const t = ui(locale);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const disabledBySleep = pet.sleeping || pet.stage === 'egg';

  const careButtons: ButtonSpec[] = (
    [
      { id: 'feed', icon: '🍪', label: t.actFeed, run: () => doAction('feed') },
      { id: 'wash', icon: '🛁', label: t.actWash, run: () => doAction('wash') },
      { id: 'play', icon: '🎾', label: t.actPlay, run: () => doAction('play') },
      { id: 'work', icon: '💼', label: t.actWork, run: doWork },
      { id: 'study', icon: '📖', label: t.actStudy, run: doStudy },
    ] as { id: CareActionId; icon: string; label: string; run: () => void }[]
  ).map(({ id, icon, label, run }) => {
    const remaining = cooldownRemaining(id, pet, now);
    const energyCost = id === 'work' ? WORK.energyCost : id === 'study' ? STUDY.energyCost : 0;
    const tooTired = energyCost > 0 && pet.energy < energyCost;
    return {
      key: id,
      icon,
      label,
      sub:
        remaining > 0 && !disabledBySleep
          ? fmt(t.cooldownHint, { s: Math.ceil(remaining / 1000) })
          : '',
      hint:
        energyCost > 0
          ? fmt(id === 'work' ? t.workHint : t.studyHint, { e: energyCost })
          : undefined,
      disabled: disabledBySleep || remaining > 0 || tooTired,
      onClick: run,
    };
  });

  const extraButtons: ButtonSpec[] = [
    {
      key: 'sleep',
      icon: pet.sleeping ? '☀️' : '😴',
      label: pet.sleeping ? t.actWake : t.actSleep,
      disabled: pet.stage === 'egg',
      active: pet.sleeping,
      onClick: toggleSleep,
    },
    { key: 'shop', icon: '🛍️', label: t.actShop, disabled: disabledBySleep, onClick: onOpenShop },
    { key: 'game', icon: '🎮', label: t.actGame, disabled: disabledBySleep, onClick: onOpenGame },
  ];

  const all = [...careButtons, ...extraButtons];

  return (
    <div className="grid grid-cols-4 gap-2 px-4 pb-5 pt-2">
      {all.map((b) => (
        <button
          key={b.key}
          type="button"
          disabled={b.disabled}
          onClick={b.onClick}
          title={b.hint}
          className={`press flex flex-col items-center gap-0.5 rounded-2xl border py-2.5 shadow-sm ${
            b.active
              ? 'border-[#8aa8ff]/40 bg-[#eef2ff]/90'
              : 'border-amber-100 bg-white/90 hover:bg-white active:bg-amber-50'
          } ${b.disabled ? 'opacity-45 cursor-default' : ''}`}
        >
          <span className="text-2xl leading-none">{b.icon}</span>
          <span className="text-xs font-semibold">{b.label}</span>
          <span className="h-3 text-[10px] text-gugu-ink-soft">{b.sub}</span>
        </button>
      ))}
    </div>
  );
}
