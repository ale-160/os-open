/**
 * 生态访客：随机路过舞台的小动物（AI 生成透明图），飞行/地面两种巡游方式。
 * 与蝴蝶小剧场并存（蝴蝶保留，访客为独立低频事件）。
 */

import { BASE_PATH } from './skins';

export type VisitorMode = 'fly' | 'ground';

export interface VisitorDef {
  id: string;
  mode: VisitorMode;
}

/** 访客表（与 public/skins/gugu/vis/<id>.png 一一对应） */
export const VISITORS: VisitorDef[] = [
  { id: 'sparrow', mode: 'fly' },
  { id: 'dove', mode: 'fly' },
  { id: 'dragonfly', mode: 'fly' },
  { id: 'bee', mode: 'fly' },
  { id: 'butterfly-blue', mode: 'fly' },
  { id: 'butterfly-orange', mode: 'fly' },
  { id: 'owl', mode: 'fly' },
  { id: 'hummingbird', mode: 'fly' },
  { id: 'moth', mode: 'fly' },
  { id: 'bat', mode: 'fly' },
  { id: 'crow', mode: 'fly' },
  { id: 'duckling', mode: 'ground' },
  { id: 'cat', mode: 'ground' },
  { id: 'rabbit', mode: 'ground' },
  { id: 'snail', mode: 'ground' },
  { id: 'ladybug', mode: 'ground' },
  { id: 'turtle', mode: 'ground' },
  { id: 'hedgehog', mode: 'ground' },
  { id: 'squirrel', mode: 'ground' },
  { id: 'deer', mode: 'ground' },
  { id: 'fox', mode: 'ground' },
  { id: 'raccoon', mode: 'ground' },
  { id: 'frog', mode: 'ground' },
  { id: 'hamster', mode: 'ground' },
  { id: 'mouse', mode: 'ground' },
  { id: 'penguin', mode: 'ground' },
  // 传说生物（第 5 批）：飞行 / 地面
  { id: 'v3-fenghuang', mode: 'fly' },
  { id: 'v3-griffin', mode: 'fly' },
  { id: 'v3-dragonet', mode: 'fly' },
  { id: 'v3-wyvern', mode: 'fly' },
  { id: 'v3-pixie', mode: 'fly' },
  { id: 'v3-pegasus', mode: 'fly' },
  { id: 'v3-thunderbird', mode: 'fly' },
  { id: 'v3-wisp', mode: 'fly' },
  { id: 'v3-hippocampus', mode: 'fly' },
  { id: 'v3-sea-serpent', mode: 'fly' },
  { id: 'v3-qilin', mode: 'ground' },
  { id: 'v3-jade-rabbit', mode: 'ground' },
  { id: 'v3-merfolk', mode: 'ground' },
  { id: 'v3-yeti', mode: 'ground' },
  { id: 'v3-unicorn', mode: 'ground' },
  { id: 'v3-kitsune', mode: 'ground' },
  { id: 'v3-tanuki', mode: 'ground' },
  { id: 'v3-sphinx', mode: 'ground' },
  { id: 'v3-ember-salamander', mode: 'ground' },
  { id: 'v3-golem', mode: 'ground' },
];

/** 夜行访客（仅夜晚时段出现） */
export const NIGHT_VISITORS = new Set(['owl', 'moth', 'bat', 'firefly', 'jellyfish', 'v3-wisp', 'v3-jade-rabbit', 'v3-thunderbird']);

/** 昼行访客（夜晚不出） */
export const DAY_ONLY_VISITORS = new Set(['bee', 'hummingbird', 'duckling', 'squirrel']);

export function visitorSrc(id: string): string {
  return `${BASE_PATH}/skins/gugu/vis/${id}.png`;
}

/** 按时段挑一只随机访客 */
export function pickVisitor(hour: number, isBadWeather: boolean): VisitorDef {
  const pool = VISITORS.filter((v) => {
    if (NIGHT_VISITORS.has(v.id)) return hour >= 20 || hour < 6;
    if (DAY_ONLY_VISITORS.has(v.id)) return hour >= 6 && hour < 19;
    return true;
  });
  const weatherPool = isBadWeather ? pool.filter((v) => ['snail', 'frog', 'turtle', 'ladybug', 'moth'].includes(v.id)) : pool;
  const src = weatherPool.length ? weatherPool : pool;
  return src[Math.floor(Math.random() * src.length)];
}
