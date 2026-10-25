'use client';

/**
 * 消消乐（三消）：8×8 棋盘 6 种图案，20 步内交换相邻图案凑横竖三连消除。
 * 主题每局随机：水果（m3 素材）或宝石（m3b 素材 28 选 6），图片加载失败回退 emoji。
 * 连锁逐波结算：每块 30 分 × 波次倍数（第 n 波 ×n），4 连波额外 +60、5 连波 +150；
 * 无有效交换时自动洗牌（保底有解），步数用尽结算，走统一的 finishMinigame 奖励。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscClose } from '@/hooks/useEscClose';
import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import { BASE_PATH } from '@/lib/skins';
import { gameBgStyle } from '@/lib/gamebg';
import { sfx } from '@/lib/sfx';
import { usePetStore } from '@/lib/store';
import type { PetState } from '@/lib/types';

const SIZE = 8;
const KINDS = 6;
const MOVES = 20;
const TILE_SCORE = 30;
const REMOVED = -1;

interface IconTheme {
  /** 素材文件名（不含 .png），长度 = KINDS */
  files: readonly string[];
  /** 图片加载失败时的 emoji 兜底 */
  emoji: readonly string[];
  /** 结算面板/标题用的主题 emoji */
  icon: string;
}

const FRUIT_THEME: IconTheme = {
  files: ['m3-strawberry', 'm3-banana', 'm3-grape2', 'm3-orange2', 'm3-blueberry', 'm3-watermelon2'],
  emoji: ['🍓', '🍌', '🍇', '🍊', '🫐', '🍉'],
  icon: '🍊',
};

/** 28 种宝石（game/m3b-<id>.png），每局随机抽 6 种 */
const GEMS: readonly (readonly [string, string])[] = [
  ['ruby', '💎'], ['emerald', '💚'], ['sapphire', '🔷'], ['amethyst', '🟣'],
  ['topaz', '🟡'], ['opal', '⚪'], ['garnet', '🟥'], ['peridot', '🟩'],
  ['aquamarine', '🩵'], ['citrine', '🍋'], ['tourmaline', '🌈'], ['moonstone', '🌙'],
  ['onyx', '⚫'], ['jade', '🟢'], ['lapis', '🔵'], ['turquoise', '🩵'],
  ['spinel', '🌺'], ['zircon', '✨'], ['tanzanite', '🟪'], ['morganite', '🌸'],
  ['alexandrite', '🦋'], ['labradorite', '🪩'], ['rose-quartz', '🌷'], ['obsidian', '⬛'],
  ['amber', '🟠'], ['smoky-quartz', '🟤'], ['sunstone', '🔆'], ['fluorite', '🔮'],
];

function pickTheme(): IconTheme {
  // 一半概率水果、一半概率宝石，让老素材与新素材都有出场
  if (Math.random() < 0.5) return FRUIT_THEME;
  const pool = GEMS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, KINDS);
  return {
    files: picked.map(([id]) => `m3b-${id}`),
    emoji: picked.map(([, e]) => e),
    icon: '💎',
  };
}

/** 棋盘：长度 64 的数组，值 = 图案下标，-1 = 消除后的空格 */
type Board = number[];

const at = (r: number, c: number) => r * SIZE + c;

function randKind(): number {
  return Math.floor(Math.random() * KINDS);
}

function shuffled<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 开局棋盘：逐格随机生成，检查左 2 / 上 2 避免现成三连 */
function freshBoard(): Board {
  const board: Board = new Array<number>(SIZE * SIZE).fill(0);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      let k = randKind();
      while (
        (c >= 2 && board[at(r, c - 1)] === k && board[at(r, c - 2)] === k) ||
        (r >= 2 && board[at(r - 1, c)] === k && board[at(r - 2, c)] === k)
      ) {
        k = randKind();
      }
      board[at(r, c)] = k;
    }
  }
  return board;
}

/** 全部三连（横竖 ≥3 同种）：返回待消格集合与本波最大连长 */
function findMatches(board: readonly number[]): { cells: Set<number>; maxRun: number } {
  const cells = new Set<number>();
  let maxRun = 1;
  for (let r = 0; r < SIZE; r++) {
    let c = 0;
    while (c < SIZE) {
      const k = board[at(r, c)];
      let len = 1;
      while (c + len < SIZE && board[at(r, c + len)] === k) len++;
      if (len >= 3) {
        for (let x = 0; x < len; x++) cells.add(at(r, c + x));
        maxRun = Math.max(maxRun, len);
      }
      c += len;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let r = 0;
    while (r < SIZE) {
      const k = board[at(r, c)];
      let len = 1;
      while (r + len < SIZE && board[at(r + len, c)] === k) len++;
      if (len >= 3) {
        for (let y = 0; y < len; y++) cells.add(at(r + y, c));
        maxRun = Math.max(maxRun, len);
      }
      r += len;
    }
  }
  return { cells, maxRun };
}

function hasMatch(board: readonly number[]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c + 2 < SIZE; c++) {
      const k = board[at(r, c)];
      if (k === board[at(r, c + 1)] && k === board[at(r, c + 2)]) return true;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r + 2 < SIZE; r++) {
      const k = board[at(r, c)];
      if (k === board[at(r + 1, c)] && k === board[at(r + 2, c)]) return true;
    }
  }
  return false;
}

