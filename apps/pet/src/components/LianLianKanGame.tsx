'use client';

/**
 * 连连看：8×6 棋盘 24 对图案，点选两张相同图案，
 * 能用 ≤2 个拐点的空路径连通即可消除；180 秒内清空获胜。
 * 主题每局随机：甜点（llk 素材）或森林（llk2 素材 48 选 24），图片加载失败回退 emoji。
 * 得分 = 消除对数 ×1 + 剩余秒数 ÷10 的时间奖励，走统一的 minigameReward 结算。
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

const ROWS = 6;
const COLS = 8;
const DURATION = 180_000;
/** 棋盘 48 格 = 24 对 */
const PAIRS = (ROWS * COLS) / 2;

interface IconTheme {
  /** 素材文件名（不含 .png），长度 = PAIRS */
  files: readonly string[];
  emoji: readonly string[];
  icon: string;
}

const BAKERY_THEME: IconTheme = {
  files: [
    'llk-taiyaki', 'llk-dango', 'llk-tart', 'llk-macaron', 'llk-pudding2', 'llk-croissant', 'llk-pretzel', 'llk-waffle',
    'llk-candy-apple', 'llk-mochi', 'llk-senbei', 'llk-melonbread', 'llk-crepe', 'llk-parfait', 'llk-shortcake', 'llk-eclair',
    'llk-madeleine', 'llk-biscuit', 'llk-jam-toast', 'llk-cinnamon-roll', 'llk-strawberry-pocky', 'llk-chocolate-cornet',
    'llk-lemon-tart', 'llk-cream puff',
  ],
  emoji: [
    '🐟', '🍡', '🥧', '🍬', '🍮', '🥐', '🥨', '🧇',
    '🍎', '🍚', '🍘', '🍞', '🌯', '🍨', '🍰', '🍫',
    '🍪', '🍪', '🍞', '🌀', '🍫', '🥐', '🍋', '🥯',
  ],
  icon: '🍡',
};

/** 48 种森林图案（game/llk2-<id>.png）：蘑菇/松果/坚果/叶子/浆果/野花/林地 */
const FOREST_ITEMS: readonly string[] = [
  'mushroom-fly', 'mushroom-puffball', 'mushroom-coral', 'mushroom-porcini',
  'mushroom-blue', 'mushroom-amber', 'mushroom-chanterelle', 'mushroom-purple',
  'cone-spruce', 'cone-larch', 'cone-pine', 'cone-sweetgum',
  'nut-acorn', 'nut-walnut', 'nut-hazelnut', 'nut-chestnut',
  'leaf-ginkgo', 'leaf-ivy', 'leaf-maple', 'leaf-birch',
  'leaf-fern', 'leaf-oak', 'leaf-aspen', 'leaf-willow',
  'berry-strawberry', 'berry-blueberry', 'berry-lingonberry', 'berry-blackberry',
  'berry-rosehip', 'berry-elderberry', 'berry-currant', 'berry-rowan',
  'flower-violet', 'flower-thistle', 'flower-snowdrop', 'flower-lily-valley',
  'flower-clover', 'flower-daisy', 'flower-dandelion', 'flower-poppy',
  'forest-log', 'forest-amber', 'forest-moss-rock', 'forest-nest',
  'forest-snail-shell', 'forest-stump', 'forest-feather', 'forest-wood-slice',
];

/** 按前缀给森林图案配 emoji 兜底 */
function forestEmoji(id: string): string {
  if (id.startsWith('mushroom')) return '🍄';
  if (id.startsWith('cone')) return '🌲';
  if (id.startsWith('nut')) return '🌰';
  if (id.startsWith('leaf')) return '🍃';
  if (id.startsWith('berry')) return '🍓';
  if (id.startsWith('flower')) return '🌸';
  return '🪵';
}

function pickTheme(): IconTheme {
  if (Math.random() < 0.5) return BAKERY_THEME;
  const pool = FOREST_ITEMS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, PAIRS);
  return {
    files: picked.map((id) => `llk2-${id}`),
    emoji: picked.map(forestEmoji),
    icon: '🌲',
  };
}

/** 棋盘：长度 48 的数组，值 = 图案下标，null = 已消除空格 */
type Board = (number | null)[];

function shuffled<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 棋盘下标 → 扩展棋盘坐标（四周留一圈空边界） */
function ext(i: number): [number, number] {
  return [Math.floor(i / COLS) + 1, (i % COLS) + 1];
}

