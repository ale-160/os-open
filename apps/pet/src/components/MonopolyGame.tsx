'use client';

import { useEscClose } from '@/hooks/useEscClose';

/**
 * 咕咕大富翁（轻量单机版）：22 格环形棋盘（6×4 网格顺时针），掷骰买地收租对蜗牛。
 * 现金 < 0 即破产判负；15 轮后按资产（现金 + 地价）定胜负。
 * 得分 = 玩家资产 / 10 四舍五入（胜方 +10），走统一的 minigameReward 结算。
 * 回合引擎放在组件外的 createEngine（可变状态 + setTimeout 链），组件只做快照渲染。
 */

import { useEffect, useRef, useState } from 'react';
import { sfx } from '@/lib/sfx';
import { useLocale } from '@/hooks/useLocale';
import { fmt, ui } from '@/lib/locale';
import { usePetStore } from '@/lib/store';
import { buildBoard, type BoardDef, type TileDef } from '@/lib/monopoly';
import { gameBgStyle } from '@/lib/gamebg';
import { gameImgError, gameThumbSrc } from '@/lib/game-assets';
import { MONOPOLY } from '@/lib/balance';
import type { PetState } from '@/lib/types';

const { startCash: START_CASH, maxRounds: MAX_ROUNDS, passBonus: PASS_BONUS } = MONOPOLY;
const STEP_MS = 160;

type Side = 'p' | 'a';

/** 22 格在 6 列 × 4 行网格中的落位（1 起始 [行, 列]）：0 在左上，沿外圈顺时针 */
const GRID_POS: [number, number][] = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], // 上排 0-5 →
  [2, 6], [3, 6], [4, 6], // 右列 ↓
  [4, 5], [4, 4], [4, 3], [4, 2], [4, 1], // 下排 ←
  [3, 1], [2, 1], // 左列 ↑
  [2, 2], [2, 3], [2, 4], [2, 5], // 内圈续 16-19 →
  [3, 5], [3, 4], // 内圈 20-21 ←，21 的下一格回到 0
];

type Stage = 'roll' | 'moving' | 'buy' | 'confirm' | 'aiTurn' | 'over';

interface SideState {
  pos: number;
  cash: number;
  /** 溪流事件：下回合停掷 */
  skip: boolean;
}

interface GameState {
  round: number;
  turn: Side;
  stage: Stage;
  dice: number | null;
  sides: Record<Side, SideState>;
  /** 本局棋盘（经典咕咕镇 / 第二季环游小镇） */
  board: BoardDef;
  owners: (Side | null)[];
  logs: string[];
  winner: Side | null;
  finalScore: number;
}

function createGame(locale: 'zh' | 'en', board: BoardDef): GameState {
  return {
    round: 1,
    turn: 'p',
    stage: 'roll',
    dice: null,
    sides: {
      p: { pos: 0, cash: START_CASH, skip: false },
      a: { pos: 0, cash: START_CASH, skip: false },
    },
    board,
    owners: Array.from({ length: board.tiles.length }, () => null as Side | null),
    logs: [
      locale === 'zh'
        ? `🎲 开局！${board.nameZh} · 双方各 ${START_CASH} 🪙，${MAX_ROUNDS} 轮后比资产`
        : `🎲 Start! ${board.nameEn} · ${START_CASH} 🪙 each, compare assets after ${MAX_ROUNDS} rounds`,
    ],
    winner: null,
    finalScore: 0,
  };
}

function assetsOf(g: GameState, side: Side): number {
  let sum = g.sides[side].cash;
  g.owners.forEach((owner, i) => {
    if (owner === side) sum += g.board.tiles[i].price ?? 0;
  });
  return sum;
}

interface EngineOpts {
  locale: 'zh' | 'en';
  petName: string;
  /** 状态变更后通知组件重渲染 */
  render: () => void;
  /** 终局回调（winner 已定，score 已算好） */
  onEnd: (winner: Side, score: number) => void;
}