/** 是否还有效交换：全枚举相邻交换并模拟检测 */
function anyValidMove(board: readonly number[]): boolean {
  const test = board.slice();
  const trySwap = (a: number, b: number) => {
    [test[a], test[b]] = [test[b], test[a]];
    const ok = hasMatch(test);
    [test[a], test[b]] = [test[b], test[a]];
    return ok;
  };
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && trySwap(at(r, c), at(r, c + 1))) return true;
      if (r + 1 < SIZE && trySwap(at(r, c), at(r + 1, c))) return true;
    }
  }
  return false;
}

/** 开局：生成无现成三连且保底有解的棋盘 */
function ensureSolvableBoard(): Board {
  for (let attempt = 0; attempt < 100; attempt++) {
    const board = freshBoard();
    if (anyValidMove(board)) return board;
  }
  return freshBoard();
}

/** 消除后下落补新：列内重力下沉，顶部随机补齐（允许补出新三连引发连锁） */
function collapse(board: readonly number[]): Board {
  const next = board.slice();
  for (let c = 0; c < SIZE; c++) {
    let write = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      const k = next[at(r, c)];
      if (k === REMOVED) continue;
      next[at(r, c)] = REMOVED;
      next[at(write, c)] = k;
      write--;
    }
    for (let r = write; r >= 0; r--) next[at(r, c)] = randKind();
  }
  return next;
}

