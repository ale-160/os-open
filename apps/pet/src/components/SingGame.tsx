'use client';

/**
 * 跟我唱（Simon 序列记忆）：咕咕按音符顺序唱歌，玩家跟唱。
 * 每轮序列 +1 音符，得分 = 完成轮次的音符数 × 2；点错即结束。60 秒上限。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

const DURATION = 60_000;
const PADS = [
  { color: '#ffb56b', freq: 523.25, label: '_do' },
  { color: '#7fd8d0', freq: 659.25, label: '_re' },
  { color: '#c3a6ff', freq: 783.99, label: '_mi' },
  { color: '#f79892', freq: 1046.5, label: '_sol' },
];
const SHOW_MS = 520;

export function SingGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const finishMinigame = usePetStore((s) => s.finishMinigame);
  const { locale } = useLocale();
  const t = ui(locale);

  const [phase, setPhase] = useState<'ready' | 'showing' | 'input' | 'done'>('ready');
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);

  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const [inputCount, setInputCount] = useState(0);

  const end = useCallback(() => {
    setPhase('done');
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(finishMinigame('sing', scoreRef.current));
    }
  }, [finishMinigame]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const playSeq = useCallback((sequence: number[]) => {
    setPhase('showing');
    setLit(null);
    sequence.forEach((pad, i) => {
      const at = window.setTimeout(() => {
        setLit(pad);
        sfx.note(PADS[pad].freq, 0.3);
        const off = window.setTimeout(() => setLit(null), SHOW_MS * 0.6);
        timersRef.current.push(off);
      }, i * SHOW_MS);
      timersRef.current.push(at);
    });
    const doneAt = window.setTimeout(() => {
      setPhase('input');
    }, sequence.length * SHOW_MS + 250);
    timersRef.current.push(doneAt);
  }, []);

  const start = useCallback(() => {
    clearTimers();
    finishedRef.current = false;
    scoreRef.current = 0;
    setScore(0);
    setRound(0);
    setTimeLeft(DURATION);
    setReward(null);
    setPhase('showing');
    const first = [Math.floor(Math.random() * PADS.length)];
    setSeq(first);
    playSeq(first);
  }, [clearTimers, playSeq]);

  // 计时
  useEffect(() => {
    if (phase !== 'showing' && phase !== 'input') return;
    const startTime = performance.now() - (DURATION - timeLeft);
    const tick = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= DURATION) {
        clearTimers();
        setTimeLeft(0);
        end();
        return;
      }
      setTimeLeft(DURATION - elapsed);
    }, 200);
    return () => clearInterval(tick);
  }, [phase, timeLeft, end, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const tapPadCheck = (pad: number) => {
    if (phase !== 'input') return;
    setLit(pad);
    sfx.note(PADS[pad].freq, 0.28);
    const off = window.setTimeout(() => setLit(null), 180);
    timersRef.current.push(off);

    if (seq[inputCount] === pad) {
      const nextCount = inputCount + 1;
      if (nextCount >= seq.length) {
        // 本轮完成
        scoreRef.current += seq.length * 2;
        setScore(scoreRef.current);
        setRound((r) => r + 1);
        setInputCount(0);
        const timer = window.setTimeout(() => {
          const grown = [...seq, Math.floor(Math.random() * PADS.length)];
          setSeq(grown);
          playSeq(grown);
        }, 650);
        timersRef.current.push(timer);
      } else {
        setInputCount(nextCount);
      }
    } else {
      clearTimers();
      end();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameSing}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🎵 {t.gameSing}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div className="relative bg-gradient-to-b from-[#f3ecff] to-[#e6dcff] px-5 pb-6 pt-6">
          <div className="mb-5 text-center text-sm font-bold text-gugu-ink">
            {phase === 'showing' ? `🐦 ${t.singListen}` : phase === 'input' ? `${t.singYourTurn}（${inputCount}/${seq.length}）` : ''}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {PADS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => tapPadCheck(i)}
                disabled={phase !== 'input'}
                aria-label={`note-${i}`}
                className={`press flex aspect-square items-center justify-center rounded-3xl text-3xl font-black text-white shadow-lg transition-all ${
                  lit === i ? 'scale-95 brightness-125' : 'brightness-100'
                } ${phase === 'input' ? 'hover:brightness-110' : ''}`}
                style={{ backgroundColor: p.color, opacity: phase === 'input' || lit === i ? 1 : 0.75 }}
              >
                {lit === i ? '♪' : ''}
              </button>
            ))}
          </div>
          <div className="mt-4 text-center text-xs font-bold text-gugu-ink-soft">
            {locale === 'zh' ? `第 ${round + 1} 轮 · ${seq.length} 个音符` : `Round ${round + 1} · ${seq.length} notes`}
          </div>

          {phase !== 'showing' && phase !== 'input' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center">
              <span className="text-4xl">{phase === 'ready' ? '🎵' : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.singHint : ''}</p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-3xl font-extrabold">{t.gameScore} {score}</p>
                  {reward.newBest && (
                    <p className="anim-pop rounded-full bg-gugu-accent px-4 py-1 text-sm font-extrabold text-white shadow">{t.newRecord}</p>
                  )}
                  <p className="text-sm font-bold text-gugu-accent">🪙 +{reward.coins}　💗 +{reward.mood}</p>
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
