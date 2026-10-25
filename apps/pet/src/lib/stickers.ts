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
 * 第 5 批场景表情（face/<id>.png）：节日 / 旅行 / 睡姿 / 吃东西，文件名语义化。
 * 作为对应台词类型的备选池，50% 概率替换默认贴纸，让场景图自然出现。
 */
export const EXTRA_FACES = [
  // 节日
  'sparkler', 'red-envelope', 'mooncake', 'pumpkin-candy', 'candy-cane',
  'party-confetti', 'flower-lei-dance', 'fox-mask', 'paper-lantern', 'birthday-horn',
  // 旅行
  'suitcase-ride', 'map-confused', 'aviator-flag', 'paper-boat', 'hiking-stick',
  'selfie-peace', 'train-window', 'boarding-pass', 'sleeping-bag', 'instant-noodles',
  // 睡姿
  'croissant-sleep', 'pillow-hug', 'hammock-sleep', 'books-nap', 'sitting-doze',
  'bed-blanket', 'cloud-sleep', 'leaf-blanket', 'dream-snacks', 'rubbing-eyes',
  // 吃东西
  'ramen-chopsticks', 'bubble-tea', 'watermelon-bite', 'taiyaki-tail', 'icecream-lick',
  'rice-cracker', 'hot-cocoa', 'popcorn-bucket', 'soup-spoon', 'chocolate-bar',
] as const;

const EXTRA_POOLS: Partial<Record<LineKind, readonly string[]>> = {
  checkin: ['sparkler', 'red-envelope', 'mooncake', 'pumpkin-candy', 'candy-cane', 'party-confetti', 'fox-mask', 'paper-lantern', 'birthday-horn'],
  eventMoodUp: ['party-confetti', 'flower-lei-dance', 'birthday-horn'],
  stageUp: ['party-confetti', 'birthday-horn'],
  gameGreat: ['party-confetti', 'flower-lei-dance'],
  back: ['suitcase-ride', 'map-confused', 'aviator-flag', 'paper-boat', 'hiking-stick', 'selfie-peace', 'train-window', 'boarding-pass', 'sleeping-bag', 'instant-noodles'],
  feed: ['ramen-chopsticks', 'watermelon-bite', 'taiyaki-tail', 'rice-cracker', 'popcorn-bucket', 'chocolate-bar'],
  careMeal: ['ramen-chopsticks', 'bubble-tea', 'icecream-lick', 'hot-cocoa', 'soup-spoon'],
  sleep: ['croissant-sleep', 'pillow-hug', 'bed-blanket', 'cloud-sleep'],
  sleepy: ['sitting-doze', 'leaf-blanket', 'dream-snacks', 'rubbing-eyes'],
  careNight: ['hammock-sleep', 'books-nap', 'bed-blanket'],
  tired: ['sitting-doze', 'rubbing-eyes'],
  weatherRain: ['croissant-sleep', 'sitting-doze'],
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