/** 死局洗牌：重排现有水果，保底无现成三连且有解 */
function reshuffleBoard(board: readonly number[]): Board {
  for (let attempt = 0; attempt < 200; attempt++) {
    const trial = shuffled(board);
    if (!hasMatch(trial) && anyValidMove(trial)) return trial;
  }
  return ensureSolvableBoard();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Match3Game({ onClose }: { pet: PetState; onClose: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [theme, setTheme] = useState<IconTheme>(pickTheme);
  const [board, setBoard] = useState<Board>(ensureSolvableBoard);
  const [clearing, setClearing] = useState<Set<number>>(() => new Set());
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [movesLeft, setMovesLeft] = useState(MOVES);
  const [combo, setCombo] = useState(0);
  const [reshuffled, setReshuffled] = useState(false);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());

  const scoreRef = useRef(0);
  const movesRef = useRef(MOVES);
  const finishedRef = useRef(false);
  const busyRef = useRef(false);
  /** 会话令牌：开局/卸载时自增，中止仍在飞行中的连锁结算 */
  const sessionRef = useRef(0);

  const end = useCallback(() => {
    setPhase('done');
    setSel(null);
    setCombo(0);
    if (!finishedRef.current) {
      finishedRef.current = true;
      setReward(usePetStore.getState().finishMinigame('match3', scoreRef.current));
    }
  }, []);

  const start = useCallback(() => {
    sessionRef.current += 1;
    finishedRef.current = false;
    busyRef.current = false;
    scoreRef.current = 0;
    movesRef.current = MOVES;
    setTheme(pickTheme());
    setBoard(ensureSolvableBoard());
    setClearing(new Set());
    setSel(null);
    setScore(0);
    setMovesLeft(MOVES);
    setCombo(0);
    setReshuffled(false);
    setReward(null);
    setFailed(new Set());
    setPhase('playing');
  }, []);

  // 卸载（关闭弹窗）时中止进行中的连锁结算
  useEffect(() => () => {
    sessionRef.current += 1;
  }, []);

  /** 连锁逐波结算：每块 30 分 × 波次；4 连波 +60、5 连波 +150（按该波最大连长） */
  const resolveCascades = useCallback(async (start: Board, token: number): Promise<Board> => {
    let cur = start;
    let wave = 1;
    for (;;) {
      const { cells, maxRun } = findMatches(cur);
      if (cells.size === 0) break;
      const bonus = maxRun >= 5 ? 150 : maxRun === 4 ? 60 : 0;
      scoreRef.current += cells.size * TILE_SCORE * wave + bonus;
      setScore(scoreRef.current);
      setCombo(wave);
      setClearing(cells);
      sfx.pop();
      await sleep(200); // 消除动画
      if (sessionRef.current !== token) return cur;
      cur = collapse(cur.map((k, i) => (cells.has(i) ? REMOVED : k)));
      setBoard(cur);
      setClearing(new Set());
      await sleep(160); // 下落/补新过渡
      if (sessionRef.current !== token) return cur;
      wave++;
    }
    setCombo(0);
    return cur;
  }, []);

  const markFailed = (kind: number) => {
    setFailed((prev) => {
      if (prev.has(kind)) return prev;
      const next = new Set(prev);
      next.add(kind);
      return next;
    });
  };

  const tap = async (i: number) => {
    if (phase !== 'playing' || busyRef.current) return;
    if (sel === null) {
      setSel(i);
      return;
    }
    if (sel === i) {
      setSel(null); // 再点一次取消选中
      return;
    }
    const a = sel;
    const sameRow = Math.floor(a / SIZE) === Math.floor(i / SIZE);
    if (!((sameRow && Math.abs(a - i) === 1) || Math.abs(a - i) === SIZE)) {
      setSel(i); // 点了不相邻的格子：改为选中它
      return;
    }
    // 相邻交换
    const token = sessionRef.current;
    busyRef.current = true;
    setSel(null);
    const next = board.slice();
    [next[a], next[i]] = [next[i], next[a]];
    setBoard(next);
    if (!hasMatch(next)) {
      // 交换后无三连：短暂展示后换回，不计步数
      await sleep(180);
      if (sessionRef.current === token) setBoard(board);
      busyRef.current = false;
      return;
    }
    // 有效交换：计一步并结算连锁
    movesRef.current -= 1;
    setMovesLeft(movesRef.current);
    const settled = await resolveCascades(next, token);
    busyRef.current = false;
    if (sessionRef.current !== token) return;
    if (movesRef.current <= 0) {
      window.setTimeout(() => {
        if (sessionRef.current === token) end();
      }, 250);
      return;
    }
    if (!anyValidMove(settled)) {
      // 死局：自动洗牌（保底有解）并提示
      setBoard(reshuffleBoard(settled));
      setReshuffled(true);
      window.setTimeout(() => {
        if (sessionRef.current === token) setReshuffled(false);
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameM3}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">{theme.icon} {t.gameM3}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div className="relative p-3" style={gameBgStyle('rgba(255,243,221,0.82)')}>
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-extrabold text-gugu-ink-soft">
              {locale === 'zh' ? '步数' : 'Moves'} {movesLeft}
            </span>
            {combo >= 2 && (
              <span className="animate-pulse rounded-full bg-gugu-accent px-2.5 py-0.5 text-xs font-extrabold text-white shadow-sm">
                {fmt(locale === 'zh' ? '连锁 ×{n}' : 'Combo ×{n}', { n: combo })}
              </span>
            )}
          </div>

          <div className="grid select-none grid-cols-8 gap-1">
            {board.map((kind, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void tap(i)}
                className={`flex aspect-square items-center justify-center rounded-xl border border-amber-200/60 bg-[#f6e2bb] transition-all duration-200 ${
                  clearing.has(i)
                    ? 'scale-0 opacity-0'
                    : sel === i
                      ? 'ring-2 ring-gugu-accent'
                      : 'hover:brightness-105 active:scale-95'
                }`}
              >
                {failed.has(kind) ? (
                  <span className="text-2xl leading-none">{theme.emoji[kind]}</span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${BASE_PATH}/skins/gugu/game/${theme.files[kind]}.png`}
                    alt=""
                    draggable={false}
                    onError={() => markFailed(kind)}
                    className="h-[82%] w-[82%] object-contain"
                  />
                )}
              </button>
            ))}
          </div>

          {reshuffled && phase === 'playing' && (
            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-gugu-ink/85 px-4 py-2 text-sm font-extrabold text-white shadow-lg">
              🔀 {locale === 'zh' ? '重新洗牌！' : 'Reshuffled!'}
            </div>
          )}

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center backdrop-blur">
              <span className="text-4xl">{phase === 'ready' ? theme.icon : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.m3Hint : ''}</p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-3xl font-extrabold">{t.gameScore} {score}</p>
                  {reward.newBest && (
                    <p className="text-sm font-extrabold text-gugu-accent">
                      {locale === 'zh' ? '🏆 新纪录！' : '🏆 New record!'}
                    </p>
                  )}
                  <p className="text-sm font-bold text-gugu-accent">{fmt(t.gameReward, { c: reward.coins, m: reward.mood })}</p>
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
