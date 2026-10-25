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
];

/** 夜行访客（仅夜晚时段出现） */
export const NIGHT_VISITORS = new Set(['owl', 'moth', 'bat', 'firefly', 'jellyfish']);

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