/** 回合引擎：状态可变对象 + setTimeout 链，玩家确认/买地由外部调 roll/chooseBuy/nextTurn 驱动 */
function createEngine(opts: EngineOpts) {
  const L = (zh: string, en: string) => (opts.locale === 'zh' ? zh : en);
  const nameOf = (tile: TileDef) => (opts.locale === 'zh' ? tile.zh : tile.en);
  const sideName = (side: Side) => (side === 'p' ? opts.petName : L('蜗牛', 'Snail'));

  const timers: number[] = [];
  const g = createGame(opts.locale, buildBoard());

  const wait = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      const i = timers.indexOf(id);
      if (i >= 0) timers.splice(i, 1);
      fn();
    }, ms);
    timers.push(id);
  };
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
  };
  const log = (msg: string) => {
    g.logs.push(msg);
    if (g.logs.length > 30) g.logs.shift();
  };

  const endGame = (winner: Side) => {
    if (g.stage === 'over') return;
    g.stage = 'over';
    g.winner = winner;
    clearTimers();
    const assets = Math.max(0, assetsOf(g, 'p'));
    g.finalScore = Math.round(assets / 10) + (winner === 'p' ? 10 : 0);
    opts.render();
    opts.onEnd(winner, g.finalScore);
  };

  /** 扣钱；现金 < 0 判破产（扣钱方输），返回 false 表示已终局 */
  const spend = (side: Side, amount: number): boolean => {
    g.sides[side].cash -= amount;
    if (g.sides[side].cash < 0) {
      log(fmt(L('{name} 破产了…', '{name} went bankrupt...'), { name: sideName(side) }));
      endGame(side === 'p' ? 'a' : 'p');
      return false;
    }
    return true;
  };

  const finishTurn = (side: Side) => {
    if (g.stage === 'over') return;
    if (side === 'p') {
      g.stage = 'confirm'; // 玩家确认后进入蜗牛回合
      opts.render();
      return;
    }
    // 每轮结束按已购地产的租金收一次分红：买地越多，现金流越稳
    const incomeOf = (owner: Side) =>
      g.owners.reduce(
        (sum, who, i) =>
          who === owner ? sum + Math.floor((g.board.tiles[i].rent ?? 0) * MONOPOLY.roundIncomeRate) : sum,
        0
      );
    const pIncome = incomeOf('p');
    const aIncome = incomeOf('a');
    if (pIncome || aIncome) {
      g.sides.p.cash += pIncome;
      g.sides.a.cash += aIncome;
      log(
        fmt(L('🏠 本轮地产分红：{p} +{a} 🪙', '🏠 Property income this round: {p} +{a} 🪙'), {
          p: pIncome,
          a: aIncome,
        })
      );
    }
    if (g.round >= MAX_ROUNDS) {
      log(L(`⏰ ${MAX_ROUNDS} 轮结束，比拼资产！`, `⏰ ${MAX_ROUNDS} rounds over — compare assets!`));
      endGame(assetsOf(g, 'p') >= assetsOf(g, 'a') ? 'p' : 'a');
      return;
    }
    g.round += 1;
    opts.render();
    wait(700, () => beginTurn('p'));
  };

  const moveSteps = (side: Side, steps: number, chainDepth: number) => {
    g.turn = side;
    g.stage = 'moving';
    opts.render();
    let remaining = steps;
    const tick = () => {
      if (g.stage === 'over') return;
      const s = g.sides[side];
      s.pos = (s.pos + 1) % g.board.tiles.length;
      if (s.pos === 0) {
        s.cash += PASS_BONUS;
        log(L(`🚩 ${sideName(side)}经过起点 +${PASS_BONUS} 🪙`, `🚩 ${sideName(side)} passed Start +${PASS_BONUS} 🪙`));
      }
      opts.render();
      remaining -= 1;
      if (remaining > 0) wait(STEP_MS, tick);
      else wait(240, () => resolveLand(side, chainDepth));
    };
    wait(STEP_MS, tick);
  };

  /** 落格结算：地产（买/租/自家）/事件即时生效；chainDepth 防公交套公交 */
  const resolveLand = (side: Side, chainDepth: number) => {
    if (g.stage === 'over') return;
    const idx = g.sides[side].pos;
    const tile = g.board.tiles[idx];
    const marker = side === 'p' ? '🐥' : '🐌';

    if (tile.price !== null) {
      const owner = g.owners[idx];
      if (owner === null) {
        if (side === 'p') {
          if (g.sides.p.cash >= tile.price) {
            g.stage = 'buy'; // 弹内联 买下/跳过
            opts.render();
            return;
          }
          log(fmt(L('现金不够，买不起「{n}」', 'Not enough coins for {n}'), { n: nameOf(tile) }));
          finishTurn(side);
          return;
        }
        // AI 策略：留出安全线后即可买地
        if (g.sides.a.cash > tile.price + MONOPOLY.aiReserve) {
          g.sides.a.cash -= tile.price;
          g.owners[idx] = 'a';
          log(fmt(L('🐌 买下了「{n}」', '🐌 bought {n}'), { n: nameOf(tile) }));
        } else {
          log(L('🐌 摇摇头走开了', '🐌 shook its head and moved on'));
        }
        finishTurn(side);
        return;
      }
      if (owner !== side) {
        const rent = tile.rent ?? 0;
        log(
          fmt(L(`${marker} 落在对方地盘「{n}」，付租 ${rent} 🪙`, `${marker} owes rent ${rent} 🪙 at {n}`), { n: nameOf(tile) })
        );
        if (!spend(side, rent)) return;
        finishTurn(side);
        return;
      }
      log(fmt(L(`${marker} 回到自家「{n}」休息`, `${marker} rested at own {n}`), { n: nameOf(tile) }));
      finishTurn(side);
      return;
    }

    // 事件格：即时生效
    switch (tile.id) {
      case 'luck': {
        const v =
          MONOPOLY.luckMin + Math.floor(Math.random() * (MONOPOLY.luckMax - MONOPOLY.luckMin + 1));
        g.sides[side].cash += v;
        log(fmt(L(`⭐ ${marker} 摸到幸运星 +{v} 🪙`, `⭐ ${marker} got a lucky star +{v} 🪙`), { v }));
        break;
      }
      case 'bus': {
        if (chainDepth > 0) {
          log(L('🚌 又是公交站，先歇一歇', '🚌 Bus stop again — take a rest'));
          break;
        }
        const n = 1 + Math.floor(Math.random() * 3);
        log(fmt(L(`🚌 ${marker} 免费坐公交前进 {n} 格`, `🚌 ${marker} rides the bus forward {n}`), { n }));
        wait(500, () => moveSteps(side, n, chainDepth + 1));
        return;
      }
      case 'tax': {
        const amt = Math.ceil(g.sides[side].cash * MONOPOLY.taxRate);
        log(fmt(L(`🏦 ${marker} 交了税 -{v} 🪙`, `🏦 ${marker} paid {v} 🪙 tax`), { v: amt }));
        if (!spend(side, amt)) return;
        break;
      }
      case 'river': {
        g.sides[side].skip = true;
        log(L('🏞️ 溪边太好玩了，下回合停掷一次', '🏞️ Too fun by the creek — skip next roll'));
        break;
      }
      case 'chest': {
        if (Math.random() < 0.5) {
          g.sides[side].cash += MONOPOLY.chestGood;
          log(fmt(L(`🎁 ${marker} 打开宝箱 +{v} 🪙`, `🎁 ${marker} opened the chest +{v} 🪙`), { v: MONOPOLY.chestGood }));
        } else {
          log(fmt(L('🎁 宝箱里是调皮的小虫 -{v} 🪙', '🎁 A naughty bug in the chest -{v} 🪙'), { v: MONOPOLY.chestBad }));
          if (!spend(side, MONOPOLY.chestBad)) return;
        }
        break;
      }
      case 'festival': {
        g.sides[side].cash += MONOPOLY.festival;
        log(fmt(L(`🏮 ${marker} 逛灯会赚了零花 +{v} 🪙`, `🏮 ${marker} enjoyed the fair +{v} 🪙`), { v: MONOPOLY.festival }));
        break;
      }
      case 'hospital': {
        log(fmt(L(`🏥 ${marker} 打疫苗花掉 {v} 🪙`, `🏥 ${marker} got a shot for {v} 🪙`), { v: MONOPOLY.hospital }));
        if (!spend(side, MONOPOLY.hospital)) return;
        break;
      }
      default:
        break; // start：经过/落在起点时已发放通行奖励
    }
    finishTurn(side);
  };

  const beginTurn = (side: Side) => {
    if (g.stage === 'over') return;
    g.turn = side;
    g.dice = null;
    if (g.sides[side].skip) {
      g.sides[side].skip = false;
      log(fmt(L('{name} 在溪边发呆，本回合停掷…', '{name} dozes by the creek — roll skipped...'), { name: sideName(side) }));
      if (side === 'a') {
        g.stage = 'aiTurn';
        opts.render();
        wait(800, () => finishTurn('a'));
      } else {
        finishTurn('p');
      }
      return;
    }
    if (side === 'p') {
      g.stage = 'roll';
      opts.render();
      return;
    }
    g.stage = 'aiTurn';
    opts.render();
    wait(800, () => {
      if (g.stage === 'over') return;
      const d = 1 + Math.floor(Math.random() * 6);
      g.dice = d;
      log(fmt(L('🐌 掷出 {n} 点', '🐌 rolled {n}'), { n: d }));
      opts.render();
      wait(600, () => moveSteps('a', d, 0));
    });
  };

  return {
    g,
    dispose: clearTimers,
    /** 玩家掷骰（按钮触发，骰值 1-6） */
    roll() {
      if (g.stage !== 'roll') return;
      sfx.pop();
      const d = 1 + Math.floor(Math.random() * 6);
      g.dice = d;
      g.stage = 'moving';
      log(fmt(L('🐥 掷出 {n} 点', '🐥 rolled {n}'), { n: d }));
      opts.render();
      wait(450, () => moveSteps('p', d, 0));
    },
    /** 内联买地选择：买下 / 跳过 */
    chooseBuy(buy: boolean) {
      if (g.stage !== 'buy') return;
      const idx = g.sides.p.pos;
      const tile = g.board.tiles[idx];
      const price = tile.price ?? 0;
      if (buy) {
        g.sides.p.cash -= price;
        g.owners[idx] = 'p';
        log(fmt(L('🐥 买下了「{n}」', '🐥 bought {n}'), { n: nameOf(tile) }));
      } else {
        log(fmt(L('🐥 没买「{n}」，先观望', '🐥 passed on {n}'), { n: nameOf(tile) }));
      }
      finishTurn('p');
      opts.render();
    },
    /** 玩家确认落格结果，交给蜗牛回合 */
    nextTurn() {
      if (g.stage !== 'confirm') return;
      beginTurn('a');
      opts.render();
    },
  };
}