function buildGrid(board: readonly (number | null)[]): number[][] {
  const grid = Array.from({ length: ROWS + 2 }, () => new Array<number>(COLS + 2).fill(0));
  board.forEach((kind, i) => {
    if (kind !== null) grid[Math.floor(i / COLS) + 1][(i % COLS) + 1] = 1;
  });
  return grid;
}

/** 拐点限制 BFS：从 (r1,c1) 出发沿水平/垂直走空格（可穿过边界圈与已消除格），
 *  每换一次方向拐点 +1，≤2 且最终踩到目标格即视为可连。 */
function canLink(grid: number[][], r1: number, c1: number, r2: number, c2: number): boolean {
  const H = ROWS + 2;
  const W = COLS + 2;
  const DIRS: ReadonlyArray<readonly [number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  // best[r][c][d] = 到达 (r,c) 且朝向 d 的最小拐点数
  const best: number[][][] = Array.from({ length: H }, () =>
    Array.from({ length: W }, () => [Infinity, Infinity, Infinity, Infinity])
  );
  const queue: Array<[number, number, number, number]> = [];
  for (let d = 0; d < 4; d++) {
    const nr = r1 + DIRS[d][0];
    const nc = c1 + DIRS[d][1];
    if (nr === r2 && nc === c2) return true; // 相邻直达
    if (nr < 0 || nr >= H || nc < 0 || nc >= W || grid[nr][nc] !== 0) continue;
    best[nr][nc][d] = 0;
    queue.push([nr, nc, d, 0]);
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const [r, c, dir, turns] = queue[qi];
    for (let d = 0; d < 4; d++) {
      const t = turns + (d === dir ? 0 : 1);
      if (t > 2) continue;
      const nr = r + DIRS[d][0];
      const nc = c + DIRS[d][1];
      if (nr === r2 && nc === c2) return true;
      if (nr < 0 || nr >= H || nc < 0 || nc >= W || grid[nr][nc] !== 0) continue;
      if (t >= best[nr][nc][d]) continue;
      best[nr][nc][d] = t;
      queue.push([nr, nc, d, t]);
    }
  }
  return false;
}

/** 棋盘上是否还存在任意一对可连通的相同图案 */
function hasLink(board: readonly (number | null)[]): boolean {
  const grid = buildGrid(board);
  const byKind = new Map<number, number[]>();
  board.forEach((kind, i) => {
    if (kind === null) return;
    const list = byKind.get(kind);
    if (list) list.push(i);
    else byKind.set(kind, [i]);
  });
  for (const list of byKind.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const [r1, c1] = ext(list[x]);
        const [r2, c2] = ext(list[y]);
        if (canLink(grid, r1, c1, r2, c2)) return true;
      }
    }
  }
  return false;
}

/** 开局棋盘：24 对图案随机洗牌，并保证至少有一对可连（兜底时强制一对相邻） */
function freshBoard(kindCount: number): Board {
  const kinds: number[] = [];
  for (let k = 0; k < kindCount; k++) kinds.push(k, k);
  for (let attempt = 0; attempt < 300; attempt++) {
    const arr = shuffled(kinds);
    if (hasLink(arr)) return arr;
  }
  const arr = shuffled(kinds);
  const other = arr.indexOf(arr[0], 1);
  if (other !== 1) {
    const tmp = arr[1];
    arr[1] = arr[other];
    arr[other] = tmp;
  }
  return arr;
}

