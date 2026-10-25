'use client';

/**
 * 底部动作 Dock（全端统一无级滚动条）：
 * - 一条无边框胶囊横向滚动条承载全部 14 个动作/入口，触屏直接滑、桌面滚轮/Shift+滚轮/拖拽皆可滑（无级）；
 * - 窄屏自动居中裁切、宽屏完整铺开（同一套代码，无断点分支）；
 * - 冷却秒数与禁用态覆盖全部动作键；高频操作也可以在咕咕身上长按/右键呼出。
 */

import { useEffect, useRef, useState } from 'react';
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

/** 动作/入口统一描述（sub：冷却秒数等按钮下方小字） */
interface DockEntry {
  key: string;
  icon: string;
  label: string;
  sub?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

/** 无边框胶囊容器的公共视觉语言 */
const CAPSULE =
  'pointer-events-auto rounded-[26px] bg-white/40 px-2 py-1.5 shadow-[0_10px_28px_rgba(138,106,77,0.14)] backdrop-blur-sm';

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
  const stripRef = useRef<HTMLDivElement>(null);
  /** 拖拽滚动（桌面鼠标按住拖动，触屏原生滚动） */
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const disabledBySleep = pet.sleeping || pet.stage === 'egg';
  const cdText = (remaining: number) =>
    remaining > 0 && !disabledBySleep ? fmt(t.cooldownHint, { s: Math.ceil(remaining / 1000) }) : '';

  const feedCd = cooldownRemaining('feed', pet, now);
  const washCd = cooldownRemaining('wash', pet, now);
  const playCd = cooldownRemaining('play', pet, now);
  const workCd = cooldownRemaining('work', pet, now);
  const studyCd = cooldownRemaining('study', pet, now);

  /** 全部动作/入口一排（顺序：高频照顾 → 经济 → 入口 → 设置） */
  const allEntries: DockEntry[] = [
    {
      key: 'feed',
      icon: '🍪',
      label: t.actFeed,
      sub: cdText(feedCd),
      disabled: disabledBySleep || feedCd > 0,
      onClick: () => doAction('feed'),
    },
    {
      key: 'wash',
      icon: '🛁',
      label: t.actWash,
      sub: cdText(washCd),
      disabled: disabledBySleep || washCd > 0,
      onClick: () => doAction('wash'),
    },
    {
      key: 'play',
      icon: '🎾',
      label: t.actPlay,
      sub: cdText(playCd),
      disabled: disabledBySleep || playCd > 0,
      onClick: () => doAction('play'),
    },
    {
      key: 'work',
      icon: '💼',
      label: t.actWork,
      sub: cdText(workCd),
      disabled: disabledBySleep || workCd > 0 || pet.energy < 30,
      onClick: () => usePetStore.getState().doWork(),
    },
    {
      key: 'study',
      icon: '📖',
      label: t.actStudy,
      sub: cdText(studyCd),
      disabled: disabledBySleep || studyCd > 0 || pet.energy < 20,
      onClick: () => usePetStore.getState().doStudy(),
    },
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
    { key: 'chat', icon: '💬', label: t.actChat, onClick: onOpenChat },
    { key: 'ach', icon: '🏆', label: t.achTitle, onClick: onOpenAchievements },
    { key: 'skin', icon: '🎨', label: t.skinTitle, onClick: onOpenSkin },
    { key: 'travel', icon: '🎒', label: t.actTravel, onClick: onOpenTravel },
    { key: 'diary', icon: '📔', label: t.actDiary, onClick: onOpenDiary },
    { key: 'settings', icon: '⚙️', label: t.settingsTitle, onClick: onOpenSettings },
  ];

  const dockButton = (entry: DockEntry) => (
    <button
      key={entry.key}
      type="button"
      disabled={entry.disabled}
      onClick={entry.onClick}
      className={`press flex w-[64px] shrink-0 snap-center flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors ${
        entry.active ? 'bg-[#eef2ff]/90' : 'hover:bg-white/60 active:bg-white/85'
      } ${entry.disabled ? 'opacity-40' : ''}`}
    >
      <span className={`text-[26px] leading-none ${entry.active ? '' : 'drop-shadow-sm'}`}>{entry.icon}</span>
      <span className="whitespace-nowrap text-[11px] font-bold tracking-wide">{entry.label}</span>
      <span className="h-3 whitespace-nowrap text-[10px] font-semibold text-gugu-accent">{entry.sub ?? ''}</span>
    </button>
  );

  /** 桌面鼠标拖拽滚动（触屏原生滚动已够用） */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    dragRef.current = { startX: e.clientX, startScroll: stripRef.current?.scrollLeft ?? 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !stripRef.current) return;
    stripRef.current.scrollLeft = dragRef.current.startScroll - (e.clientX - dragRef.current.startX);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3 md:px-6">
      <div
        ref={stripRef}
        className={`no-scrollbar ${CAPSULE} flex w-full max-w-[720px] snap-x snap-mandatory items-stretch gap-1 overflow-x-auto`}
        onWheel={(e) => {
          // 桌面滚轮纵向 → 横向滚动（无级滚动）
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {allEntries.map(dockButton)}
      </div>
    </div>
  );
}