type Engine = ReturnType<typeof createEngine>;

export function MonopolyGame({ pet, onClose }: { pet: PetState; onClose: () => void }) {
  const { locale } = useLocale();
  const t = ui(locale);
  useEscClose(onClose);

  const L = (zh: string, en: string) => (locale === 'zh' ? zh : en);
  const nameOf = (tile: TileDef) => (locale === 'zh' ? tile.zh : tile.en);

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [reward, setReward] = useState<{ coins: number; mood: number; newBest: boolean } | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [, setTick] = useState(0);
  /** 引擎持有的可变棋局对象（就地修改 + setTick 重渲染；重开局换新对象） */
  const [g, setG] = useState<GameState>(() => createGame(locale, buildBoard()));
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => () => engineRef.current?.dispose(), []);

  const start = () => {
    engineRef.current?.dispose();
    const eng = createEngine({
      locale,
      petName: pet.name,
      render: () => setTick((v) => v + 1),
      onEnd: (winner, score) => {
        if (winner === 'p') sfx.fanfare();
        setReward(usePetStore.getState().finishMinigame('monopoly', score));
        setPhase('done');
      },
    });
    engineRef.current = eng;
    setG(eng.g);
    setReward(null);
    setPhase('playing');
  };

  const roll = () => engineRef.current?.roll();
  const chooseBuy = (buy: boolean) => engineRef.current?.chooseBuy(buy);
  const nextTurn = () => engineRef.current?.nextTurn();

  const buyTile = g.stage === 'buy' ? g.board.tiles[g.sides.p.pos] : null;
  const ownCount = (side: Side) => g.owners.filter((o) => o === side).length;
  const round = Math.min(g.round, MAX_ROUNDS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="dialog" aria-label={t.gameMono}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">🎲 {t.gameMono}</h2>
          <button type="button" onClick={onClose} className="press rounded-full bg-amber-900/5 px-3 py-1 text-sm font-semibold">✕</button>
        </div>

        <div className="relative p-3" style={gameBgStyle('rgba(246,236,210,0.82)')}>
          {/* 季节棋盘背景（春/夏/秋/冬 白天插画） */}
          {/* 双方资产侧栏 */}
          <div className="mb-2 flex items-center justify-between gap-1 text-[11px] font-bold">
            <span className={`rounded-full px-2 py-1 shadow-sm ${g.turn === 'p' ? 'bg-amber-200/90' : 'bg-white/70'}`}>
              🐥 {pet.name} 🪙{g.sides.p.cash} · 🏠{ownCount('p')}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 text-gugu-ink-soft">
              {L(`第 ${round}/${MAX_ROUNDS} 轮`, `Round ${round}/${MAX_ROUNDS}`)}
            </span>
            <span className={`rounded-full px-2 py-1 shadow-sm ${g.turn === 'a' ? 'bg-sky-200/90' : 'bg-white/70'}`}>
              🐌 {L('蜗牛', 'Snail')} 🪙{g.sides.a.cash} · 🏠{ownCount('a')}
            </span>
          </div>

          {/* 棋盘：6×4 网格，0 在左上沿外圈顺时针 */}
          <div className="grid grid-cols-6 grid-rows-4 gap-1.5">
            <div
              style={{ gridRow: 3, gridColumn: '2 / span 2' }}
              className="flex flex-col items-center justify-center rounded-xl bg-white/70"
            >
              <span className="flex h-8 items-center justify-center">
                {g.dice !== null ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={gameThumbSrc(`dice-${g.turn === 'a' ? 'gold' : 'white'}-${g.dice}.png`)}
                    alt="🎲"
                    draggable={false}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <span className="text-xl leading-none">🏘️</span>
                )}
              </span>
              <span className="text-[10px] font-extrabold text-gugu-ink-soft">
                {g.dice !== null ? g.dice : L(g.board.nameZh, g.board.nameEn)}
              </span>
            </div>
            {g.board.tiles.map((tile, i) => {
              const art = tile.art ?? `mono-${tile.id}`;
              const owner = g.owners[i];
              const pHere = g.sides.p.pos === i;
              const aHere = g.sides.a.pos === i;
              return (
                <div
                  key={tile.id}
                  style={{ gridRow: GRID_POS[i][0], gridColumn: GRID_POS[i][1] }}
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border transition-colors ${
                    owner === 'p'
                      ? 'border-amber-400 bg-amber-100/90'
                      : owner === 'a'
                        ? 'border-sky-400 bg-sky-100/90'
                        : 'border-amber-200/70 bg-white/80'
                  } ${pHere ? 'ring-2 ring-gugu-accent/80' : aHere ? 'ring-2 ring-sky-400/80' : ''}`}
                  title={nameOf(tile)}
                >
                  {failed.has(art) ? (
                    <span className="text-xl leading-none">{tile.emoji}</span>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={gameThumbSrc(`${art}.png`)}
                      alt=""
                      draggable={false}
                      className="h-4/5 w-4/5 object-contain"
                      onError={(e) => gameImgError(e, `${art}.png`, () => setFailed((prev) => new Set(prev).add(art)))}
                    />
                  )}
                  {/* 双方棋子标记 🐥/🐌 */}
                  <span className="absolute right-0.5 top-0.5 flex flex-col items-end leading-none">
                    {pHere && <span className="text-[10px]">🐥</span>}
                    {aHere && <span className="text-[10px]">🐌</span>}
                  </span>
                  {/* 拥有者色点：玩家 amber / AI sky */}
                  {owner && (
                    <span
                      className={`absolute bottom-0.5 left-0.5 h-2 w-2 rounded-full border border-white ${
                        owner === 'p' ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* 回合操作区 */}
          <div className="mt-3 flex min-h-12 flex-wrap items-center justify-center gap-2">
            {g.stage === 'roll' && (
              <button
                type="button"
                onClick={roll}
                className="press rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60"
              >
                🎲 {L('掷骰子', 'Roll dice')}
              </button>
            )}
            {buyTile && (
              <>
                <span className="text-xs font-bold text-gugu-ink">
                  {nameOf(buyTile)} · 🪙{buyTile.price}
                </span>
                <button
                  type="button"
                  onClick={() => chooseBuy(true)}
                  className="press rounded-2xl bg-gugu-accent px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-amber-300/60"
                >
                  {L('买下', 'Buy')}
                </button>
                <button
                  type="button"
                  onClick={() => chooseBuy(false)}
                  className="press rounded-2xl bg-amber-900/10 px-5 py-2.5 text-sm font-bold text-gugu-ink"
                >
                  {L('跳过', 'Skip')}
                </button>
              </>
            )}
            {g.stage === 'confirm' && (
              <button
                type="button"
                onClick={nextTurn}
                className="press rounded-2xl bg-gugu-accent px-8 py-3 text-base font-extrabold text-white shadow-lg shadow-amber-300/60"
              >
                {L('继续 ▶', 'Next ▶')}
              </button>
            )}
            {(g.stage === 'moving' || g.stage === 'aiTurn') && (
              <span className="animate-pulse text-sm font-bold text-gugu-ink-soft">
                {g.turn === 'a' ? `🐌 ${L('蜗牛行动中…', 'The snail is moving...')}` : `🐥 ${L('移动中…', 'Moving...')}`}
              </span>
            )}
          </div>

          {/* 日志：末 3 条 */}
          <div className="mt-2 h-14 overflow-hidden rounded-xl bg-amber-900/5 px-3 py-1 text-[11px] leading-[1.5] text-gugu-ink-soft">
            {g.logs.slice(-3).map((line, i, arr) => (
              <p key={`${i}-${line}`} className={`truncate ${i === arr.length - 1 ? 'font-bold text-gugu-ink' : ''}`}>
                {line}
              </p>
            ))}
          </div>

          {phase !== 'playing' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/88 px-6 text-center backdrop-blur">
              <span className="text-4xl">{phase === 'ready' ? '🎲' : g.winner === 'p' ? '🏆' : '🐌'}</span>
              <p className="max-w-[280px] text-sm text-gugu-ink-soft">{phase === 'ready' ? t.monoHint : ''}</p>
              {phase === 'done' && reward && (
                <>
                  <p className="text-2xl font-extrabold">
                    {g.winner === 'p' ? L('你赢了！', 'You win!') : L('蜗牛赢了…', 'The snail wins...')}
                  </p>
                  <p className="text-3xl font-extrabold">{t.gameScore} {g.finalScore}</p>
                  {reward.newBest && <p className="text-sm font-extrabold text-gugu-accent">{t.newRecord}</p>}
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
