'use client';

/**
 * 游戏主舞台：昼夜天色（按本地时段切换）+ 行走/表演周期 + 小剧场（追蝴蝶/打哈欠/饿了对峙）
 * + 气泡 + 长按/右键菜单钩子。生病/睡觉提示以浮动胶囊呈现，不再堆叠在底部。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { HATCH_TAPS } from '@/lib/balance';
import { skyTheme } from '@/lib/sky';
import { destById } from '@/lib/travel';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { PetSprite, type TrickId } from './PetSprite';

const WALK_SPEED = 4.2; // %/s
const BOUND_L = 22;
const BOUND_R = 78;
const TRICKS: TrickId[] = ['tilt', 'peck', 'turn', 'flap', 'sing', 'dance', 'sit'];
const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE = 12;

interface PetStageProps {
  onPetMenu?: (x: number, y: number) => void;
  className?: string;
}

export function PetStage({ onPetMenu, className }: PetStageProps) {
  const pet = usePetStore((s) => s.pet)!;
  const anim = usePetStore((s) => s.anim);
  const burst = usePetStore((s) => s.burst);
  const bubble = usePetStore((s) => s.bubble);
  const tapPet = usePetStore((s) => s.tapPet);
  const tapEgg = usePetStore((s) => s.tapEgg);
  const resolvedSkin = usePetStore((s) => s.resolvedSkin);
  const { locale } = useLocale();
  const t = ui(locale);

  const [hour] = useState(() => new Date().getHours());
  const sky = skyTheme(hour);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<1 | -1>(1);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [trick, setTrick] = useState<TrickId | null>(null);
  const [butterfly, setButterfly] = useState(0); // 触发序号（0 = 无）；奇偶控制方向
  const timersRef = useRef<number[]>([]);

  const isEgg = pet.stage === 'egg';
  const away = pet.trip?.status === 'away';
  const canPerform = !isEgg && !away && !pet.sleeping && !anim && !pet.sick;
  const walking = canPerform && !trick;
  const running = canPerform && trick === 'run';

  // 行走 ↔ 表演周期（!canPerform 期间 trick 仅被忽略，避免 effect 内同步 setState）
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
      schedule(4200 + Math.random() * 4600, () => {
        // 选择性小行为：困了打哈欠蹲坐、饿了盯着你要吃的
        const state = usePetStore.getState().pet;
        let trickId: TrickId = TRICKS[Math.floor(Math.random() * TRICKS.length)];
        if (state && state.energy < 30 && Math.random() < 0.45) {
          trickId = 'sit';
          usePetStore.getState().say('yawn');
        } else if (state && state.satiety < 30 && Math.random() < 0.35) {
          trickId = 'sit';
          usePetStore.getState().say('hungry');
        }
        if (trickId === 'turn') setFacing((f) => (f === 1 ? -1 : 1));
        setTrick(trickId);
        schedule(
          trickId === 'sing' || trickId === 'dance' ? 2000 : trickId === 'sit' ? 2600 : 1500,
          () => {
            setTrick(null);
            loop();
          }
        );
      });
    };
    loop();
    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [canPerform]);

  // 小剧场：蝴蝶飞过（低频），咕咕会追。独立本地定时器，不与其他 effect 共享注册表
  useEffect(() => {
    if (!canPerform) return;
    let cancelled = false;
    const localTimers: number[] = [];
    const schedule = (delay: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
      localTimers.push(id);
    };
    const loop = () => {
      schedule(26_000 + Math.random() * 26_000, () => {
        setButterfly((n) => n + 1);
        setTrick('run');
        if (Math.random() < 0.6) usePetStore.getState().say('butterfly');
        schedule(4200, () => {
          setTrick(null);
          loop();
        });
      });
    };
    loop();
    return () => {
      cancelled = true;
      localTimers.forEach(clearTimeout);
    };
  }, [canPerform]);

  // 蝴蝶动画结束即卸载（keyframes 无 forwards，动画一停就移除，避免冻在半空）
  const onButterflyEnd = useCallback(() => setButterfly(0), []);

  // 踱步 / 奔跑
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let px = 50;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speed = walking ? WALK_SPEED : running ? WALK_SPEED * 4.4 : 0;
      if (speed > 0) {
        px += dirRef.current * speed * dt;
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
  }, [walking, running]);

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
    <div className={`relative overflow-hidden ${className ?? 'min-h-[320px] flex-1'}`}>
      {/* 昼夜天色 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${sky.sky}`} />
      {sky.orb === 'moon' ? (
        <div className="absolute left-[10%] top-[24%] h-11 w-11 rounded-full bg-[#f4f1ff] shadow-[0_0_40px_14px_rgba(244,241,255,0.35)]" />
      ) : (
        <div
          className={`absolute left-[10%] top-[24%] rounded-full ${sky.orb === 'dusk' ? 'h-14 w-14 bg-[#ff9f6e] shadow-[0_0_48px_20px_rgba(255,159,110,0.5)]' : 'h-12 w-12 bg-[#ffd98a] shadow-[0_0_44px_18px_rgba(255,217,138,0.55)]'}`}
        />
      )}
      {sky.stars &&
        [
          { l: '22%', t: '34%', d: '0s' },
          { l: '36%', t: '46%', d: '0.8s' },
          { l: '58%', t: '30%', d: '1.6s' },
          { l: '74%', t: '42%', d: '0.4s' },
          { l: '88%', t: '34%', d: '1.2s' },
        ].map((s, i) => (
          <span key={i} className="absolute animate-pulse text-[10px] text-white/80" style={{ left: s.l, top: s.t, animationDelay: s.d }}>
            ✦
          </span>
        ))}
      <div className="absolute right-[12%] top-[36%] h-10 w-20 rounded-full bg-white/80 blur-[1px]" />
      <div className="absolute right-[18%] top-[31%] h-8 w-14 rounded-full bg-white/70 blur-[1px]" />
      <div className="absolute -bottom-[14%] left-1/2 h-[34%] w-[150%] -translate-x-1/2 rounded-[100%]" style={{ background: sky.floor }} />
      <div className="absolute bottom-0 h-[7%] w-full" style={{ background: sky.floorDeep, opacity: 0.7 }} />

      {/* 小剧场：蝴蝶（动画结束即卸载） */}
      {butterfly > 0 && (
        <span
          key={butterfly}
          onAnimationEnd={onButterflyEnd}
          className="pointer-events-none absolute top-[26%] text-2xl"
          style={{ animation: 'gugu-fly 4.2s linear 1', animationDirection: butterfly % 2 === 0 ? 'reverse' : 'normal' }}
        >
          🦋
        </span>
      )}

      {/* 生病 / 睡觉 / 打工 / 学习浮动胶囊（悬浮 HUD 下层） */}
      {pet.sick && (
        <div className="absolute left-1/2 top-[118px] z-10 -translate-x-1/2 rounded-full bg-[#f0716b]/85 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
          🤒 {t.sickPill}
        </div>
      )}
      {pet.sleeping && !pet.sick && (
        <div className="absolute left-1/2 top-[118px] z-10 -translate-x-1/2 rounded-full bg-[#5f7de0]/80 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
          💤 {t.sleepPill}
        </div>
      )}
      {anim === 'working' && (
        <div className="absolute left-1/2 top-[118px] z-10 -translate-x-1/2 animate-pulse rounded-full bg-[#8a6a4d]/85 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
          💼 {locale === 'zh' ? '打工中…' : 'Working...'}
        </div>
      )}
      {anim === 'studying' && (
        <div className="absolute left-1/2 top-[118px] z-10 -translate-x-1/2 animate-pulse rounded-full bg-[#7bc86c]/85 px-3.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
          📖 {locale === 'zh' ? '学习中…' : 'Studying...'}
        </div>
      )}

      {/* 旅行中：出门告示卡替代咕咕本体 */}
      {away && pet.trip && (
        <div className="absolute left-1/2 top-1/2 z-10 w-56 -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-amber-100 bg-white/95 p-4 text-center shadow-xl backdrop-blur">
          <span className="block text-3xl">🎒</span>
          <p className="mt-1.5 text-sm font-bold text-gugu-ink">
            {pet.name} {fmt(t.tripNote, { dest: locale === 'zh' ? destById(pet.trip.dest).zh : destById(pet.trip.dest).en })}
          </p>
          <p className="mt-1 text-[11px] text-gugu-ink-soft">{t.tripBack}</p>
        </div>
      )}

      {/* 咕咕本体（旅行时隐藏） */}
      {!away && (
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
        {/* 走路脚下的小尘土 */}
        {walking && (
          <div className="pointer-events-none absolute bottom-1 left-1/2 w-[110px] -translate-x-1/2">
            <span className="anim-dust absolute bottom-0 left-3 h-1.5 w-1.5 rounded-full bg-[#a5825f]/70" />
            <span className="anim-dust absolute bottom-0.5 left-11 h-1 w-1 rounded-full bg-[#a5825f]/60" style={{ animationDelay: '0.45s' }} />
            <span className="anim-dust absolute bottom-1 left-[64px] h-1.5 w-1.5 rounded-full bg-[#a5825f]/70" style={{ animationDelay: '0.9s' }} />
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
      )}

      {/* 破壳提示 */}
      {isEgg && pet.tapsToHatch === HATCH_TAPS && (
        <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 animate-pulse rounded-full bg-white/85 px-4 py-1.5 text-sm font-semibold text-gugu-accent shadow">
          {t.hatchTapHint}
        </div>
      )}
    </div>
  );
}
