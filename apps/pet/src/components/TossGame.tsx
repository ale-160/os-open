'use client';

/**
 * 投喂高手（大富翁式时机判定）：指针在轨道上左右摆动，在准星区间内点停即投中。
 * 三轮一轮比一轮快、区间一轮比一轮窄：中心 +5、区间内 +3、偏出 0。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

const ROUNDS = 3;
/** 每轮：摆动速度（rad/s）与区间半宽（%） */
const ROUND_CFG = [
  { speed: 3.2, half: 15 },
  { speed: 4.2, half: 11 },
  { speed: 5.4, half: 8 },
];

export function TossGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const finishMinigame = usePetStore((s) => s.finishMinigame);
  const { locale } = useLocale();
  const t = ui(locale);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'result' | 'done'>('ready');
  const [round, setRound] = useState(0);
  const [pos, setPos] = useState(50);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [zoneCenter, setZoneCenter] = useState(50);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);

  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const posRef = useRef(50);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const end = useCallback(() => {
    setPhase('done');
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(finishMinigame('toss', scoreRef.current));
    }
  }, [finishMinigame]);

  const start = useCallback(() => {
    finishedRef.current = false;
    scoreRef.current = 0;
    setScore(0);
    setRound(0);
    setZoneCenter(28 + Math.random() * 44);
    setFlash(null);
    setReward(null);
    setPhase('playing');
  }, []);

  // 指针摆动（三角函数往返）
  useEffect(() => {
    if (phase !== 'playing') return;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = (now - startTime) / 1000;
      const speed = ROUND_CFG[Math.min(round, ROUNDS - 1)].speed;
      posRef.current = 50 + 46 * Math.sin(t * speed);
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, round]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const toss = useCallback(() => {
    if (phase !== 'playing' || flash) return;
    const { half } = ROUND_CFG[round];
    const dist = Math.abs(posRef.current - zoneCenter);
    const gained = dist <= half / 3 ? 5 : dist <= half ? 3 : 0;
    const verdict = dist <= half / 3 ? 'perfect' : dist <= half ? 'good' : 'miss';
    if (verdict !== 'miss') sfx.pop();
    scoreRef.current += gained;
    setScore(scoreRef.current);
    setFlash(verdict);
    setPhase('result');

    const delay = window.setTimeout(() => {
      setFlash(null);
      if (round + 1 >= ROUNDS) {
        end();
      } else {
        setRound(round + 1);
        setZoneCenter(28 + Math.random() * 44);
        setPhase('playing');
      }
    }, 850);
    timersRef.current.push(delay);
  }, [phase, flash, round, end, zoneCenter]);

  const { half } = ROUND_CFG[Math.min(round, ROUNDS - 1)];
  const zonePct = half * 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameToss}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🎯 {t.gameToss}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div className="relative select-none bg-gradient-to-b from-[#fff3dd] to-[#ffe3b8] px-6 pb-8 pt-10" onPointerDown={toss}>
          {/* 轮次点 */}
          <div className="mb-6 flex justify-center gap-1.5">
            {Array.from({ length: ROUNDS }).map((_, i) => (
              <span key={i} className={`h-2 w-6 rounded-full ${i < round ? 'bg-[#7bc86c]' : i === round && phase === 'playing' ? 'bg-gugu-accent' : 'bg-amber-900/15'}`} />
            ))}
          </div>

          {/* 轨道 */}
          <div className="relative h-12 rounded-full bg-[#e2cda2]/70 shadow-inner">
            <div
              className="absolute inset-y-1 rounded-full bg-[#7bc86c]/40 border-2 border-[#7bc86c]/70"
              style={{ left: `calc(${zoneCenter - half}% )`, width: `${zonePct}%` }}
            />
            <div className="absolute inset-y-1 w-[2px] bg-[#7bc86c]" style={{ left: `${zoneCenter}%` }} />
            {phase !== 'ready' && (
              <span
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl transition-none"
                style={{ left: `${pos}%` }}
              >
                🍬
              </span>
            )}
          </div>
          <div className="mt-2 text-center text-base font-extrabold text-gugu-ink">🐦 ← 咕咕在这头张着嘴</div>

          {/* 结果闪现 */}
          {flash && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className={`anim-pop rounded-2xl px-5 py-2 text-xl font-extrabold text-white shadow-xl ${
                  flash === 'perfect' ? 'bg-[#7bc86c]' : flash === 'good' ? 'bg-gugu-accent' : 'bg-[#f0716b]'
                }`}
              >
                {flash === 'perfect' ? (locale === 'zh' ? '正中嘴巴 +5！' : 'PERFECT +5!') : flash === 'good' ? (locale === 'zh' ? '投进 +3' : 'NICE +3') : locale === 'zh' ? '偏了…' : 'MISS...'}
              </span>
            </div>
          )}

          {phase === 'ready' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center">
              <span className="text-4xl">🎯</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{t.tossHint}</p>
              <button type="button" onClick={start} className="press rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60">
                {t.gameStart}
              </button>
              <button type="button" onClick={onClose} className="press text-xs font-semibold text-gugu-ink-soft">
                {t.close}
              </button>
            </div>
          )}
        </div>

        {phase === 'done' && reward && (
          <div className="flex flex-col items-center gap-3 bg-white px-6 py-5 text-center">
            <p className="text-3xl font-extrabold">{t.gameScore} {score}</p>
            <p className="text-sm font-bold text-gugu-accent">🪙 +{reward.coins}　💗 +{reward.mood}</p>
            <div className="flex gap-2">
              <button type="button" onClick={start} className="press rounded-2xl bg-gugu-accent px-6 py-2.5 text-sm font-extrabold text-white">
                {t.gameAgain}
              </button>
              <button type="button" onClick={onClose} className="press rounded-2xl border border-amber-200 bg-white px-6 py-2.5 text-sm font-bold">
                {t.close}
              </button>
            </div>
          </div>
        )}

        {phase === 'playing' && (
          <div className="bg-white px-4 pb-4 pt-1 text-center text-xs font-bold text-gugu-ink-soft">
            {locale === 'zh' ? '点击画面投出点心！' : 'Tap to toss!'}
          </div>
        )}
      </div>
    </div>
  );
}
