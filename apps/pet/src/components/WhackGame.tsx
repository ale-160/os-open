'use client';

import { useEscClose } from '@/hooks/useEscClose';

/**
 * 打虫虫（参考大富翁打地鼠）：20 秒，虫虫从洞里冒头就点 +1，炸弹 -2。
 * 出现间隔与停留时间随进度收紧。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

const DURATION = 20_000;
const HOLE_COUNT = 6;
const BOMB_RATE = 0.12;

type Occupant = { kind: 'worm' | 'bomb' | 'golden' | 'clock'; id: number } | null;

export function WhackGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const finishMinigame = usePetStore((s) => s.finishMinigame);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [holes, setHoles] = useState<Occupant[]>(() => Array(HOLE_COUNT).fill(null));
  const [wave, setWave] = useState(1);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);

  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const holesRef = useRef<Occupant[]>(Array(HOLE_COUNT).fill(null));
  const timersRef = useRef<number[]>([]);
  const idSeq = useRef(0);
  const endTimeRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const end = useCallback(() => {
    setPhase('done');
    clearAllTimers();
    setHoles(Array(HOLE_COUNT).fill(null));
    holesRef.current = Array(HOLE_COUNT).fill(null);
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(finishMinigame('whack', scoreRef.current));
    }
  }, [finishMinigame, clearAllTimers]);

  const start = useCallback(() => {
    clearAllTimers();
    finishedRef.current = false;
    holesRef.current = Array(HOLE_COUNT).fill(null);
    setHoles(Array(HOLE_COUNT).fill(null));
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(DURATION);
    endTimeRef.current = performance.now() + DURATION;
    setWave(1);
    setReward(null);
    setPhase('playing');
  }, [clearAllTimers]);

  // 主循环：计时（时钟虫可延长）+ 生成（波次推进）
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = window.setInterval(() => {
      const now = performance.now();
      const elapsed = DURATION + 2000 - (endTimeRef.current - now);
      const remain = endTimeRef.current - now;
      if (remain <= 0) {
        setTimeLeft(0);
        end();
        return;
      }
      setTimeLeft(remain);
      const wave = 1 + Math.floor(elapsed / 7000);
      setWave(wave);
      // 生成（波次越深越频繁、停留越短）
      if (Math.random() < Math.min(0.8, 0.55 + (wave - 1) * 0.07)) {
        const empty = holesRef.current.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
        if (empty.length) {
          const idx = empty[Math.floor(Math.random() * empty.length)];
          const progress = Math.min(1, elapsed / DURATION);
          const visible = (1050 - 450 * progress + Math.random() * 200) / (1 + (wave - 1) * 0.1);
          const roll = Math.random();
          const occupant: Occupant = roll < BOMB_RATE
            ? { kind: 'bomb', id: ++idSeq.current }
            : roll < BOMB_RATE + 0.1
              ? { kind: 'golden', id: ++idSeq.current }
              : roll < BOMB_RATE + 0.16
                ? { kind: 'clock', id: ++idSeq.current }
                : { kind: 'worm', id: ++idSeq.current };
          holesRef.current[idx] = occupant;
          setHoles([...holesRef.current]);
          const hide = window.setTimeout(() => {
            holesRef.current[idx] = null;
            setHoles([...holesRef.current]);
          }, occupant.kind === 'golden' ? visible * 0.7 : visible);
          timersRef.current.push(hide);
        }
      }
    }, 420);
    return () => clearInterval(tick);
  }, [phase, end]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const whack = (idx: number) => {
    const occ = holesRef.current[idx];
    if (!occ || phase !== 'playing') return;
    sfx.pop();
    if (occ.kind === 'clock') {
      endTimeRef.current += 2000;
      setTimeLeft((tl) => tl + 2000);
    } else {
      scoreRef.current = Math.max(0, scoreRef.current + (occ.kind === 'bomb' ? -2 : occ.kind === 'golden' ? 3 : 1));
      setScore(scoreRef.current);
    }
    holesRef.current[idx] = null;
    setHoles([...holesRef.current]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameWhack}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🪱 {t.gameWhack}</h2>
          {phase === 'playing' && (
            <span className="rounded-full bg-[#8a6a4d]/85 px-2.5 py-1 text-xs font-extrabold text-white">
              {fmt(t.waveLabel, { n: wave })}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div className="relative bg-gradient-to-b from-[#e8d3ae] to-[#c9a877] p-5">
          {phase === 'playing' && (
            <div className="absolute left-0 top-0 h-1.5 w-full bg-amber-900/15">
                <div className="h-full bg-gugu-accent" style={{ width: `${Math.max(0, Math.min(100, (timeLeft / DURATION) * 100))}%` }} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 pt-3">
            {holes.map((occ, i) => (
              <button
                key={i}
                type="button"
                onClick={() => whack(i)}
                className="relative h-20 overflow-hidden rounded-[50%_50%_40%_40%/60%_60%_35%_35%] bg-[#8a6a4d] shadow-inner"
                aria-label={`hole-${i}`}
              >
                <div className="absolute inset-x-1 bottom-1 h-3 rounded-[50%] bg-[#5f4632]" />
                {occ && (
                  <span
                    className="absolute left-1/2 bottom-2 -translate-x-1/2 text-3xl transition-transform duration-150"
                    style={{ transform: 'translate(-50%, 0)' }}
                  >
                      {occ.kind === 'bomb' ? '💣' : occ.kind === 'golden' ? '✨' : occ.kind === 'clock' ? '⏰' : '🪱'}
                  </span>
                )}
              </button>
            ))}
          </div>

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center">
              <span className="text-4xl">{phase === 'ready' ? '🪱' : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.whackHint : ''}</p>
                {phase === 'done' && reward && (
                  <>
                    <p className="text-3xl font-extrabold">{t.gameScore} {score}</p>
                    {reward.newBest && (
                      <p className="anim-pop rounded-full bg-gugu-accent px-4 py-1 text-sm font-extrabold text-white shadow">
                        {t.newRecord}
                      </p>
                    )}
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
