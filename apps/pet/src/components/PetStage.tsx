'use client';

/**
 * 游戏主舞台：房间布景 + 行走/表演周期（踱步 ↔ 随机小动作）+ 气泡 + 长按/右键菜单钩子。
 * 小动作序列：站立表演（歪头/啄地/转身/扑翅/唱歌）穿插在踱步之间，让咕咕更有活物感。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { HATCH_TAPS } from '@/lib/balance';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { PetSprite, type TrickId } from './PetSprite';

const WALK_SPEED = 4.2; // %/s
const BOUND_L = 26;
const BOUND_R = 74;
const TRICKS: TrickId[] = ['tilt', 'peck', 'turn', 'flap', 'sing'];
const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE = 12;

interface PetStageProps {
  onPetMenu?: (x: number, y: number) => void;
}

export function PetStage({ onPetMenu }: PetStageProps) {
  const pet = usePetStore((s) => s.pet)!;
  const anim = usePetStore((s) => s.anim);
  const burst = usePetStore((s) => s.burst);
  const bubble = usePetStore((s) => s.bubble);
  const tapPet = usePetStore((s) => s.tapPet);
  const tapEgg = usePetStore((s) => s.tapEgg);
  const resolvedSkin = usePetStore((s) => s.resolvedSkin);
  const { locale } = useLocale();
  const t = ui(locale);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [trick, setTrick] = useState<TrickId | null>(null);
  const timersRef = useRef<number[]>([]);

  const isEgg = pet.stage === 'egg';
  const canPerform = !isEgg && !pet.sleeping && !anim && !pet.sick;
  const walking = canPerform && !trick;

  // 行走 ↔ 表演周期（!canPerform 期间 trick 仅被忽略而不清除，避免 effect 内同步 setState）
  useEffect(() => {
    if (!canPerform) return;
    let cancelled = false;
    const schedule = (delay: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
      timersRef.current.push(id);
    };
    const loop = () => {
      schedule(4200 + Math.random() * 4800, () => {
        const trickId = TRICKS[Math.floor(Math.random() * TRICKS.length)];
        if (trickId === 'turn') setFacing((f) => (f === 1 ? -1 : 1));
        setTrick(trickId);
        schedule(trickId === 'sing' ? 2200 : 1500, () => {
          setTrick(null);
          loop();
        });
      });
    };
    loop();
    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [canPerform]);

  // 踱步
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let px = 50;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (walking) {
        px += dirRef.current * WALK_SPEED * dt;
        if (px >= BOUND_R) {
          px = BOUND_R;
          dirRef.current = -1;
          setFacing(-1);
        } else if (px <= BOUND_L) {
          px = BOUND_L;
          dirRef.current = 1;
          setFacing(1);
        }
        if (wrapRef.current) wrapRef.current.style.left = `${px}%`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [walking]);

  // 长按 / 右键菜单
  const pressRef = useRef<{ x: number; y: number; timer: number; fired: boolean } | null>(null);
  const openMenuAt = useCallback(
    (x: number, y: number) => {
      if (pressRef.current) pressRef.current.fired = true;
      onPetMenu?.(x, y);
    },
    [onPetMenu]
  );
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const px = e.clientX;
      const py = e.clientY;
      const timer = window.setTimeout(() => openMenuAt(px, py), LONG_PRESS_MS);
      pressRef.current = { x: px, y: py, timer, fired: false };
    },
    [openMenuAt]
  );
  const cancelPress = useCallback(() => {
    if (pressRef.current) {
      clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
  }, []);
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const press = pressRef.current;
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > LONG_PRESS_MOVE) cancelPress();
    },
    [cancelPress]
  );
  const onTap = useCallback(() => {
    if (pressRef.current?.fired) return; // 长按已弹菜单，吞掉随后的 click
    if (isEgg) tapEgg();
    else tapPet();
  }, [isEgg, tapEgg, tapPet]);

  return (
    <div className="relative min-h-[320px] flex-1 overflow-hidden">
      {/* 布景：暖色天空 + 太阳 + 云 + 地板 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#ffedd0] via-[#fff8ea] to-[#ffedcb]" />
      <div className="absolute left-[9%] top-[9%] h-12 w-12 rounded-full bg-[#ffd98a] shadow-[0_0_44px_18px_rgba(255,217,138,0.55)]" />
      <div className="absolute right-[10%] top-[16%] h-10 w-20 rounded-full bg-white/80 blur-[1px]" />
      <div className="absolute right-[16%] top-[11%] h-8 w-14 rounded-full bg-white/70 blur-[1px]" />
      <div className="absolute -bottom-[14%] left-1/2 h-[34%] w-[150%] -translate-x-1/2 rounded-[100%] bg-[#f7dcae]" />
      <div className="absolute bottom-0 h-[7%] w-full bg-[#f2d19a]/70" />

      {/* 咕咕（含气泡，随踱步整体移动） */}
      <div
        ref={wrapRef}
        className="absolute bottom-[7%] -translate-x-1/2"
        style={{ left: '50%' }}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(e.clientX, e.clientY);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
      >
        {bubble && (
          <div
            key={bubble.id}
            className="anim-pop absolute -top-12 left-1/2 z-10 w-max max-w-[230px] -translate-x-1/2 rounded-2xl border border-amber-100 bg-white/95 px-3.5 py-2 text-sm font-medium shadow-lg shadow-amber-900/10"
          >
            {bubble.text}
            <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-amber-100 bg-white/95" />
          </div>
        )}
        <PetSprite
          pet={pet}
          anim={anim}
          burst={burst}
          walking={walking}
          facing={facing}
          customSkin={resolvedSkin()}
          trick={canPerform ? trick : null}
          onTap={onTap}
        />
      </div>

      {/* 破壳提示 */}
      {isEgg && pet.tapsToHatch === HATCH_TAPS && (
        <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 animate-pulse rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-gugu-accent shadow">
          {t.hatchTapHint}
        </div>
      )}
    </div>
  );
}
