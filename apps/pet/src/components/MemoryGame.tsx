'use client';

import { useEscClose } from '@/hooks/useEscClose';

/**
 * 点心对对碰（记忆翻牌）：12 张牌 6 对，45 秒内配对。
 * 得分 = 对数 × 3 + 剩余时间奖励，走统一的 minigameReward 结算。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

const DURATION = 45_000;
const KINDS = ['🍪', '🍰', '🍩', '🍭', '🧁', '🍫'];

interface Card {
  id: number;
  kind: string;
  flipped: boolean;
  matched: boolean;
}

function shuffledDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const kind of KINDS) {
    deck.push({ id: ++id, kind, flipped: false, matched: false });
    deck.push({ id: ++id, kind, flipped: false, matched: false });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const finishMinigame = usePetStore((s) => s.finishMinigame);
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [cards, setCards] = useState<Card[]>(shuffledDeck);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);

  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const firstRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const end = useCallback(() => {
    setPhase('done');
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(finishMinigame('memory', scoreRef.current));
    }
  }, [finishMinigame]);

  const start = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    finishedRef.current = false;
    firstRef.current = null;
    lockRef.current = false;
    setCards(shuffledDeck());
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(DURATION);
    setReward(null);
    setPhase('playing');
  }, []);

  // 计时
  useEffect(() => {
    if (phase !== 'playing') return;
    const startTime = performance.now();
    const tick = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= DURATION) {
        setTimeLeft(0);
        end();
        return;
      }
      setTimeLeft(DURATION - elapsed);
    }, 200);
    return () => clearInterval(tick);
  }, [phase, end]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const flip = (idx: number) => {
    if (phase !== 'playing' || lockRef.current) return;
    const card = cards[idx];
    if (card.flipped || card.matched) return;

    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);

    const firstIdx = firstRef.current;
    if (firstIdx === null) {
      firstRef.current = idx;
      return;
    }

    // 第二张
    firstRef.current = null;
    const a = next[firstIdx];
    const b = next[idx];
    if (a.kind === b.kind) {
      const matched = next.map((c, i) =>
        i === firstIdx || i === idx ? { ...c, matched: true, flipped: true } : c
      );
      setCards(matched);
      scoreRef.current += 3;
      setScore(scoreRef.current);
      if (matched.every((c) => c.matched)) {
        const timeBonus = Math.floor((timeLeft / 1000 / 5)) * 2;
        scoreRef.current += timeBonus;
        setScore(scoreRef.current);
        window.setTimeout(end, 400);
      }
      return;
    }
    // 不匹配：750ms 后翻回
    lockRef.current = true;
    const timer = window.setTimeout(() => {
      setCards((cur) =>
        cur.map((c, i) => (i === firstIdx || i === idx ? { ...c, flipped: false } : c))
      );
      lockRef.current = false;
    }, 750);
    timersRef.current.push(timer);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameMemory}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🃏 {t.gameMemory}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div className="relative bg-gradient-to-b from-[#fff3dd] to-[#ffe3b8] p-4">
          {phase === 'playing' && (
            <div className="absolute left-0 top-0 h-1.5 w-full bg-amber-900/15">
              <div className="h-full bg-gugu-accent" style={{ width: `${(timeLeft / DURATION) * 100}%` }} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-2.5 pt-2">
            {cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => flip(i)}
                className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-3xl transition-all duration-150 ${
                  c.matched
                    ? 'border-[#7bc86c]/60 bg-[#e7f6e4] opacity-90'
                    : c.flipped
                      ? 'border-amber-300 bg-white'
                      : 'border-amber-200 bg-[#f3dcae] hover:brightness-105 active:scale-95'
                }`}
              >
                {c.flipped || c.matched ? c.kind : '❓'}
              </button>
            ))}
          </div>

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center">
              <span className="text-4xl">{phase === 'ready' ? '🃏' : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.memoryHint : ''}</p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-3xl font-extrabold">{t.gameScore} {score}</p>
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
