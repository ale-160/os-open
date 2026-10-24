'use client';

import { useEscClose } from '@/hooks/useEscClose';

/**
 * 冲鸭！赛跑（大富翁式连点竞速）：连点屏幕冲刺，赢过蜗牛就赢。
 * 每次点按 +2.2% 距离；蜗牛匀速推进（越到后程越快），22 秒内未到终点按距离计分。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

const DURATION = 22_000;
const TAP_GAIN = 2.2; // 每次点按前进 %
const SNAIL_BASE = 4.9; // 蜗牛基础速度 %/s
const SNAIL_RAMP = 0.35; // 后程加速 %/s²

export function RaceGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const finishMinigame = usePetStore((s) => s.finishMinigame);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [playerPct, setPlayerPct] = useState(0);
  const [snailPct, setSnailPct] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);

  const playerRef = useRef(0);
  const snailRef = useRef(0);
  const finishedRef = useRef(false);
  const rafRef = useRef(0);
  /** 每局随机：蜗牛性格（基础速度 ±12%）与中后程冲刺窗口 */
  const snailBaseRef = useRef(SNAIL_BASE);
  const spurtRef = useRef({ at: 0.5, until: 0.62 });

  const end = useCallback(
    (won: boolean, elapsed: number) => {
      setPhase('done');
      if (!finishedRef.current) {
        finishedRef.current = true;
        let score: number;
        if (won) {
          sfx.fanfare();
          score = 14 + Math.max(0, Math.round((DURATION - elapsed) / 4000));
        } else {
          score = Math.max(2, Math.round(playerRef.current / 9));
        }
        setResult(won ? 'win' : 'lose');
        setReward(finishMinigame('race', score));
      }
    },
    [finishMinigame]
  );

  const start = useCallback(() => {
    finishedRef.current = false;
    playerRef.current = 0;
    snailRef.current = 0;
    // 随机性格：速度 ±12%，45%~80% 赛程处有一次 12% 赛程的冲刺
    snailBaseRef.current = SNAIL_BASE * (0.88 + Math.random() * 0.24);
    const at = 0.45 + Math.random() * 0.35;
    spurtRef.current = { at, until: Math.min(0.95, at + 0.12) };
    setPlayerPct(0);
    setSnailPct(0);
    setTimeLeft(DURATION);
    setResult(null);
    setReward(null);
    setPhase('playing');
  }, []);

  // 主循环
  useEffect(() => {
    if (phase !== 'playing') return;
    const startTime = performance.now();
    let last = startTime;
    const step = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= DURATION) {
        setTimeLeft(0);
        end(playerRef.current >= 100, elapsed);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setTimeLeft(DURATION - elapsed);

      const raceFrac = elapsed / DURATION;
      const spurt = raceFrac >= spurtRef.current.at && raceFrac <= spurtRef.current.until ? 1.55 : 1;
      snailRef.current = Math.min(
        100,
        snailRef.current + (snailBaseRef.current * spurt + SNAIL_RAMP * (elapsed / 1000)) * dt
      );
      if (snailRef.current >= 100) {
        setSnailPct(100);
        end(false, elapsed);
        return;
      }
      setSnailPct(snailRef.current);
      setPlayerPct(Math.min(100, playerRef.current));
      if (playerRef.current >= 100) {
        end(true, elapsed);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, end]);

  // 点按冲刺 + 空格/方向键
  const sprint = useCallback(() => {
    if (phase !== 'playing') return;
    playerRef.current = Math.min(100, playerRef.current + TAP_GAIN);
    setPlayerPct(playerRef.current);
    if (playerRef.current >= 100) {
      const elapsed = DURATION - timeLeft;
      end(true, elapsed);
    }
  }, [phase, timeLeft, end]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        sprint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, sprint]);

  const lane = (pct: number) => (
    <div className="relative h-9 overflow-hidden rounded-full bg-[#d9c39a]/70 shadow-inner">
      <div className="absolute inset-y-0 right-0 w-[7%] border-l-2 border-dashed border-white/70 bg-[#f0716b]/25" />
      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-base">🏁</span>
      <div className="absolute inset-y-1 left-1 rounded-full bg-white/25" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameRace}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🏃 {t.gameRace}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{Math.ceil(timeLeft / 1000)}s</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div
          className="relative touch-none select-none bg-gradient-to-b from-[#e8f4d9] to-[#cfe6b8] p-4"
          onPointerDown={() => {
            if (phase === 'playing') sfx.pop();
            sprint();
          }}
        >
          {/* 赛道 ×2 */}
          <div className="space-y-4 py-2">
            <div>
              <div className="mb-1 text-xs font-bold text-gugu-ink">🐦 {locale === 'zh' ? '咕咕' : 'GuGu'}</div>
              <div className="relative">
                {lane(playerPct)}
                <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-2xl transition-all duration-75" style={{ left: `calc(${Math.min(94, playerPct)}% - 10px)` }}>
                  🐥
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-bold text-gugu-ink">🐌 {locale === 'zh' ? '蜗牛选手' : 'Snail'}</div>
              <div className="relative">
                {lane(snailPct)}
                <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-2xl" style={{ left: `calc(${Math.min(94, snailPct)}% - 10px)` }}>
                  🐌
                </span>
              </div>
            </div>
          </div>

          <div className="pb-2 pt-3 text-center text-sm font-bold text-gugu-ink-soft">
            {phase === 'playing' ? (locale === 'zh' ? '连点屏幕冲刺！' : 'Tap tap tap!') : ''}
          </div>

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center">
              <span className="text-4xl">{phase === 'ready' ? '🏃' : result === 'win' ? '🏅' : '🐌'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.raceHint : ''}</p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-2xl font-extrabold">{result === 'win' ? t.raceWin : t.raceLose}</p>
                  <p className="text-sm font-bold text-gugu-accent">
                    🪙 +{reward.coins}　💗 +{reward.mood}
                  </p>
                </>
              )}
              <button type="button" onClick={start} className="press rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60">
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
