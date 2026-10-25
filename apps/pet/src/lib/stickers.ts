/**
 * 表情贴纸：AI 生成的 Q 版咕咕表情图（public/skins/gugu/face/<id>.png），
 * 按台词类型挑选并伴随气泡显示（概率出现，避免每条都带图）。
 */

import { BASE_PATH } from './skins';
import type { LineKind } from './lines';

export const STICKER_BY_LINE: Partial<Record<LineKind, string>> = {
  tap: 'happy',
  tapEgg: 'wow',
  hatchWelcome: 'cheer',
  feed: 'nom',
  wash: 'bath',
  play: 'dance',
  work: 'cook',
  study: 'read',
  buy: 'gift',
  tired: 'sleepy',
  sleep: 'sleep-deep',
  wake: 'happy',
  hungry: 'cry',
  dirty: 'sad',
  sleepy: 'sleepy',
  sick: 'sick',
  recover: 'cheer',
  back: 'love',
  stageUp: 'proud',
  eventCoin: 'smug',
  eventMoodUp: 'love',
  eventMoodDown: 'sad',
  gameGreat: 'cheer',
  gameOk: 'happy',
  gameMeh: 'meh',
  achUnlock: 'cheer',
  hintMenu: 'sneak',
  butterfly: 'wow',
  yawn: 'sleepy',
  checkin: 'smug',
  careMeal: 'eating',
  careRest: 'pat',
  careNight: 'sleep-deep',
  careFatigue: 'pray',
  weatherRain: 'sleep-deep',
  weatherSnow: 'wow',
  greetDawn: 'wave',
  greetDay: 'sing',
  greetDusk: 'sing-mic',
  greetNight: 'zzz-song',
  idle: 'meh',
};

/** 兜底池（无专属贴纸的台词随机取） */
const FALLBACK = ['happy', 'nom', 'wave', 'love', 'run'];

/**
 * 第 5 批场景表情（face/b3-1..40）：节日 1-10 / 旅行 11-20 / 睡姿 21-30 / 吃东西 31-40。
 * 作为对应台词类型的备选池，50% 概率替换默认贴纸，让场景图自然出现。
 */
const EXTRA_POOLS: Partial<Record<LineKind, readonly string[]>> = {
  checkin: ['b3-1', 'b3-2', 'b3-3', 'b3-4', 'b3-5', 'b3-6', 'b3-8', 'b3-9', 'b3-10'],
  eventMoodUp: ['b3-6', 'b3-7', 'b3-10'],
  stageUp: ['b3-6', 'b3-10'],
  gameGreat: ['b3-6', 'b3-7'],
  back: ['b3-11', 'b3-12', 'b3-13', 'b3-14', 'b3-15', 'b3-16', 'b3-17', 'b3-18', 'b3-19', 'b3-20'],
  feed: ['b3-31', 'b3-33', 'b3-34', 'b3-36', 'b3-38', 'b3-40'],
  careMeal: ['b3-31', 'b3-32', 'b3-35', 'b3-37', 'b3-39'],
  sleep: ['b3-21', 'b3-22', 'b3-26', 'b3-27'],
  sleepy: ['b3-25', 'b3-28', 'b3-29', 'b3-30'],
  careNight: ['b3-23', 'b3-24', 'b3-26'],
  tired: ['b3-25', 'b3-30'],
  weatherRain: ['b3-21', 'b3-25'],
};

/** 挑贴纸：专属优先，60% 概率显示（保持气泡轻量）；有场景备选池时各半 */
export function pickSticker(kind: LineKind): string | null {
  if (Math.random() > 0.6) return null;
  const extra = EXTRA_POOLS[kind];
  if (extra && Math.random() < 0.5) {
    return stickerSrc(extra[Math.floor(Math.random() * extra.length)]);
  }
  const id = STICKER_BY_LINE[kind] ?? FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  return stickerSrc(id);
}

export function stickerSrc(id: string): string {
  return `${BASE_PATH}/skins/gugu/face/${id}.png`;
}
