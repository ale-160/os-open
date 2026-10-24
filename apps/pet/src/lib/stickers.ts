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

/** 挑贴纸：专属优先，60% 概率显示（保持气泡轻量） */
export function pickSticker(kind: LineKind): string | null {
  if (Math.random() > 0.6) return null;
  const id = STICKER_BY_LINE[kind] ?? FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  return stickerSrc(id);
}

export function stickerSrc(id: string): string {
  return `${BASE_PATH}/skins/gugu/face/${id}.png`;
}
