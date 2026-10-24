'use client';

/**
 * 接点心小游戏：移动咕咕接住掉落的点心（躲开炸弹），30 秒一局。
 * 奖励：得分 → 心情 + 元宝（见 balance.minigameReward）。
 * 实现说明：下落物与接手用 rAF + ref 直接改 DOM transform，避免高频 setState。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MINIGAME } from '@/lib/balance';
import { bodySrc, DEFAULT_CUSTOM_FACE, faceLayoutFor } from '@/lib/skins';
import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { Face } from './PetSprite';
import type { PetState } from '@/lib/types';

const SNACKS = ['🍪', '🍰', '🍩', '🍭'];
const BOMB = '💣';
const CATCH_Y = 80; // 判定线（%）
const CATCH_HALF = 15; // 接住判定半宽（%）

interface FallingItem {
  id: number;
  x: number;
  y: number;
  v: number;
  kind: string;
  bomb: boolean;
  caught: boolean;
  el: HTMLSpanElement | null;
}

export function SnackGame({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const finishMinigame = usePetStore((s) => s.finishMinigame);
  const resolvedSkin = usePetStore((s) => s.resolvedSkin);
  const { locale } = useLocale();
  const t = ui(locale);
  const skin = resolvedSkin();
  const bodyFaceLayout = faceLayoutFor(pet.variant, 'baby');

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(MINIGAME.durationMs);
  const [reward, setReward] = useState<{ coins: number; mood: number } | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const catcherRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<FallingItem[]>([]);
  const catcherXRef = useRef(50);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const rafRef = useRef(0);
  const idSeqRef = useRef(0);

  const setCatchX = useCallback((x: number) => {
    const clamped = Math.min(92, Math.max(8, x));
    catcherXRef.current = clamped;
    if (catcherRef.current) catcherRef.current.style.left = `${clamped}%`;
  }, []);

  const start = useCallback(() => {
    // 清场
    for (const it of itemsRef.current) it.el?.remove();
    itemsRef.current = [];
    scoreRef.current = 0;
    finishedRef.current = false;
    setScore(0);
    setTimeLeft(MINIGAME.durationMs);
    setReward(null);
    setCatchX(50);
    setPhase('playing');
  }, [setCatchX]);

  const end = useCallback(() => {
    setPhase('done');
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(finishMinigame(scoreRef.current));
    }
  }, [finishMinigame]);

  // 主循环
  useEffect(() => {
    if (phase !== 'playing') return;
    const startTime = performance.now();
    let last = startTime;
    let nextSpawnAt = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= MINIGAME.durationMs) {
        setTimeLeft(0);
        end();
        return;
      }
      const progress = elapsed / MINIGAME.durationMs;
      setTimeLeft(MINIGAME.durationMs - elapsed);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // 生成（间隔随进度加快）
      if (now >= nextSpawnAt) {
        const interval =
          MINIGAME.spawnIntervalStart +
          (MINIGAME.spawnIntervalEnd - MINIGAME.spawnIntervalStart) * progress;
        nextSpawnAt = now + interval * (0.75 + Math.random() * 0.5);
        const bomb = Math.random() < MINIGAME.bombRate;
        const speed =
          MINIGAME.fallSpeedStart + (MINIGAME.fallSpeedEnd - MINIGAME.fallSpeedStart) * progress;
        itemsRef.current.push({
          id: ++idSeqRef.current,
          x: 8 + Math.random() * 84,
          y: -6,
          v: speed * (0.85 + Math.random() * 0.3),
          kind: bomb ? BOMB : SNACKS[Math.floor(Math.random() * SNACKS.length)],
          bomb,
          caught: false,
          el: null,
        });
      }

      // 移动 + 判定（按穿越判定线检测，杜绝高帧损导致的"看着接住却没判到"）
      const remain: FallingItem[] = [];
      for (const it of itemsRef.current) {
        if (it.caught) continue;
        const prevY = it.y;
        it.y += it.v * dt;
        const crossed = prevY < CATCH_Y && it.y >= CATCH_Y;
        const inWindow = it.y >= CATCH_Y && it.y <= CATCH_Y + 12;
        if ((crossed || inWindow) && Math.abs(it.x - catcherXRef.current) <= CATCH_HALF) {
          it.caught = true;
          it.el?.remove();
          scoreRef.current = Math.max(0, scoreRef.current + (it.bomb ? -2 : 1));
          setScore(scoreRef.current);
          continue;
        }
        if (it.y > 108) {
          it.el?.remove();
          continue;
        }
        if (it.el) {
          it.el.style.left = `${it.x}%`;
          it.el.style.top = `${it.y}%`;
        }
        remain.push(it);
      }
      itemsRef.current = remain;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, end]);

  // 键盘控制
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCatchX(catcherXRef.current - 6);
      if (e.key === 'ArrowRight') setCatchX(catcherXRef.current + 6);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, setCatchX]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameTitle}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">{t.gameTitle}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">
              ✕
            </button>
          </div>
        </div>

        {/* 游戏区 */}
        <div
          ref={areaRef}
          className="relative h-[58vh] touch-none select-none overflow-hidden bg-gradient-to-b from-[#ffedd0] to-[#ffe3b8]"
          onPointerMove={(e) => {
            if (phase !== 'playing' || !areaRef.current) return;
            const rect = areaRef.current.getBoundingClientRect();
            setCatchX(((e.clientX - rect.left) / rect.width) * 100);
          }}
        >
          {/* 掉落物（由 rAF 直接操纵样式） */}
          {phase === 'playing' && (
            <Spawner itemsRef={itemsRef} />
          )}

          {/* 计时条 */}
          {phase === 'playing' && (
            <div className="absolute left-0 top-0 z-10 h-1.5 w-full bg-amber-900/10">
              <div className="h-full bg-gugu-accent" style={{ width: `${(timeLeft / MINIGAME.durationMs) * 100}%` }} />
            </div>
          )}

          {/* 接手的咕咕 */}
          <div ref={catcherRef} className="absolute bottom-[2%] w-[30%] -translate-x-1/2" style={{ left: '50%' }}>
            <div className="relative" style={{ aspectRatio: '4 / 5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={skin?.src ?? bodySrc(pet.variant, 'baby')}
                alt=""
                className="h-full w-full object-contain"
                draggable={false}
              />
              {(!skin || skin.faceOverlay) && (
                <Face
                  face={skin ? DEFAULT_CUSTOM_FACE : bodyFaceLayout}
                  sleeping={false}
                  happy
                  sad={false}
                  sick={false}
                  chewing={false}
                />
              )}
            </div>
          </div>

          {/* 遮罩层：开始 / 结算 */}
          {phase !== 'playing' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 px-6 text-center backdrop-blur-[2px]">
              <span className="text-4xl">{phase === 'ready' ? '🍪' : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.gameHint : ''}</p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-3xl font-extrabold">{t.gameScore} {score}</p>
                  <p className="text-sm font-bold text-gugu-accent">{fmt(t.gameReward, { c: reward.coins, m: reward.mood })}</p>
                </>
              )}
              <button
                type="button"
                onClick={start}
                className="press rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60"
              >
                {phase === 'ready' ? t.gameStart : t.gameAgain}
              </button>
              <button type="button" onClick={onClose} className="press text-xs font-semibold text-gugu-ink-soft">
                {t.close}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 掉落物 DOM 池：渲染与 itemsRef 同步（简单起见每帧渲染固定池，rAF 只改样式）。
 * 用空的 React 容器 + 命令式创建 span，避免高频 reconcile。
 */
function Spawner({ itemsRef }: { itemsRef: React.RefObject<FallingItem[]> }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    const tick = () => {
      const items = itemsRef.current ?? [];
      // 为新元素补建 DOM
      for (const it of items) {
        if (!it.el) {
          const span = document.createElement('span');
          span.textContent = it.kind;
          span.className = 'pointer-events-none absolute text-[30px]';
          span.style.transform = 'translateX(-50%)';
          span.style.left = `${it.x}%`;
          span.style.top = `${it.y}%`;
          host.appendChild(span);
          it.el = span;
        }
      }
      // 移除已不在池中的元素
      for (const child of Array.from(host.children)) {
        const owned = items.some((it) => it.el === child);
        if (!owned) child.remove();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      host.replaceChildren();
    };
  }, [itemsRef]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
