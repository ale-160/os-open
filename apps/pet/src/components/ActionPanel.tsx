'use client';

/**
 * 底部动作 Dock（自适应双形态）：
 * - PC（md+）：胶囊内联 6 个高频动作（喂食/洗澡/玩耍/打工/学习/睡觉），「⋯ 更多」就地展开第二排
 *   入口（grid-rows 高度过渡），再点收起；
 * - 移动端：横向滑动条（高频动作 + 商店/游戏 + 更多，snap 对齐 + 隐藏滚动条），「更多」仍走底部弹窗。
 * 冷却秒数与禁用态覆盖全部动作键；高频操作也可以在咕咕身上长按/右键呼出。
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

/** 动作/入口统一描述（sub：冷却秒数等按钮下方小字） */
interface DockEntry {
  key: string;
  icon: string;
  label: string;
  sub?: string;
  disabled?: boolean;
  active?: boolean;
  ariaExpanded?: boolean;
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
  const [expanded, setExpanded] = useState(false); // PC：⋯ 就地展开第二排
  const [sheetOpen, setSheetOpen] = useState(false); // 移动端：更多弹窗
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const disabledBySleep = pet.sleeping || pet.stage === 'egg';
  const cdText = (remaining: number) =>
    remaining > 0 && !disabledBySleep ? fmt(t.cooldownHint, { s: Math.ceil(remaining / 1000) }) : '';

  // 高频照顾动作：冷却秒数与禁用态覆盖全部键（喂食/洗澡/玩耍/打工/学习/睡觉）
  const feedCd = cooldownRemaining('feed', pet, now);
  const washCd = cooldownRemaining('wash', pet, now);
  const playCd = cooldownRemaining('play', pet, now);
  const workCd = cooldownRemaining('work', pet, now);
  const studyCd = cooldownRemaining('study', pet, now);
  const careActions: DockEntry[] = [
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
  ];

  // 其余入口：PC 展开排取全量；移动端滑动条取商店/游戏，其余进「更多」弹窗
  const shopEntry: DockEntry = { key: 'shop', icon: '🛍️', label: t.actShop, disabled: disabledBySleep, onClick: onOpenShop };
  const gameEntry: DockEntry = { key: 'game', icon: '🎮', label: t.actGame, disabled: disabledBySleep, onClick: onOpenGame };
  const sheetEntries: DockEntry[] = [
    { key: 'chat', icon: '💬', label: t.actChat, onClick: onOpenChat },
    { key: 'ach', icon: '🏆', label: t.achTitle, onClick: onOpenAchievements },
    { key: 'skin', icon: '🎨', label: t.skinTitle, onClick: onOpenSkin },
    { key: 'travel', icon: '🎒', label: t.actTravel, onClick: onOpenTravel },
    { key: 'diary', icon: '📔', label: t.actDiary, onClick: onOpenDiary },
    { key: 'settings', icon: '⚙️', label: t.settingsTitle, onClick: onOpenSettings },
  ];
  const secondaryEntries: DockEntry[] = [shopEntry, gameEntry, ...sheetEntries];

  const dockButton = (entry: DockEntry, widthClass: string) => (
    <button
      key={entry.key}
      type="button"
      disabled={entry.disabled}
      aria-expanded={entry.ariaExpanded}
      onClick={entry.onClick}
      className={`press ${widthClass} flex flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors ${
        entry.active ? 'bg-[#eef2ff]/90' : 'hover:bg-white/60 active:bg-white/85'
      } ${entry.disabled ? 'opacity-40' : ''}`}
    >
      <span className={`text-[26px] leading-none ${entry.active ? '' : 'drop-shadow-sm'}`}>{entry.icon}</span>
      <span className="whitespace-nowrap text-[11px] font-bold tracking-wide">{entry.label}</span>
      <span className="h-3 whitespace-nowrap text-[10px] font-semibold text-gugu-accent">{entry.sub ?? ''}</span>
    </button>
  );

  const stripItem = 'w-[64px] shrink-0 snap-center';

  return (
    <>
      {/* 移动端：横向滑动条（左右滑动访问全部动作，滚动条隐藏） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3 md:hidden">
        <div
          className={`no-scrollbar ${CAPSULE} flex w-full max-w-[440px] snap-x snap-mandatory items-stretch gap-1 overflow-x-auto`}
        >
          {careActions.map((entry) => dockButton(entry, stripItem))}
          {dockButton(shopEntry, stripItem)}
          {dockButton(gameEntry, stripItem)}
          {dockButton({ key: 'more', icon: '⋯', label: t.actMore, onClick: () => setSheetOpen(true) }, stripItem)}
        </div>
      </div>

      {/* PC：胶囊内联 6 键 + 「⋯ 更多」就地展开第二排（grid-rows 高度过渡） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 hidden justify-center px-4 md:flex">
        <div className={CAPSULE}>
          <div className="flex items-stretch justify-around">
            {careActions.map((entry) => dockButton(entry, 'min-w-[64px] flex-1 px-1'))}
            {dockButton(
              {
                key: 'more',
                icon: '⋯',
                label: t.actMore,
                active: expanded,
                ariaExpanded: expanded,
                onClick: () => setExpanded((v) => !v),
              },
              'min-w-[56px] px-2'
            )}
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
            inert={!expanded}
          >
            <div className="overflow-hidden">
              <div className="mt-1.5 flex items-stretch justify-around gap-1 border-t border-gugu-ink/10 pt-1.5">
                {secondaryEntries.map((entry) => dockButton(entry, 'min-w-[64px] flex-1 px-1'))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 移动端「更多」弹窗（PC 由就地展开替代） */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setSheetOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t.moreTitle}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t.moreTitle}</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {sheetEntries.map((item) => (
                <button
                  key={item.key}
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
