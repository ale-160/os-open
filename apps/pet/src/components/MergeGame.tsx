'use client';

/**
 * 幻咕合成：点击合并进化。
 * 5×5 棋盘、8 个系族各 3 阶；点选一块后点相邻同系同阶块合成下一阶，
 * 三阶现身即额外 +50 并消散；棋盘满且无相邻可合并对时结算。
 */

import { useCallback, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useEscClose } from '@/hooks/useEscClose';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { BASE_PATH } from '@/lib/skins';
import { sfx } from '@/lib/sfx';
import type { PetState } from '@/lib/types';

const SIZE = 5;
const FAMILIES = ['star', 'cloud', 'flame', 'leaf', 'wave', 'moon', 'sun', 'crystal'] as const;

type Family = (typeof FAMILIES)[number];

/** 阶 1/2/3 的 emoji 兜底（图片加载失败时显示） */
const EMOJI: Record<Family, readonly string[]> = {
  star: ['⭐', '🌟', '✨'],
  cloud: ['☁️', '🌥️', '⛈️'],
  flame: ['🕯️', '💥', '🔥'],
  leaf: ['🌱', '🌿', '🌳'],
  wave: ['💧', '🌊', '💦'],
  moon: ['🌙', '🌜', '🌕'],
  sun: ['🌤️', '☀️', '🌞'],
  crystal: ['💠', '💎', '🔮'],
};

interface Cell {
  family: Family;
  tier: 1 | 2 | 3;
}

type Board = (Cell | null)[];

/** 在随机空格生成一个一阶幻咕 */
function spawnTier1(board: Board): void {
  const empties: number[] = [];
  board.forEach((cell, i) => {
    if (!cell) empties.push(i);
  });
  if (empties.length === 0) return;
  board[empties[Math.floor(Math.random() * empties.length)]] = {
    family: FAMILIES[Math.floor(Math.random() * FAMILIES.length)],
    tier: 1,
  };
}

function initialBoard(): Board {
  const board: Board = Array.from({ length: SIZE * SIZE }, () => null);
  for (let n = 0; n < 4; n++) spawnTier1(board);
  return board;
}

/** 上下左右相邻 */
function isAdjacent(a: number, b: number): boolean {
  return (
    Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs((a % SIZE) - (b % SIZE)) === 1
  );
}

/** 棋盘满且无任何相邻同系同阶对 → 无路可走 */
function isStuck(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cur = board[r * SIZE + c];
      if (!cur) return false;
      const right = c + 1 < SIZE ? board[r * SIZE + c + 1] : null;
      const down = r + 1 < SIZE ? board[(r + 1) * SIZE + c] : null;
      if (right && right.family === cur.family && right.tier === cur.tier) return false;
      if (down && down.family === cur.family && down.tier === cur.tier) return false;
    }
  }
  return true;
}

export function MergeGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [board, setBoard] = useState<Board>(initialBoard);
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [ultimates, setUltimates] = useState(0);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set<string>());

  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const mergeCountRef = useRef(0);

  const markFailed = useCallback((key: string) => {
    setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const end = useCallback(() => {
    setPhase('done');
    setSel(null);
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(usePetStore.getState().finishMinigame('merge', scoreRef.current));
    }
  }, []);

  const start = useCallback(() => {
    finishedRef.current = false;
    mergeCountRef.current = 0;
    scoreRef.current = 0;
    setBoard(initialBoard());
    setSel(null);
    setScore(0);
    setUltimates(0);
    setReward(null);
    setPhase('playing');
  }, []);

  const tap = (idx: number) => {
    if (phase !== 'playing') return;
    const cell = board[idx];

    if (sel === null) {
      if (cell) setSel(idx);
      return;
    }
    if (sel === idx) {
      setSel(null);
      return;
    }

    const first = board[sel];
    if (
      !cell ||
      !first ||
      !isAdjacent(sel, idx) ||
      cell.family !== first.family ||
      cell.tier !== first.tier ||
      cell.tier === 3
    ) {
      setSel(cell ? idx : null); // 不满足条件：切换选中（点空格则取消）
      return;
    }

    // 相邻同系同阶 → 合成下一阶，落在第二块位置
    const next = board.slice();
    const tier = cell.tier === 1 ? 2 : 3;
    let gained = cell.tier === 1 ? 20 : 60;
    next[sel] = null;
    if (tier === 3) {
      gained += 50; // 终极形态现身即消散
      next[idx] = null;
      setUltimates((n) => n + 1);
    } else {
      next[idx] = { family: cell.family, tier };
    }

    mergeCountRef.current += 1;
    if (mergeCountRef.current % 2 === 0) spawnTier1(next); // 每 2 次成功合并补 1 个一阶
    sfx.pop();

    scoreRef.current += gained;
    setScore(scoreRef.current);
    setBoard(next);
    setSel(null);
    if (isStuck(next)) end();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
      role="dialog"
      aria-label={t.gameMerge}
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🌀 {t.gameMerge}</h2>
          <button
            type="button"
            onClick={onClose}
            className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold"
          >
            ✕
          </button>
        </div>

        <div className="relative bg-gradient-to-b from-[#f3ecff] to-[#e6dcff] p-3">
          <div className="mb-2 flex items-center justify-between pt-1">
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-extrabold text-gugu-ink-soft">
              {t.gameScore} {score}
            </span>
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-extrabold text-gugu-ink-soft">
              {fmt(locale === 'zh' ? '终极形态 ×{n}' : 'Ultimate ×{n}', { n: ultimates })}
            </span>
          </div>

          <div className="grid select-none grid-cols-5 gap-1.5">
            {board.map((cell, i) =>
              !cell ? (
                <div key={i} className="aspect-square rounded-xl bg-amber-900/5" />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(i)}
                  className={`flex aspect-square items-center justify-center rounded-xl border transition-all duration-150 ${
                    sel === i
                      ? 'border-amber-400 bg-white ring-2 ring-gugu-accent'
                      : 'border-[#d9c9ff]/70 bg-[#f6f0ff] hover:brightness-105 active:scale-95'
                  }`}
                >
                  {failed.has(`${cell.family}-${cell.tier}`) ? (
                    <span className="text-2xl leading-none">{EMOJI[cell.family][cell.tier - 1]}</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${BASE_PATH}/skins/gugu/game/merge-${cell.family}-${cell.tier}.png`}
                      alt=""
                      draggable={false}
                      onError={() => markFailed(`${cell.family}-${cell.tier}`)}
                      className="h-[82%] w-[82%] object-contain"
                    />
                  )}
                </button>
              )
            )}
          </div>

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center">
              <span className="text-4xl">{phase === 'ready' ? '🌀' : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">
                {phase === 'ready' ? t.mergeHint : ''}
              </p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-3xl font-extrabold">
                    {t.gameScore} {score}
                  </p>
                  {reward.newBest && (
                    <p className="text-sm font-extrabold text-gugu-accent">
                      {locale === 'zh' ? '🏆 新纪录！' : '🏆 New record!'}
                    </p>
                  )}
                  <p className="text-sm font-bold text-gugu-accent">
                    🪙 +{reward.coins}　💗 +{reward.mood}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={start}
                className="press rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60"
              >
                {phase === 'ready' ? t.gameStart : t.gameAgain}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="press text-xs font-semibold text-gugu-ink-soft"
              >
                {t.close}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