export function LianLianKanGame({ onClose }: { pet: PetState; onClose: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [theme, setTheme] = useState<IconTheme>(pickTheme);
  const [board, setBoard] = useState<Board>(() =>
    Array.from({ length: ROWS * COLS }, (_, i) => Math.floor(i / 2) % PAIRS)
  );
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [score, setScore] = useState(0);
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [shuffleUsed, setShuffleUsed] = useState(false);
  const [failed, setFailed] = useState<Set<number>>(() => new Set());

  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const deadlineRef = useRef(0);
  const endTimerRef = useRef<number | null>(null);

  const end = useCallback(() => {
    setPhase('done');
    setSel(null);
    if (!finishedRef.current) {
      finishedRef.current = true;
      const result = usePetStore.getState().finishMinigame('lianliankan', scoreRef.current);
      setReward(result);
    }
  }, []);

  const start = useCallback(() => {
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    finishedRef.current = false;
    scoreRef.current = 0;
    deadlineRef.current = performance.now() + DURATION;
    const nextTheme = pickTheme();
    setTheme(nextTheme);
    setBoard(freshBoard(nextTheme.files.length));
    setScore(0);
    setTimeLeft(DURATION);
    setReward(null);
    setSel(null);
    setShuffleUsed(false);
    setFailed(new Set());
    setPhase('playing');
  }, []);

  // 计时
  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = window.setInterval(() => {
      const left = deadlineRef.current - performance.now();
      if (left <= 0) {
        setTimeLeft(0);
        end();
        return;
      }
      setTimeLeft(left);
    }, 250);
    return () => window.clearInterval(tick);
  }, [phase, end]);

  useEffect(
    () => () => {
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    },
    []
  );

  const markFailed = (kind: number) => {
    setFailed((prev) => {
      if (prev.has(kind)) return prev;
      const next = new Set(prev);
      next.add(kind);
      return next;
    });
  };

  const tap = (i: number) => {
    if (phase !== 'playing' || board[i] === null) return;
    if (sel === null) {
      setSel(i);
      return;
    }
    if (sel === i) {
      setSel(null); // 再点一次取消选中
      return;
    }
    const a = board[sel];
    const b = board[i];
    const [r1, c1] = ext(sel);
    const [r2, c2] = ext(i);
    if (a !== null && b !== null && a === b && canLink(buildGrid(board), r1, c1, r2, c2)) {
      const next = board.slice();
      next[sel] = null;
      next[i] = null;
      setBoard(next);
      setSel(null);
      scoreRef.current += 1;
      setScore(scoreRef.current);
      sfx.pop();
      if (next.every((kind) => kind === null)) {
        // 全部消除：时间奖励 = 剩余秒数 ÷ 10（timeLeft 由计时器每 250ms 刷新，误差可忽略）
        scoreRef.current += Math.floor(Math.max(0, timeLeft) / 1000 / 10);
        setScore(scoreRef.current);
        endTimerRef.current = window.setTimeout(end, 350);
      }
      return;
    }
    setSel(i); // 不可连 / 图案不同：第二块成为新的选中
  };

  /** 洗牌 ×1（免惩罚）：重排未消除块，并尽量保证洗后仍有可连对 */
  const doShuffle = () => {
    if (phase !== 'playing' || shuffleUsed) return;
    const idx: number[] = [];
    board.forEach((kind, i) => {
      if (kind !== null) idx.push(i);
    });
    if (idx.length < 2) return;
    const kinds = idx.map((i) => board[i]);
    let next: Board = board;
    for (let attempt = 0; attempt < 60; attempt++) {
      const trial = board.slice();
      const arr = shuffled(kinds);
      idx.forEach((pos, k) => {
        trial[pos] = arr[k];
      });
      next = trial;
      if (hasLink(trial)) break;
    }
    setBoard(next);
    setSel(null);
    setShuffleUsed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameLlk}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">{theme.icon} {t.gameLlk}</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-100/80 px-3 py-1 text-sm font-extrabold">{t.gameScore} {score}</span>
            <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
          </div>
        </div>

        <div className="relative p-3" style={gameBgStyle('rgba(255,243,221,0.82)')}>
          {phase === 'playing' && (
            <div className="absolute left-0 top-0 h-1.5 w-full bg-amber-900/15">
              <div className="h-full bg-gugu-accent" style={{ width: `${Math.max(0, Math.min(100, (timeLeft / DURATION) * 100))}%` }} />
            </div>
          )}

          <div className="mb-2 flex items-center justify-between pt-1">
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-extrabold text-gugu-ink-soft">
              ⏱ {Math.ceil(timeLeft / 1000)}s
            </span>
            <button
              type="button"
              onClick={doShuffle}
              disabled={phase !== 'playing' || shuffleUsed}
              className="press rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-gugu-accent disabled:opacity-40"
            >
              {locale === 'zh' ? '🔀 洗牌' : '🔀 Shuffle'}
            </button>
          </div>

          <div className="grid select-none grid-cols-8 gap-1.5">
            {board.map((kind, i) =>
              kind === null ? (
                <div key={i} className="aspect-square rounded-lg bg-amber-900/5" />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => tap(i)}
                  className={`flex aspect-square items-center justify-center rounded-lg border transition-all duration-150 ${
                    sel === i
                      ? 'border-amber-400 bg-white ring-2 ring-gugu-accent'
                      : 'border-amber-200 bg-[#f3dcae] hover:brightness-105 active:scale-95'
                  }`}
                >
                  {failed.has(kind) ? (
                    <span className="text-3xl leading-none">{theme.emoji[kind]}</span>
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
              )
            )}
          </div>

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center">
              <span className="text-4xl">{phase === 'ready' ? theme.icon : '🎉'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.llkHint : ''}</p>
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
